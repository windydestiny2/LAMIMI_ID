import asyncio
import json
import os
import uuid
import logging
import math
import base64
import io
from contextlib import asynccontextmanager
from datetime import datetime, timezone, timedelta, time
from pathlib import Path
import re
from typing import List, Optional
from urllib.parse import quote

import bcrypt
import jwt
import pytesseract
from PIL import Image
from dotenv import load_dotenv
from fastapi import FastAPI, APIRouter, HTTPException, Request, Response, Depends, UploadFile, File
from pydantic import BaseModel, Field
from starlette.middleware.cors import CORSMiddleware
from starlette.staticfiles import StaticFiles

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

from lib.db import client, db, ensure_indexes

logger = logging.getLogger(__name__)
JWT_ALGORITHM = "HS256"
ORDER_STATUSES = ["menunggu_pembayaran", "menunggu_verifikasi", "lunas", "diproses", "dikirim", "selesai", "dibatalkan"]
PAID_STATUSES = ["menunggu_verifikasi", "lunas", "diproses", "dikirim", "selesai"]


def normalize_stock(stock: int) -> int:
    # keep the documented unlimited sentinel (-1), but never allow any real stock field
    # to drift below zero. A bad negative value should be treated as 0 for safety.
    if stock == -1:
        return -1
    return max(stock, 0)


def jwt_secret() -> str:
    return os.environ["JWT_SECRET"]


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode(), hashed.encode())


def create_access_token(user_id: str, email: str) -> str:
    payload = {"sub": user_id, "email": email, "type": "access",
               "exp": datetime.now(timezone.utc) + timedelta(hours=12)}
    return jwt.encode(payload, jwt_secret(), algorithm=JWT_ALGORITHM)


def rupiah(n: int) -> str:
    return "Rp " + f"{n:,}".replace(",", ".")


def normalize_datetime_for_compare(value) -> Optional[datetime]:
    """Return an aware UTC datetime from a voucher payload or DB field.

    The admin form sends datetime-local without a timezone; the database often stores
    Mongo datetime objects as naive datetimes. Comparing those directly to an aware
    ``datetime.now(timezone.utc)`` raises a TypeError and becomes a generic frontend error.
    """
    if value is None:
        return None
    if isinstance(value, str):
        try:
            dt = datetime.fromisoformat(value.replace("Z", "+00:00"))
        except Exception:
            return None
    elif isinstance(value, datetime):
        dt = value
    else:
        return None

    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def parse_amount_token(token: str) -> Optional[int]:
    """Safely convert a scanned OCR token to an integer amount.

    Accept one of the common Indonesian money shapes:
      - `12000`
      - `12.000`
      - `12,000`
      - `12.000,00`
      - `12,000.00`

    Normalize all of them to an integer amount, but reject multi-group bank-like
    strings such as `1.673.204.663`, `1.200.000`, and `1,200,000`.
    """
    text = str(token or "").strip()
    text = re.sub(r"[^0-9,\.]+", "", text)
    if not text:
        return None

    # Accept explicit decimal style with hundredths zero, e.g. `12.000,00` or
    # `12,000.00`. This is a valid representation of an exact whole-amount value
    # from a proof payment screenshot and should not be rejected as OCR garbage.
    if "." in text and "," in text:
        if text.count(".") != 1 or text.count(",") != 1:
            return None

        if text.find(".") < text.find(","):
            whole = text.split(",", 1)[0]
            frac = text.split(",", 1)[1]
            if not re.fullmatch(r"\d{1,3}\.\d{3}", whole):
                return None
            if frac != "00":
                return None
            cleaned = whole.replace(".", "")
        else:
            whole = text.split(".", 1)[0]
            frac = text.split(".", 1)[1]
            if not re.fullmatch(r"\d{1,3},\d{3}", whole):
                return None
            if frac != "00":
                return None
            cleaned = whole.replace(",", "")

        if not cleaned.isdigit():
            return None

    elif "." in text or "," in text:
        sep = "." if text.count(".") == 1 else ","
        # Reject bank-account-like repeated grouping.
        if text.count(sep) > 1:
            return None
        if sep == ".":
            if not re.fullmatch(r"\d+\.\d{3}", text):
                return None
        else:
            if not re.fullmatch(r"\d+,\d{3}", text):
                return None

        left, right = text.split(sep, 1)
        if not left.isdigit() or not right.isdigit():
            return None
        if len(right) != 3:
            return None
        cleaned = left + right
    else:
        cleaned = text
        if not cleaned.isdigit():
            return None

    # Reject obvious bank-account strings or very long digit runs.
    if len(cleaned) > 7:
        return None

    parsed = int(cleaned)
    return parsed if parsed > 0 else None


def extract_payment_amount_from_ocr_text(ocr_text: str) -> Optional[int]:
    """Return the most plausible amount from OCR text by prioritizing payment context.

    The parser must see an explicit currency signal (`Rp`, `IDR`, `rupiah`,
    `nominal`, `bayar`, `transfer`) in the same OCR line as the numeric token.
    This suppresses false positives from book price labels or account numbers and
    lets a customer proof screenshot report a clean amount rather than dropping to
    zero.
    """
    if not ocr_text:
        return None

    lines = [
        re.sub(r"\s+", " ", line.strip())
        for line in ocr_text.replace("\r", "").split("\n")
        if line.strip()
    ]

    strong_context_keywords = (
        r"bayar|bayaran|dibayar|pembayaran|nominal|transfer|payment|paid|terima"
    )

    strong_candidates: List[int] = []
    fallback_candidates: List[int] = []

    # First pass: prefer lines that carry visible payment intent keywords and a
    # currency signal. This rejects lines that just show `EbookRp 35.000` or any
    # product price line without an explicit payment context.
    for line in lines:
        lower = line.lower()
        if re.search(strong_context_keywords, lower, flags=re.IGNORECASE):
            for match in re.findall(r"(?:rp|idr|rupiah)\s*[: ]?\s*([0-9.,]+)", line, flags=re.IGNORECASE):
                parsed = parse_amount_token(str(match))
                if parsed is not None:
                    strong_candidates.append(parsed)

    if strong_candidates:
        # Return the last strong-context candidate, which usually follows the
        # customer input line in the screenshot and matches the payment amount.
        return strong_candidates[-1]

    # Second pass: fallback to an explicit surface line that has a direct money
    # token. This remains conservative and avoids an over-acceptance of product
    # prices accidentally captured from the ebook list or invoice screenshot.
    for line in lines:
        for match in re.findall(r"(?:rp|idr|rupiah)\s*[: ]?\s*([0-9.,]+)", line, flags=re.IGNORECASE):
            parsed = parse_amount_token(str(match))
            if parsed is not None:
                fallback_candidates.append(parsed)

    if fallback_candidates:
        return fallback_candidates[-1]

    return None


def extract_payment_amount_from_proof_image(proof_data_url: str) -> Optional[int]:
    """Extract an Indonesian-style amount string from a proof image via tesseract OCR.

    The backend receives a browser data URL; the OCR captures the text and looks for a
    real numeric payment amount (e.g. Rp 9.900 or 9900) from the image.
    """
    try:
        if not proof_data_url or not proof_data_url.startswith("data:image"):
            return None
        header, payload = proof_data_url.split(",", 1)
        image_bytes = base64.b64decode(payload)
        image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
        # Ask OCR for only the relevant text line and avoid scanning huge noisy lines.
        ocr_text = pytesseract.image_to_string(image, config="--psm 6")
        return extract_payment_amount_from_ocr_text(ocr_text)
    except Exception:
        return None
    return None


def normalize_received_amount(total: Optional[int], received: Optional[int]) -> int:
    """Normalize evidence of paid amount.

    `received` can come from OCR or an optional manual amount field. If OCR fails,
    the safest behavior is to return zero rather than pretending the cart total
    was already received. This prevents a short proof screenshot from being
    interpreted as the full payment.
    """
    if received is not None:
        return max(0, int(received))
    return 0


def evaluate_payment_verification(total: int, received: int) -> tuple[str, int]:
    """Evaluate proof of payment against order total.

    Returns a tuple of (Status, shortage)
    Status is one of: Pembayaran Diterima, Pembayaran Kurang
    """
    if received < total:
        return "Pembayaran Kurang", total - received
    return "Pembayaran Diterima", 0


# ---------------- Models ----------------

class VariantGroup(BaseModel):
    name: str
    options: List[str] = []


class Variant(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    label: str = ""
    selections: dict = {}
    price: int = 0
    stock: int = -1  # -1 = tidak dilacak / unlimited


class Book(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    title: str
    author: str = ""
    language: str = "mandarin"  # mandarin|korea|jepang|inggris
    type: str = "digital"       # digital|fisik
    price: int = 0
    description: str = ""
    cover_url: str = ""
    badge: str = ""
    featured: bool = False
    shopee_url: str = ""
    tokopedia_url: str = ""
    tiktok_url: str = ""
    categories: List[str] = []
    variant_groups: List[VariantGroup] = []
    variants: List[Variant] = []
    stock: int = -1  # -1 = unlimited (default untuk ebook)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class BookInput(BaseModel):
    title: str
    author: str = ""
    language: str = "mandarin"
    type: str = "digital"
    price: int = 0
    description: str = ""
    cover_url: str = ""
    badge: str = ""
    featured: bool = False
    shopee_url: str = ""
    tokopedia_url: str = ""
    tiktok_url: str = ""
    categories: List[str] = []
    variant_groups: List[VariantGroup] = []
    variants: List[Variant] = []
    stock: int = -1


class ShippingRegion(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    cost: int
    eta: str = ""


class ShippingInput(BaseModel):
    name: str
    cost: int
    eta: str = ""


class PaymentMethod(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    account_name: str = ""
    account_number: str = ""
    qr_image: str = ""
    active: bool = True


class PaymentMethodInput(BaseModel):
    name: str
    account_name: str = ""
    account_number: str = ""
    qr_image: str = ""
    active: bool = True


class Voucher(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    code: str
    description: str = ""
    discount_type: str = "amount"  # amount|percent
    discount_value: int = 0
    active: bool = True
    valid_from: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    valid_until: datetime = Field(default_factory=lambda: datetime.now(timezone.utc) + timedelta(days=30))
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class VoucherInput(BaseModel):
    code: str
    description: str = ""
    discount_type: str = "amount"
    discount_value: int = 0
    active: bool = True
    valid_from: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    valid_until: datetime = Field(default_factory=lambda: datetime.now(timezone.utc) + timedelta(days=30))


class LanguageEntry(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    slug: str = ""
    label: str = ""
    description: str = ""
    active: bool = True
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class LanguageInput(BaseModel):
    name: str
    slug: str = ""
    label: str = ""
    description: str = ""
    active: bool = True


class BookCategory(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    slug: str = ""
    description: str = ""
    parent: str = ""  # slug bahasa (subkategori) atau slug kategori lain (sub dari kategori); "" = global
    parent_type: str = ""  # "" | "language" | "category"
    active: bool = True
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class BookCategoryInput(BaseModel):
    name: str
    slug: str = ""
    description: str = ""
    parent: str = ""
    parent_type: str = ""
    active: bool = True


class OrderItem(BaseModel):
    book_id: str
    title: str
    price: int
    qty: int = 1
    variant_id: str = ""
    variant_label: str = ""


class OrderItemInput(BaseModel):
    book_id: str
    variant_id: str = ""
    qty: int = 1


class Order(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    order_number: str = Field(default_factory=lambda: "LM-" + uuid.uuid4().hex[:6].upper())
    customer_name: str
    customer_email: str = ""
    customer_phone: str = ""
    items: List[OrderItem] = []
    order_type: str = "digital"
    address: str = ""
    city: str = ""
    province: str = ""
    postal_code: str = ""
    region: str = ""
    notes: str = ""
    shipping_cost: int = 0
    subtotal: int = 0
    discount_amount: int = 0
    total: int = 0
    voucher_code: str = ""
    status: str = "menunggu_pembayaran"
    payment_method: str = ""
    payment_proof: str = ""
    payment_received_amount: int = 0
    payment_status: str = "Pembayaran Kurang"
    payment_shortage: int = 0
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class OrderCreate(BaseModel):
    customer_name: str
    customer_email: str = ""
    customer_phone: str
    book_ids: List[str] = []
    items: List[OrderItemInput] = []
    order_type: str = "digital"
    address: str = ""
    city: str = ""
    province: str = ""
    postal_code: str = ""
    region: str = ""
    notes: str = ""
    voucher_code: str = ""


class OrderResponse(BaseModel):
    order: Order
    whatsapp_url: str


class ConfirmPaymentInput(BaseModel):
    method: str
    proof: str  # data URL of the payment screenshot
    payment_amount: Optional[int] = None


class StatusUpdate(BaseModel):
    status: str


class LoginInput(BaseModel):
    email: str
    password: str


class Stats(BaseModel):
    total_orders: int
    paid_orders: int
    pending_orders: int
    revenue: int
    total_books: int


# ---------------- WhatsApp handoff ----------------

def build_wa_url(order: Order) -> str:
    number = os.environ.get("OWNER_WHATSAPP", "6285173290889")
    items_txt = "\n".join(
        f"- {i.title}{(' — ' + i.variant_label) if i.variant_label else ''} x{i.qty} ({rupiah(i.price)})"
        for i in order.items
    )
    if order.status == "lunas":
        pay_line = f"*Status Pembayaran:* LUNAS ({order.payment_method})"
    elif order.status == "menunggu_verifikasi":
        pay_line = f"*Status Pembayaran:* {order.payment_method} — bukti transfer sudah saya upload, mohon diverifikasi"
    else:
        pay_line = "*Status Pembayaran:* Menunggu pembayaran"
    if order.order_type == "fisik":
        msg = (
            "Halo Admin LAMIMI_ID, saya ingin konfirmasi pesanan buku fisik saya:\n\n"
            f"*No. Pesanan:* {order.order_number}\n"
            f"*Nama:* {order.customer_name}\n"
            f"*No. WhatsApp:* {order.customer_phone}\n"
            f"*Item:*\n{items_txt}\n"
            f"*Alamat Kirim (JNE):* {order.address}, {order.city}, {order.province} {order.postal_code}\n"
            f"*Wilayah:* {order.region} — Ongkir JNE {rupiah(order.shipping_cost)}\n"
            f"*Subtotal:* {rupiah(order.subtotal)}\n"
            f"*Total Bayar:* {rupiah(order.total)}\n"
            f"{pay_line}\n\n"
            "Mohon diproses ya. Terima kasih!"
        )
    else:
        msg = (
            "Halo Admin LAMIMI_ID, saya ingin konfirmasi pesanan ebook digital saya:\n\n"
            f"*No. Pesanan:* {order.order_number}\n"
            f"*Nama:* {order.customer_name}\n"
            f"*Email:* {order.customer_email}\n"
            f"*Item:*\n{items_txt}\n"
            f"*Total Bayar:* {rupiah(order.total)}\n"
            f"{pay_line}\n\n"
            "Mohon kirimkan link akses / file ebook ke email saya ya. Terima kasih!"
        )
    return f"https://wa.me/{number}?text={quote(msg)}"


# ---------------- Auth ----------------

async def get_admin(request: Request):
    token = request.cookies.get("access_token")
    auth = request.headers.get("Authorization", "")
    if not token and auth.startswith("Bearer "):
        token = auth[7:]
    if not token:
        raise HTTPException(status_code=401, detail="Belum masuk sebagai admin")
    try:
        payload = jwt.decode(token, jwt_secret(), algorithms=[JWT_ALGORITHM])
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Token tidak valid atau kedaluwarsa")
    user = await db.users.find_one({"id": payload["sub"]}, {"_id": 0, "password_hash": 0})
    if not user or user.get("role") != "admin":
        raise HTTPException(status_code=401, detail="Akses khusus admin")
    return user


async def seed_admin():
    email = os.environ.get("ADMIN_EMAIL", "admin@lamimi.id")
    password = os.environ.get("ADMIN_PASSWORD", "Windy_0803")
    existing = await db.users.find_one({"email": email})
    if existing is None:
        await db.users.insert_one({
            "id": str(uuid.uuid4()), "email": email, "name": "Admin LAMIMI_ID",
            "role": "admin", "password_hash": hash_password(password),
            "created_at": datetime.now(timezone.utc),
        })
    elif not verify_password(password, existing["password_hash"]):
        await db.users.update_one({"email": email}, {"$set": {"password_hash": hash_password(password)}})


# ---------------- Seed data ----------------

SHOPEE = os.environ.get("SHOPEE_URL", "https://s.shopee.co.id/8AV4Tsb6bM")

SAMPLE_BOOKS: list = []  # katalog asli diimport via import_catalog.py / seed_data.json

SAMPLE_REGIONS = [
    ShippingRegion(name="Jawa", cost=12000, eta="1-3 hari"),
    ShippingRegion(name="Sumatera", cost=25000, eta="2-5 hari"),
    ShippingRegion(name="Bali / Nusa Tenggara", cost=28000, eta="3-5 hari"),
    ShippingRegion(name="Kalimantan", cost=35000, eta="3-6 hari"),
    ShippingRegion(name="Sulawesi", cost=38000, eta="4-7 hari"),
    ShippingRegion(name="Papua / Maluku", cost=55000, eta="5-10 hari"),
]

SAMPLE_PAYMENT_METHODS = [
    PaymentMethod(name="Transfer BCA", account_name="Windy Destiny Tarmidi", account_number="1673204663"),
    PaymentMethod(name="Seabank", account_name="Windy Destiny Tarmidi", account_number="901485568151"),
    PaymentMethod(name="GoPay / OVO", account_name="Windy Destiny Tarmidi", account_number="085173290889"),
    PaymentMethod(name="ShopeePay", account_name="Windy Destiny Tarmidi", account_number="085173413197"),
    PaymentMethod(name="QRIS", account_name="Scan barcode QRIS", account_number=""),
]

SEED_FILE = ROOT_DIR / "seed_data.json"


async def seed_collection(name: str, fallback: list, file_data: dict):
    if await db[name].count_documents({}) > 0:
        return
    data = file_data.get(name) or [x.model_dump() for x in fallback]
    if data:
        await db[name].insert_many(data)


def slugify(value: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", value.strip().lower())
    return slug.strip("-")


async def seed_languages_and_categories_from_defaults():
    default_languages = [
        {"id": str(uuid.uuid4()), "name": "Mandarin", "slug": "mandarin", "label": "Mandarin", "description": "Bahasa Mandarin", "active": True, "created_at": datetime.now(timezone.utc)},
        {"id": str(uuid.uuid4()), "name": "Korea", "slug": "korea", "label": "Korea", "description": "Bahasa Korea", "active": True, "created_at": datetime.now(timezone.utc)},
        {"id": str(uuid.uuid4()), "name": "Jepang", "slug": "jepang", "label": "Jepang", "description": "Bahasa Jepang", "active": True, "created_at": datetime.now(timezone.utc)},
        {"id": str(uuid.uuid4()), "name": "Inggris", "slug": "inggris", "label": "Inggris", "description": "Bahasa Inggris", "active": True, "created_at": datetime.now(timezone.utc)},
    ]
    default_categories = [
        {"id": str(uuid.uuid4()), "name": "Best Seller", "slug": "best-seller", "description": "Produk paling laris", "parent": "", "active": True, "created_at": datetime.now(timezone.utc)},
        {"id": str(uuid.uuid4()), "name": "Ebook Serba 5rb", "slug": "serba-5rb", "description": "Semua ebook Rp 5.000", "parent": "", "active": True, "created_at": datetime.now(timezone.utc)},
        {"id": str(uuid.uuid4()), "name": "Mandarin Bisnis", "slug": "mandarin-bisnis", "description": "BCT, business Chinese, medical Chinese", "parent": "mandarin", "active": True, "created_at": datetime.now(timezone.utc)},
        {"id": str(uuid.uuid4()), "name": "Mandarin Taiwan", "slug": "mandarin-taiwan", "description": "Contemporary Chinese & materi Taiwan", "parent": "mandarin", "active": True, "created_at": datetime.now(timezone.utc)},
        {"id": str(uuid.uuid4()), "name": "Mandarin for Kids", "slug": "mandarin-anak", "description": "Chinese Made Easy, Mei Hua, dll", "parent": "mandarin", "active": True, "created_at": datetime.now(timezone.utc)},
        {"id": str(uuid.uuid4()), "name": "PPT HSK Versi Lama", "slug": "ppt-hsk-lama", "description": "Slide PPT HSK 1-6 versi lama", "parent": "mandarin", "active": True, "created_at": datetime.now(timezone.utc)},
        {"id": str(uuid.uuid4()), "name": "Mandarin Lainnya", "slug": "mandarin-lainnya", "description": "Koleksi Mandarin umum & tematik", "parent": "mandarin", "active": True, "created_at": datetime.now(timezone.utc)},
        {"id": str(uuid.uuid4()), "name": "Korean Corner", "slug": "korean-corner", "description": "TTMIK, TOPIK, KGIU, dll", "parent": "korea", "active": True, "created_at": datetime.now(timezone.utc)},
        {"id": str(uuid.uuid4()), "name": "Korean Business", "slug": "korea-bisnis", "description": "Korea untuk bisnis & karier", "parent": "korea", "active": True, "created_at": datetime.now(timezone.utc)},
        {"id": str(uuid.uuid4()), "name": "Japan Corner", "slug": "japan-corner", "description": "JLPT, Irodori, dll", "parent": "jepang", "active": True, "created_at": datetime.now(timezone.utc)},
        {"id": str(uuid.uuid4()), "name": "English Corner", "slug": "english-corner", "description": "Grammar, IELTS, conversation", "parent": "inggris", "active": True, "created_at": datetime.now(timezone.utc)},
        {"id": str(uuid.uuid4()), "name": "English Business", "slug": "inggris-bisnis", "description": "Inggris untuk bisnis", "parent": "inggris", "active": True, "created_at": datetime.now(timezone.utc)},
    ]
    if await db.language_entries.count_documents({}) == 0:
        await db.language_entries.insert_many(default_languages)
    if await db.book_categories.count_documents({}) == 0:
        await db.book_categories.insert_many(default_categories)


async def seed_data():
    await seed_admin()
    file_data: dict = {}
    if SEED_FILE.exists():
        try:
            file_data = json.loads(SEED_FILE.read_text())
        except Exception as exc:
            logger.error("seed_data.json unreadable: %s", exc)
    await seed_collection("books", SAMPLE_BOOKS, file_data)
    await seed_collection("shipping_regions", SAMPLE_REGIONS, file_data)
    await seed_collection("payment_methods", SAMPLE_PAYMENT_METHODS, file_data)
    await seed_languages_and_categories_from_defaults()


@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.index_task = asyncio.create_task(ensure_indexes())
    asyncio.create_task(seed_data())
    yield
    client.close()


app = FastAPI(lifespan=lifespan)
app.mount("/uploads", StaticFiles(directory=ROOT_DIR / "uploads"), name="uploads")
api_router = APIRouter(prefix="/api")


# ---------------- Public routes ----------------

@api_router.get("/")
async def root():
    return {"message": "LAMIMI_ID API"}


@api_router.get("/books", response_model=List[Book])
async def list_books(type: Optional[str] = None, language: Optional[str] = None, featured: Optional[bool] = None):
    query: dict = {}
    if type:
        query["type"] = type
    if language:
        query["language"] = language
    if featured is not None:
        query["featured"] = featured
    docs = await db.books.find(query, {"_id": 0}).to_list(500)
    return [Book(**d) for d in docs]


@api_router.get("/books/{book_id}", response_model=Book)
async def get_book(book_id: str):
    doc = await db.books.find_one({"id": book_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Buku tidak ditemukan")
    return Book(**doc)


@api_router.get("/shipping", response_model=List[ShippingRegion])
async def list_shipping():
    docs = await db.shipping_regions.find({}, {"_id": 0}).to_list(50)
    return [ShippingRegion(**d) for d in docs]


@api_router.get("/payment-methods", response_model=List[PaymentMethod])
async def list_payment_methods():
    docs = await db.payment_methods.find({"active": True}, {"_id": 0}).to_list(50)
    return [PaymentMethod(**d) for d in docs]


@api_router.get("/languages", response_model=List[LanguageEntry])
async def list_languages():
    docs = await db.language_entries.find({}, {"_id": 0}).sort("name", 1).to_list(200)
    return [LanguageEntry(**d) for d in docs]


@api_router.get("/categories", response_model=List[BookCategory])
async def list_categories():
    docs = await db.book_categories.find({"active": True}, {"_id": 0}).sort("name", 1).to_list(200)
    return [BookCategory(**d) for d in docs]


@api_router.post("/orders", response_model=OrderResponse)
async def create_order(payload: OrderCreate):
    wanted = payload.items or [OrderItemInput(book_id=i) for i in payload.book_ids]
    if not wanted:
        raise HTTPException(status_code=400, detail="Keranjang kosong")
    unique_ids = list(dict.fromkeys(w.book_id for w in wanted))
    docs = await db.books.find({"id": {"$in": unique_ids}}, {"_id": 0}).to_list(100)
    by_id = {d["id"]: d for d in docs}
    items: List[OrderItem] = []
    for w in wanted:
        d = by_id.get(w.book_id)
        if not d:
            raise HTTPException(status_code=404, detail="Buku tidak ditemukan")
        qty = max(1, w.qty)
        price = d["price"]
        vlabel = ""
        if w.variant_id:
            variant = next((x for x in d.get("variants", []) if x.get("id") == w.variant_id), None)
            if not variant:
                raise HTTPException(status_code=400, detail="Variasi tidak ditemukan")
            price = variant["price"]
            vlabel = variant.get("label", "")
            stock = normalize_stock(variant.get("stock", -1))
            if stock >= 0:
                if stock <= 0:
                    raise HTTPException(status_code=400, detail=f"Stok habis: {d['title']} ({vlabel})")
                await db.books.update_one({"id": d["id"], "variants.id": w.variant_id}, {"$inc": {"variants.$.stock": -1}})
        else:
            stock = normalize_stock(d.get("stock", -1))
            if stock >= 0:
                if stock <= 0:
                    raise HTTPException(status_code=400, detail=f"Stok habis: {d['title']}")
                await db.books.update_one({"id": d["id"]}, {"$inc": {"stock": -1}})
        items.append(OrderItem(book_id=d["id"], title=d["title"], price=price, qty=qty, variant_id=w.variant_id, variant_label=vlabel))

    subtotal = sum(i.price * i.qty for i in items)
    shipping = 0
    if payload.order_type == "fisik":
        region = await db.shipping_regions.find_one({"name": payload.region}, {"_id": 0})
        if not region:
            raise HTTPException(status_code=400, detail="Wilayah pengiriman tidak valid")
        physical_units = sum(i.qty for i in items)
        shipping_multiplier = max(1, math.ceil(physical_units / 5))
        shipping = region["cost"] * shipping_multiplier

    discount_amount = 0
    voucher_code = (payload.voucher_code or "").strip().upper()
    voucher = None
    if voucher_code:
        voucher = await db.vouchers.find_one({"code": voucher_code, "active": True}, {"_id": 0})
        if not voucher:
            raise HTTPException(status_code=400, detail="Kode voucher tidak valid atau sudah tidak berlaku")
        now = datetime.now(timezone.utc)
        valid_from = normalize_datetime_for_compare(voucher.get("valid_from"))
        valid_until = normalize_datetime_for_compare(voucher.get("valid_until"))
        if valid_from and valid_from > now:
            raise HTTPException(status_code=400, detail="Kode voucher belum berlaku")
        if valid_until and valid_until < now:
            raise HTTPException(status_code=400, detail="Kode voucher sudah kadaluarsa")
        if voucher.get("discount_type") == "percent":
            discount_amount = int(subtotal + shipping) * int(voucher.get("discount_value", 0)) // 100
        else:
            discount_amount = int(voucher.get("discount_value", 0))
        if discount_amount < 0:
            discount_amount = 0

    total = subtotal + shipping - discount_amount
    if total < 0:
        total = 0

    order = Order(
        customer_name=payload.customer_name, customer_email=payload.customer_email,
        customer_phone=payload.customer_phone, items=items, order_type=payload.order_type,
        address=payload.address, city=payload.city, province=payload.province,
        postal_code=payload.postal_code, region=payload.region, notes=payload.notes,
        shipping_cost=shipping, subtotal=subtotal, discount_amount=discount_amount,
        total=total, voucher_code=voucher_code,
    )
    await db.orders.insert_one(order.model_dump())
    return OrderResponse(order=order, whatsapp_url=build_wa_url(order))


@api_router.get("/orders/{order_number}", response_model=OrderResponse)
async def get_order(order_number: str):
    doc = await db.orders.find_one({"order_number": order_number.upper()}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Pesanan tidak ditemukan")
    order = Order(**doc)
    return OrderResponse(order=order, whatsapp_url=build_wa_url(order))


@api_router.post("/orders/{order_number}/confirm-payment", response_model=OrderResponse)
async def confirm_payment(order_number: str, payload: ConfirmPaymentInput):
    if not payload.method.strip():
        raise HTTPException(status_code=400, detail="Pilih metode pembayaran dulu")
    if not payload.proof.startswith("data:image") or len(payload.proof) < 50:
        raise HTTPException(status_code=400, detail="Bukti pembayaran wajib diupload")
    doc = await db.orders.find_one({"order_number": order_number.upper()}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Pesanan tidak ditemukan")

    total = int(doc.get("total", 0))
    received = payload.payment_amount
    if received is None:
        received = extract_payment_amount_from_proof_image(payload.proof)

    # Important: OCR failure is not a valid proof of exact/over payment. Never
    # default a missing parsed number to the order total because that causes false
    # acceptance of a short or unreadable payment screenshot.
    received_from_ocr = normalize_received_amount(total, received)

    payment_status, payment_shortage = evaluate_payment_verification(total, int(received_from_ocr))

    await db.orders.update_one(
        {"order_number": order_number.upper()},
        {"$set": {
            "status": "menunggu_verifikasi",
            "payment_method": f"{payload.method} (Transfer Manual)",
            "payment_proof": payload.proof,
            "payment_received_amount": int(received_from_ocr),
            "payment_status": payment_status,
            "payment_shortage": payment_shortage,
        }},
    )
    doc["status"] = "menunggu_verifikasi"
    doc["payment_method"] = f"{payload.method} (Transfer Manual)"
    doc["payment_proof"] = payload.proof
    doc["payment_received_amount"] = int(received_from_ocr)
    doc["payment_status"] = payment_status
    doc["payment_shortage"] = payment_shortage
    order = Order(**doc)
    return OrderResponse(order=order, whatsapp_url=build_wa_url(order))


# ---------------- Upload routes ----------------

@api_router.post("/admin/upload-cover")
async def admin_upload_cover(file: UploadFile = File(...), user=Depends(get_admin)):
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File harus berupa gambar.")

    data = await file.read()
    if len(data) > 2 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Ukuran gambar maksimal 2 MB.")

    payload_ext = Path(file.filename or "cover.jpg").suffix.lower()
    if payload_ext not in {".jpg", ".jpeg", ".png", ".webp"}:
        raise HTTPException(status_code=400, detail="Format gambar tidak didukung.")

    upload_dir = ROOT_DIR / "uploads" / "covers"
    upload_dir.mkdir(parents=True, exist_ok=True)

    filename = f"{uuid.uuid4().hex}{payload_ext}"
    target = upload_dir / filename
    target.write_bytes(data)

    return {"cover_url": f"/uploads/covers/{filename}"}


# ---------------- Auth routes ----------------

@api_router.post("/auth/login")
async def login(payload: LoginInput, response: Response):
    email = payload.email.strip().lower()
    identifier = f"admin:{email}"
    attempts = await db.login_attempts.find_one({"identifier": identifier})
    now = datetime.now(timezone.utc)
    if attempts and attempts.get("locked_until"):
        locked_until = attempts["locked_until"]
        if locked_until.tzinfo is None:
            locked_until = locked_until.replace(tzinfo=timezone.utc)
        if locked_until > now:
            raise HTTPException(status_code=429, detail="Terlalu banyak percobaan. Coba lagi 15 menit.")
    user = await db.users.find_one({"email": email})
    if not user or not verify_password(payload.password, user["password_hash"]):
        await db.login_attempts.update_one(
            {"identifier": identifier},
            {"$inc": {"count": 1}, "$set": {"locked_until": now + timedelta(minutes=15) if (attempts or {}).get("count", 0) + 1 >= 5 else None}},
            upsert=True,
        )
        raise HTTPException(status_code=401, detail="Email atau kata sandi salah")
    await db.login_attempts.delete_one({"identifier": identifier})
    token = create_access_token(user["id"], email)
    response.set_cookie(key="access_token", value=token, httponly=True, samesite="lax", max_age=43200, path="/")
    return {"user": {"id": user["id"], "email": email, "name": user.get("name", "Admin"), "role": user["role"]}, "token": token}


@api_router.get("/auth/me")
async def auth_me(user=Depends(get_admin)):
    return user


@api_router.post("/auth/logout")
async def logout(response: Response):
    response.delete_cookie("access_token", path="/")
    return {"ok": True}


# ---------------- Admin routes ----------------

@api_router.get("/admin/stats", response_model=Stats)
async def admin_stats(user=Depends(get_admin)):
    total = await db.orders.count_documents({})
    paid = await db.orders.count_documents({"status": {"$in": PAID_STATUSES}})
    pipeline = [{"$match": {"status": {"$in": PAID_STATUSES}}}, {"$group": {"_id": None, "sum": {"$sum": "$total"}}}]
    agg = await db.orders.aggregate(pipeline).to_list(1)
    return Stats(
        total_orders=total, paid_orders=paid, pending_orders=total - paid,
        revenue=agg[0]["sum"] if agg else 0,
        total_books=await db.books.count_documents({}),
    )


@api_router.get("/admin/orders", response_model=List[Order])
async def admin_orders(
    type: Optional[str] = None,
    status: Optional[str] = None,
    search: Optional[str] = None,
    date: Optional[str] = None,
    user=Depends(get_admin),
):
    query: dict = {}
    if type:
        query["order_type"] = type
    if status:
        query["status"] = status

    if search:
        term = search.strip()
        if term:
            query["$or"] = [
                {"customer_name": {"$regex": re.escape(term), "$options": "i"}},
                {"order_number": {"$regex": re.escape(term), "$options": "i"}},
            ]

    if date:
        try:
            parsed = datetime.fromisoformat(date)
            start = datetime.combine(parsed.date(), time.min).replace(tzinfo=timezone.utc)
            end = start + timedelta(days=1)
            query["created_at"] = {"$gte": start, "$lt": end}
        except Exception:
            query["created_at"] = {"$exists": True}

    docs = await db.orders.find(query, {"_id": 0}).sort("created_at", -1).to_list(1000)
    return [Order(**d) for d in docs]


@api_router.post("/admin/languages", response_model=LanguageEntry)
async def admin_create_language(payload: LanguageInput, user=Depends(get_admin)):
    raw = payload.model_dump()
    raw["slug"] = slugify(raw.get("slug") or raw.get("name", ""))
    raw["name"] = raw["name"].strip()
    if not raw["name"]:
        raise HTTPException(status_code=400, detail="Nama bahasa wajib diisi")
    if await db.language_entries.find_one({"slug": raw["slug"]}):
        raise HTTPException(status_code=409, detail="Bahasa dengan slug ini sudah ada")
    doc = LanguageEntry(**raw)
    await db.language_entries.insert_one(doc.model_dump())
    return doc


@api_router.put("/admin/languages/{language_id}", response_model=LanguageEntry)
async def admin_update_language(language_id: str, payload: LanguageInput, user=Depends(get_admin)):
    raw = payload.model_dump()
    raw["slug"] = slugify(raw.get("slug") or raw.get("name", ""))
    raw["name"] = raw["name"].strip()
    if not raw["name"]:
        raise HTTPException(status_code=400, detail="Nama bahasa wajib diisi")
    existing = await db.language_entries.find_one({"id": language_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Bahasa tidak ditemukan")
    if await db.language_entries.find_one({"slug": raw["slug"], "id": {"$ne": language_id}}):
        raise HTTPException(status_code=409, detail="Bahasa dengan slug ini sudah ada")
    result = await db.language_entries.update_one({"id": language_id}, {"$set": raw})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Bahasa tidak ditemukan")
    doc = await db.language_entries.find_one({"id": language_id}, {"_id": 0})
    return LanguageEntry(**doc)


@api_router.delete("/admin/languages/{language_id}")
async def admin_delete_language(language_id: str, user=Depends(get_admin)):
    result = await db.language_entries.delete_one({"id": language_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Bahasa tidak ditemukan")
    return {"ok": True}


@api_router.post("/admin/categories", response_model=BookCategory)
async def admin_create_category(payload: BookCategoryInput, user=Depends(get_admin)):
    raw = payload.model_dump()
    raw["slug"] = slugify(raw.get("slug") or raw.get("name", ""))
    raw["name"] = raw["name"].strip()
    if not raw["name"]:
        raise HTTPException(status_code=400, detail="Nama kategori wajib diisi")
    if await db.book_categories.find_one({"slug": raw["slug"]}):
        raise HTTPException(status_code=409, detail="Kategori dengan slug ini sudah ada")
    doc = BookCategory(**raw)
    await db.book_categories.insert_one(doc.model_dump())
    return doc


@api_router.put("/admin/categories/{category_id}", response_model=BookCategory)
async def admin_update_category(category_id: str, payload: BookCategoryInput, user=Depends(get_admin)):
    raw = payload.model_dump()
    raw["slug"] = slugify(raw.get("slug") or raw.get("name", ""))
    raw["name"] = raw["name"].strip()
    if not raw["name"]:
        raise HTTPException(status_code=400, detail="Nama kategori wajib diisi")
    existing = await db.book_categories.find_one({"id": category_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Kategori tidak ditemukan")
    if await db.book_categories.find_one({"slug": raw["slug"], "id": {"$ne": category_id}}):
        raise HTTPException(status_code=409, detail="Kategori dengan slug ini sudah ada")
    result = await db.book_categories.update_one({"id": category_id}, {"$set": raw})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Kategori tidak ditemukan")
    doc = await db.book_categories.find_one({"id": category_id}, {"_id": 0})
    return BookCategory(**doc)


@api_router.delete("/admin/categories/{category_id}")
async def admin_delete_category(category_id: str, user=Depends(get_admin)):
    result = await db.book_categories.delete_one({"id": category_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Kategori tidak ditemukan")
    return {"ok": True}


@api_router.get("/admin/languages", response_model=List[LanguageEntry])
async def admin_list_languages(user=Depends(get_admin)):
    docs = await db.language_entries.find({}, {"_id": 0}).sort("name", 1).to_list(200)
    return [LanguageEntry(**d) for d in docs]


@api_router.get("/admin/categories", response_model=List[BookCategory])
async def admin_list_categories(user=Depends(get_admin)):
    docs = await db.book_categories.find({}, {"_id": 0}).sort("name", 1).to_list(200)
    return [BookCategory(**d) for d in docs]


@api_router.patch("/admin/orders/{order_id}", response_model=Order)
async def admin_update_order(order_id: str, payload: StatusUpdate, user=Depends(get_admin)):
    if payload.status not in ORDER_STATUSES:
        raise HTTPException(status_code=400, detail="Status tidak valid")
    doc_before = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not doc_before:
        raise HTTPException(status_code=404, detail="Pesanan tidak ditemukan")
    await db.orders.update_one({"id": order_id}, {"$set": {"status": payload.status}})
    # kembalikan stok jika pesanan dibatalkan
    if payload.status == "dibatalkan" and doc_before.get("status") != "dibatalkan":
        for item in doc_before.get("items", []):
            if item.get("variant_id"):
                await db.books.update_one(
                    {"id": item["book_id"], "variants.id": item["variant_id"]},
                    {"$inc": {"variants.$.stock": 1}},
                )
            else:
                await db.books.update_one(
                    {"id": item["book_id"], "stock": {"$gte": 0}},
                    {"$inc": {"stock": 1}},
                )
    doc = await db.orders.find_one({"id": order_id}, {"_id": 0})
    return Order(**doc)


@api_router.post("/admin/books", response_model=Book)
async def admin_create_book(payload: BookInput, user=Depends(get_admin)):
    raw = payload.model_dump()
    raw["stock"] = normalize_stock(raw.get("stock", -1))
    for variant in raw.get("variants", []):
        variant["stock"] = normalize_stock(variant.get("stock", -1))
    book = Book(**raw)
    await db.books.insert_one(book.model_dump())
    return book


@api_router.put("/admin/books/{book_id}", response_model=Book)
async def admin_update_book(book_id: str, payload: BookInput, user=Depends(get_admin)):
    raw = payload.model_dump()
    raw["stock"] = normalize_stock(raw.get("stock", -1))
    for variant in raw.get("variants", []):
        variant["stock"] = normalize_stock(variant.get("stock", -1))
    result = await db.books.update_one({"id": book_id}, {"$set": raw})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Buku tidak ditemukan")
    doc = await db.books.find_one({"id": book_id}, {"_id": 0})
    return Book(**doc)


@api_router.delete("/admin/books/{book_id}")
async def admin_delete_book(book_id: str, user=Depends(get_admin)):
    result = await db.books.delete_one({"id": book_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Buku tidak ditemukan")
    return {"ok": True}


@api_router.put("/admin/shipping/{region_id}", response_model=ShippingRegion)
async def admin_update_shipping(region_id: str, payload: ShippingInput, user=Depends(get_admin)):
    result = await db.shipping_regions.update_one({"id": region_id}, {"$set": payload.model_dump()})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Wilayah tidak ditemukan")
    doc = await db.shipping_regions.find_one({"id": region_id}, {"_id": 0})
    return ShippingRegion(**doc)


@api_router.get("/admin/payment-methods", response_model=List[PaymentMethod])
async def admin_list_payment_methods(user=Depends(get_admin)):
    docs = await db.payment_methods.find({}, {"_id": 0}).to_list(50)
    return [PaymentMethod(**d) for d in docs]


@api_router.put("/admin/payment-methods/{method_id}", response_model=PaymentMethod)
async def admin_update_payment_method(method_id: str, payload: PaymentMethodInput, user=Depends(get_admin)):
    result = await db.payment_methods.update_one({"id": method_id}, {"$set": payload.model_dump()})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Metode pembayaran tidak ditemukan")
    doc = await db.payment_methods.find_one({"id": method_id}, {"_id": 0})
    return PaymentMethod(**doc)


@api_router.get("/admin/vouchers", response_model=List[Voucher])
async def admin_list_vouchers(user=Depends(get_admin)):
    docs = await db.vouchers.find({}, {"_id": 0}).sort("created_at", -1).to_list(200)
    return [Voucher(**d) for d in docs]


@api_router.post("/admin/vouchers", response_model=Voucher)
async def admin_create_voucher(payload: VoucherInput, user=Depends(get_admin)):
    raw = payload.model_dump()
    raw["code"] = raw.get("code", "").strip().upper()
    if not raw["code"]:
        raise HTTPException(status_code=400, detail="Kode voucher wajib diisi")
    if await db.vouchers.find_one({"code": raw["code"]}):
        raise HTTPException(status_code=409, detail="Kode voucher sudah ada")
    if raw["discount_type"] not in {"amount", "percent"}:
        raise HTTPException(status_code=400, detail="Tipe diskon tidak valid")
    if raw["discount_value"] < 0:
        raise HTTPException(status_code=400, detail="Nilai diskon tidak valid")
    doc = Voucher(**raw)
    await db.vouchers.insert_one(doc.model_dump())
    return doc


@api_router.put("/admin/vouchers/{voucher_id}", response_model=Voucher)
async def admin_update_voucher(voucher_id: str, payload: VoucherInput, user=Depends(get_admin)):
    raw = payload.model_dump()
    raw["code"] = raw.get("code", "").strip().upper()
    if not raw["code"]:
        raise HTTPException(status_code=400, detail="Kode voucher wajib diisi")
    existing = await db.vouchers.find_one({"id": voucher_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Voucher tidak ditemukan")
    if await db.vouchers.find_one({"code": raw["code"], "id": {"$ne": voucher_id}}):
        raise HTTPException(status_code=409, detail="Kode voucher sudah ada")
    if raw["discount_type"] not in {"amount", "percent"}:
        raise HTTPException(status_code=400, detail="Tipe diskon tidak valid")
    if raw["discount_value"] < 0:
        raise HTTPException(status_code=400, detail="Nilai diskon tidak valid")
    result = await db.vouchers.update_one({"id": voucher_id}, {"$set": raw})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Voucher tidak ditemukan")
    doc = await db.vouchers.find_one({"id": voucher_id}, {"_id": 0})
    return Voucher(**doc)


@api_router.delete("/admin/vouchers/{voucher_id}")
async def admin_delete_voucher(voucher_id: str, user=Depends(get_admin)):
    result = await db.vouchers.delete_one({"id": voucher_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Voucher tidak ditemukan")
    return {"ok": True}


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')

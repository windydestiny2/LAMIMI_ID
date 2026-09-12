import asyncio
import json
import os
import uuid
import logging
from contextlib import asynccontextmanager
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import List, Optional
from urllib.parse import quote

import bcrypt
import jwt
from dotenv import load_dotenv
from fastapi import FastAPI, APIRouter, HTTPException, Request, Response, Depends
from pydantic import BaseModel, Field
from starlette.middleware.cors import CORSMiddleware

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

from lib.db import client, db, ensure_indexes

logger = logging.getLogger(__name__)
JWT_ALGORITHM = "HS256"
ORDER_STATUSES = ["menunggu_pembayaran", "menunggu_verifikasi", "lunas", "diproses", "dikirim", "selesai", "dibatalkan"]
PAID_STATUSES = ["menunggu_verifikasi", "lunas", "diproses", "dikirim", "selesai"]


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
    total: int = 0
    status: str = "menunggu_pembayaran"
    payment_method: str = ""
    payment_proof: str = ""
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


class OrderResponse(BaseModel):
    order: Order
    whatsapp_url: str


class ConfirmPaymentInput(BaseModel):
    method: str
    proof: str  # data URL of the payment screenshot


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


@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.index_task = asyncio.create_task(ensure_indexes())
    asyncio.create_task(seed_data())
    yield
    client.close()


app = FastAPI(lifespan=lifespan)
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
        price = d["price"]
        vlabel = ""
        if w.variant_id:
            variant = next((x for x in d.get("variants", []) if x.get("id") == w.variant_id), None)
            if not variant:
                raise HTTPException(status_code=400, detail="Variasi tidak ditemukan")
            price = variant["price"]
            vlabel = variant.get("label", "")
            stock = variant.get("stock", -1)
            if stock >= 0:
                if stock <= 0:
                    raise HTTPException(status_code=400, detail=f"Stok habis: {d['title']} ({vlabel})")
                await db.books.update_one({"id": d["id"], "variants.id": w.variant_id}, {"$inc": {"variants.$.stock": -1}})
        else:
            stock = d.get("stock", -1)
            if stock >= 0:
                if stock <= 0:
                    raise HTTPException(status_code=400, detail=f"Stok habis: {d['title']}")
                await db.books.update_one({"id": d["id"]}, {"$inc": {"stock": -1}})
        items.append(OrderItem(book_id=d["id"], title=d["title"], price=price, variant_id=w.variant_id, variant_label=vlabel))
    subtotal = sum(i.price * i.qty for i in items)
    shipping = 0
    if payload.order_type == "fisik":
        region = await db.shipping_regions.find_one({"name": payload.region}, {"_id": 0})
        if not region:
            raise HTTPException(status_code=400, detail="Wilayah pengiriman tidak valid")
        shipping = region["cost"]
    order = Order(
        customer_name=payload.customer_name, customer_email=payload.customer_email,
        customer_phone=payload.customer_phone, items=items, order_type=payload.order_type,
        address=payload.address, city=payload.city, province=payload.province,
        postal_code=payload.postal_code, region=payload.region, notes=payload.notes,
        shipping_cost=shipping, subtotal=subtotal, total=subtotal + shipping,
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
    await db.orders.update_one(
        {"order_number": order_number.upper()},
        {"$set": {
            "status": "menunggu_verifikasi",
            "payment_method": f"{payload.method} (Transfer Manual)",
            "payment_proof": payload.proof,
        }},
    )
    doc["status"] = "menunggu_verifikasi"
    doc["payment_method"] = f"{payload.method} (Transfer Manual)"
    order = Order(**doc)
    return OrderResponse(order=order, whatsapp_url=build_wa_url(order))


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
async def admin_orders(type: Optional[str] = None, status: Optional[str] = None, user=Depends(get_admin)):
    query: dict = {}
    if type:
        query["order_type"] = type
    if status:
        query["status"] = status
    docs = await db.orders.find(query, {"_id": 0}).sort("created_at", -1).to_list(1000)
    return [Order(**d) for d in docs]


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
    book = Book(**payload.model_dump())
    await db.books.insert_one(book.model_dump())
    return book


@api_router.put("/admin/books/{book_id}", response_model=Book)
async def admin_update_book(book_id: str, payload: BookInput, user=Depends(get_admin)):
    result = await db.books.update_one({"id": book_id}, {"$set": payload.model_dump()})
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


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')

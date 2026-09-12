import asyncio
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
ORDER_STATUSES = ["menunggu_pembayaran", "lunas", "diproses", "dikirim", "selesai", "dibatalkan"]


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


class ShippingRegion(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    cost: int
    eta: str = ""


class ShippingInput(BaseModel):
    name: str
    cost: int
    eta: str = ""


class OrderItem(BaseModel):
    book_id: str
    title: str
    price: int
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
    total: int = 0
    status: str = "menunggu_pembayaran"
    payment_method: str = ""
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class OrderCreate(BaseModel):
    customer_name: str
    customer_email: str = ""
    customer_phone: str
    book_ids: List[str]
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


class PayInput(BaseModel):
    method: str = "QRIS"


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
    items_txt = "\n".join(f"- {i.title} x{i.qty} ({rupiah(i.price)})" for i in order.items)
    pay_line = f"*Status Pembayaran:* LUNAS ({order.payment_method or 'Simulasi Midtrans'})" if order.status == "lunas" else "*Status Pembayaran:* Menunggu pembayaran"
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
    password = os.environ.get("ADMIN_PASSWORD", "LamimiAdmin123")
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

IMG = "https://static.prod-images.emergentagent.com/jobs/51f7e078-38c7-42d6-91d5-1c65bce9bd40/images"
SHOPEE = os.environ.get("SHOPEE_URL", "https://s.shopee.co.id/8AV4Tsb6bM")

SAMPLE_BOOKS = [
    Book(title="Mandarin Dasar untuk Pemula", author="Tim LAMIMI_ID", language="mandarin", type="digital",
         price=49000, badge="HSK 1-2", featured=True,
         cover_url=f"{IMG}/ac1ef3c766e43024e4b70d77ec810b7bc8734f692a9aeb7e3c133a2a5b577e09.jpeg",
         description="Panduan lengkap memulai bahasa Mandarin dari nol: pinyin, nada, salam, dan percakapan sehari-hari dengan latihan interaktif."),
    Book(title="HSK 1-3 Kosa Kata Lengkap", author="Tim LAMIMI_ID", language="mandarin", type="digital",
         price=59000, badge="600+ Kata",
         cover_url=f"{IMG}/f236a12bc92b824280cd537275837eef7561a334dcbb61164609823f6df34ef7.jpeg",
         description="Bank kosa kata HSK level 1-3 dengan contoh kalimat, audio pinyin tertulis, dan tips menghafal karakter Hanzi."),
    Book(title="Korea Pemula: Hangul & Percakapan", author="Tim LAMIMI_ID", language="korea", type="digital",
         price=49000, badge="TOPIK I", featured=True,
         cover_url=f"{IMG}/c0461f8e0ee6c8ec0ce6e7906e26fdc9682de9545f111029e9673c0881cd2770.jpeg",
         description="Kuasai Hangul dalam 7 hari, lalu lanjut ke pola kalimat dasar dan percakapan sehari-hari ala Korea."),
    Book(title="TOPIK I-II Persiapan Ujian", author="Tim LAMIMI_ID", language="korea", type="digital",
         price=69000, badge="Bank Soal",
         cover_url=f"{IMG}/9572710fa214c438abd5c053178a6a2b67f523fc6d92fa70183c74f5e3bb142f.jpeg",
         description="Strategi mengerjakan TOPIK I dan II: bank soal listening & reading, pembahasan, serta kosakata wajib ujian."),
    Book(title="Jepang Nihongo Dasar", author="Tim LAMIMI_ID", language="jepang", type="digital",
         price=49000, badge="JLPT N5", featured=True,
         cover_url=f"{IMG}/1d4fb1a1ccaf08157d2532daaf5b9da34f468c9ba14d92b0c513ff2fb36bc2f8.jpeg",
         description="Belajar hiragana, katakana, dan tata bahasa dasar Jepang dengan pendekatan santai dan latihan bertahap."),
    Book(title="Kanji N5-N4 Essential", author="Tim LAMIMI_ID", language="jepang", type="digital",
         price=59000, badge="300+ Kanji",
         cover_url=f"{IMG}/6b108484ccf5ea013be6ab63984b032ea866e819221db16c33922d871c198c24.jpeg",
         description="300+ kanji esensial level N5-N4 dengan cerita mnemonik, cara tulis, dan contoh penggunaan."),
    Book(title="English Grammar Komprehensif", author="Tim LAMIMI_ID", language="inggris", type="digital",
         price=45000, badge="16 Tenses", featured=True,
         cover_url=f"{IMG}/6b353c4f6f00d84c1899a802a272d2c06c14aca96848fcb9283c91ca80f1a6d1.jpeg",
         description="Semua tenses, struktur kalimat, dan grammar inti bahasa Inggris dijelaskan sederhana dengan contoh nyata."),
    Book(title="IELTS & TOEFL Essential Guide", author="Tim LAMIMI_ID", language="inggris", type="digital",
         price=79000, badge="Skor Tinggi",
         cover_url=f"{IMG}/0e6255168983be696fd005e66a148f818f90a9c07b69d047f7749f6f80627b11.jpeg",
         description="Panduan persiapan IELTS & TOEFL: strategi tiap section, template writing, dan daftar vocabulary akademik."),
    Book(title="Paket Buku Mandarin HSK 1-2 (Cetak)", author="LAMIMI Press", language="mandarin", type="fisik",
         price=135000, badge="Bestseller", featured=True, shopee_url=SHOPEE,
         cover_url="https://images.unsplash.com/photo-1514369118554-e20d93546b30?crop=entropy&cs=srgb&fm=jpg&w=900&q=80",
         description="Edisi cetak full color berisi materi HSK 1-2, latihan menulis karakter, dan CD audio digital. Dikirim via JNE."),
    Book(title="Workbook Korea: Hangeul Practice", author="LAMIMI Press", language="korea", type="fisik",
         price=98000, badge="Workbook", shopee_url=SHOPEE,
         cover_url="https://images.unsplash.com/photo-1673515334717-da4d85aaf38b?crop=entropy&cs=srgb&fm=jpg&w=900&q=80",
         description="Buku latihan tulis Hangeul dengan halaman praktik, stiker kosa kata, dan poster huruf. Dikirim via JNE."),
    Book(title="Buku Jepang: Nihongo Workbook N5", author="LAMIMI Press", language="jepang", type="fisik",
         price=145000, badge="Full Color", shopee_url=SHOPEE,
         cover_url="https://images.unsplash.com/photo-1688644707880-3d0df0fb2dc5?crop=entropy&cs=srgb&fm=jpg&w=900&q=80",
         description="Workbook cetak level N5: latihan kanji, tata bahasa, dan reading pendek dengan kunci jawaban. Dikirim via JNE."),
    Book(title="English Grammar in Practice (Cetak)", author="LAMIMI Press", language="inggris", type="fisik",
         price=112000, badge="Praktis", shopee_url=SHOPEE,
         cover_url="https://images.unsplash.com/photo-1578511161102-485cc0775c6b?crop=entropy&cs=srgb&fm=jpg&w=900&q=80",
         description="Buku cetak grammar praktis dengan 100+ latihan soal dan pembahasan. Cocok untuk persiapan ujian. Dikirim via JNE."),
]

SAMPLE_REGIONS = [
    ShippingRegion(name="Jawa", cost=12000, eta="1-3 hari"),
    ShippingRegion(name="Sumatera", cost=25000, eta="2-5 hari"),
    ShippingRegion(name="Bali / Nusa Tenggara", cost=28000, eta="3-5 hari"),
    ShippingRegion(name="Kalimantan", cost=35000, eta="3-6 hari"),
    ShippingRegion(name="Sulawesi", cost=38000, eta="4-7 hari"),
    ShippingRegion(name="Papua / Maluku", cost=55000, eta="5-10 hari"),
]


async def seed_data():
    await seed_admin()
    if await db.shipping_regions.count_documents({}) == 0:
        await db.shipping_regions.insert_many([r.model_dump() for r in SAMPLE_REGIONS])
    if await db.books.count_documents({}) == 0:
        await db.books.insert_many([b.model_dump() for b in SAMPLE_BOOKS])


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


@api_router.post("/orders", response_model=OrderResponse)
async def create_order(payload: OrderCreate):
    unique_ids = list(dict.fromkeys(payload.book_ids))
    docs = await db.books.find({"id": {"$in": unique_ids}}, {"_id": 0}).to_list(100)
    if len(docs) != len(unique_ids):
        raise HTTPException(status_code=404, detail="Buku tidak ditemukan")
    items = [OrderItem(book_id=d["id"], title=d["title"], price=d["price"]) for d in docs]
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


@api_router.post("/orders/{order_number}/pay", response_model=OrderResponse)
async def pay_order(order_number: str, payload: PayInput):
    doc = await db.orders.find_one({"order_number": order_number.upper()}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Pesanan tidak ditemukan")
    await db.orders.update_one(
        {"order_number": order_number.upper()},
        {"$set": {"status": "lunas", "payment_method": f"{payload.method} (Simulasi Midtrans)"}},
    )
    doc["status"] = "lunas"
    doc["payment_method"] = f"{payload.method} (Simulasi Midtrans)"
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
    paid = await db.orders.count_documents({"status": {"$in": ["lunas", "diproses", "dikirim", "selesai"]}})
    pipeline = [{"$match": {"status": {"$in": ["lunas", "diproses", "dikirim", "selesai"]}}}, {"$group": {"_id": None, "sum": {"$sum": "$total"}}}]
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
    result = await db.orders.update_one({"id": order_id}, {"$set": {"status": payload.status}})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Pesanan tidak ditemukan")
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


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')

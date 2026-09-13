"""Migrasi kategori & subkategori LAMIMI_ID.
- Mengganti kategori default (Novel/Buku Bahasa) dengan struktur subkategori asli toko.
- Mengassign 133 buku ke subkategori berdasarkan badge & bahasa dari katalog asli.
"""
import asyncio
import uuid
from datetime import datetime, timezone

from lib.db import db

CATEGORIES = [
    ("Best Seller", "best-seller", "", "Produk paling laris"),
    ("Ebook Serba 5rb", "serba-5rb", "", "Semua ebook Rp 5.000"),
    ("Mandarin Bisnis", "mandarin-bisnis", "mandarin", "BCT, business Chinese, medical Chinese"),
    ("Mandarin Taiwan", "mandarin-taiwan", "mandarin", "Contemporary Chinese & materi Taiwan"),
    ("Mandarin for Kids", "mandarin-anak", "mandarin", "Chinese Made Easy, Mei Hua, dll"),
    ("PPT HSK Versi Lama", "ppt-hsk-lama", "mandarin", "Slide PPT HSK 1-6 versi lama"),
    ("Mandarin Lainnya", "mandarin-lainnya", "mandarin", "Koleksi Mandarin umum & tematik"),
    ("Korean Corner", "korean-corner", "korea", "Koleksi Korea: TTMIK, TOPIK, KGIU, dll"),
    ("Korean Business", "korea-bisnis", "korea", "Korea untuk bisnis & karier"),
    ("Japan Corner", "japan-corner", "jepang", "Koleksi Jepang: JLPT, Irodori, dll"),
    ("English Corner", "english-corner", "inggris", "Koleksi Inggris: grammar, IELTS, conversation"),
    ("English Business", "inggris-bisnis", "inggris", "Inggris untuk bisnis"),
]


def categories_for(book: dict) -> list:
    if book.get("type") == "fisik":
        return []
    badge = book.get("badge", "")
    lang = book.get("language", "")
    if badge == "Best Seller":
        return ["best-seller"]
    if badge == "Serba 5rb":
        return ["serba-5rb"]
    if lang == "mandarin":
        return {
            "Bisnis": ["mandarin-bisnis"],
            "Taiwan": ["mandarin-taiwan"],
            "Anak-anak": ["mandarin-anak"],
            "PPT HSK Lama": ["ppt-hsk-lama"],
        }.get(badge, ["mandarin-lainnya"])
    if lang == "korea":
        return ["korea-bisnis"] if badge == "Bisnis" else ["korean-corner"]
    if lang == "jepang":
        return ["japan-corner"]
    if lang == "inggris":
        return ["inggris-bisnis"] if badge == "Bisnis" else ["english-corner"]
    return []


async def main():
    now = datetime.now(timezone.utc)
    await db.book_categories.delete_many({})
    docs = [
        {"id": str(uuid.uuid4()), "name": name, "slug": slug, "description": desc, "parent": parent, "active": True, "created_at": now}
        for name, slug, parent, desc in CATEGORIES
    ]
    await db.book_categories.insert_many(docs)
    print("kategori:", await db.book_categories.count_documents({}))

    updated = 0
    async for book in db.books.find({}, {"_id": 0}):
        cats = categories_for(book)
        await db.books.update_one({"id": book["id"]}, {"$set": {"categories": cats}})
        if cats:
            updated += 1
    print("buku ter-assign:", updated)


if __name__ == "__main__":
    asyncio.run(main())

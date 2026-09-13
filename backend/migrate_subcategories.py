"""Migrasi sub-subkategori: tandai parent_type existing + buat contoh Novel > Romance/Comedy/Slice of Life."""
import asyncio
import uuid
from datetime import datetime, timezone

from lib.db import db

NOVEL_CHILDREN = [("Romance", "romance"), ("Comedy", "comedy"), ("Slice of Life", "slice-of-life")]


async def main():
    now = datetime.now(timezone.utc)
    # kategori lama: parent = slug bahasa -> tandai sebagai parent_type "language"
    res = await db.book_categories.update_many(
        {"parent": {"$ne": ""}, "parent_type": {"$in": ["", None]}},
        {"$set": {"parent_type": "language"}},
    )
    print("parent_type language ditandai:", res.modified_count)

    novel = await db.book_categories.find_one({"slug": "novel"})
    if not novel:
        await db.book_categories.insert_one({
            "id": str(uuid.uuid4()), "name": "Novel", "slug": "novel",
            "description": "Koleksi novel", "parent": "", "parent_type": "",
            "active": True, "created_at": now,
        })
        print("kategori Novel dibuat")
    for name, slug in NOVEL_CHILDREN:
        exists = await db.book_categories.find_one({"slug": slug})
        if not exists:
            await db.book_categories.insert_one({
                "id": str(uuid.uuid4()), "name": name, "slug": slug,
                "description": f"Genre novel {name}", "parent": "novel", "parent_type": "category",
                "active": True, "created_at": now,
            })
            print("subkategori dibuat:", name)
    print("total kategori:", await db.book_categories.count_documents({}))


if __name__ == "__main__":
    asyncio.run(main())

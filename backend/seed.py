"""Manual reseed: clears books + shipping regions, reinserts samples, ensures admin."""
import asyncio

from lib.db import db, ensure_indexes
from server import SAMPLE_BOOKS, SAMPLE_REGIONS, seed_admin


async def main():
    await db.books.delete_many({})
    await db.shipping_regions.delete_many({})
    await db.books.insert_many([b.model_dump() for b in SAMPLE_BOOKS])
    await db.shipping_regions.insert_many([r.model_dump() for r in SAMPLE_REGIONS])
    await seed_admin()
    await ensure_indexes()
    print("Seeded books:", await db.books.count_documents({}))
    print("Seeded regions:", await db.shipping_regions.count_documents({}))


if __name__ == "__main__":
    asyncio.run(main())

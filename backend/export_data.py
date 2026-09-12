"""Export data live (books, shipping, payment methods, orders tanpa bukti) ke seed_data.json
agar project bisa jalan lokal dengan database terisi otomatis."""
import asyncio
import json
from pathlib import Path

from lib.db import db


async def main():
    out = {}
    for coll in ["books", "shipping_regions", "payment_methods"]:
        docs = await db[coll].find({}, {"_id": 0}).to_list(2000)
        out[coll] = docs
    orders = await db.orders.find({}, {"_id": 0, "payment_proof": 0}).to_list(2000)
    out["orders"] = orders
    path = Path(__file__).parent / "seed_data.json"
    path.write_text(json.dumps(out, default=str, ensure_ascii=False, indent=1))
    print("exported:", {k: len(v) for k, v in out.items()}, "->", path)


if __name__ == "__main__":
    asyncio.run(main())

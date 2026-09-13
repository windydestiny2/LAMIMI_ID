import { Link } from "react-router-dom";
import { motion } from "motion/react";
import { ShoppingCart, Store, Truck, Zap } from "lucide-react";
import { toast } from "sonner";
import { SiShopee, SiTiktok } from "@icons-pack/react-simple-icons";
import type { Book, Variant } from "@/lib/types";
import { LANGUAGE_META, SHOPEE_URL, WA_NUMBER } from "@/lib/types";
import { rupiah } from "@/lib/format";
import { addToCart } from "@/lib/cart";

export function marketplaceLinks(book: Book) {
  const wa = `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(`Halo Admin LAMIMI_ID, apakah buku "${book.title}" tersedia di marketplace?`)}`;
  return [
    { name: "Shopee", url: book.shopee_url || SHOPEE_URL, icon: <SiShopee size={13} /> },
    { name: "Tokopedia", url: book.tokopedia_url || wa, icon: <Store className="size-3.5" /> },
    { name: "TikTok", url: book.tiktok_url || wa, icon: <SiTiktok size={13} /> },
  ];
}

export function handleAddToCart(book: Book, variant?: Variant) {
  const requestedStock = variant ? variant.stock : book.stock;
  if (requestedStock === 0) {
    toast.error("Stok variasi ini sedang habis.");
    return;
  }

  const r = addToCart({
    key: `${book.id}:${variant?.id ?? ""}`,
    id: book.id,
    variant_id: variant?.id ?? "",
    variant_label: variant?.label ?? "",
    type: book.type,
    title: book.title,
    price: variant?.price ?? book.price,
    cover_url: book.cover_url,
    qty: 1,
    stock: variant?.stock ?? book.stock,
  });
  if (r.ok) toast.success(`"${book.title}${variant ? ` — ${variant.label}` : ""}" masuk keranjang`);
  else if (r.reason === "dupe") toast.error("Item ini sudah ada di keranjang.");
  else toast.error("Keranjang berisi jenis berbeda. Ebook dan buku fisik di-checkout terpisah — kosongkan keranjang dulu.");
}

export function BookCard({ book }: { book: Book }) {
  const meta = LANGUAGE_META[book.language];
  const isDigital = book.type === "digital";
  const hasVariants = book.variants.length > 0;
  const isOutOfStock = !hasVariants && book.stock === 0;
  const allVariantsOutOfStock = hasVariants && book.variants.length > 0 && book.variants.every((v) => v.stock === 0);
  const cardOutOfStock = !hasVariants ? isOutOfStock : allVariantsOutOfStock;
  const minPrice = hasVariants ? Math.min(...book.variants.map((v) => v.price)) : book.price;
  const buyTo = hasVariants ? `/buku/${book.id}` : `/checkout/${book.id}`;
  return (
    <motion.article
      whileHover={{ y: -4 }}
      transition={{ duration: 0.2 }}
      className={`group relative flex flex-col rounded-2xl border border-[#E8DFC8] bg-white p-3 shadow-sm transition-shadow hover:shadow-lg hover:shadow-[#DD6B20]/5 ${cardOutOfStock ? "border-[#9CA3AF] bg-[#E5E7EB] opacity-70" : ""}`}
      data-testid={`book-card-${book.id}`}
    >
      <Link to={`/buku/${book.id}`} className="relative block overflow-hidden rounded-xl" data-testid={`book-cover-link-${book.id}`}>
        <img
          src={book.cover_url}
          alt={book.title}
          loading="lazy"
          className="aspect-[3/4] w-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
        <span className={`absolute left-2.5 top-2.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${meta?.chip ?? "bg-white text-[#1F1D1A] border-[#E8DFC8]"}`}>
          {meta?.label ?? book.language}
        </span>
        {book.badge && (
          <span className="absolute bottom-2.5 right-2.5 rounded-full bg-[#1F1D1A]/85 px-2.5 py-1 text-[11px] font-medium text-[#FAF7F2] backdrop-blur">
            {book.badge}
          </span>
        )}
      </Link>
      {!hasVariants && (
        <button
          onClick={() => (isOutOfStock ? toast.error("Stok buku ini sedang habis.") : handleAddToCart(book))}
          disabled={isOutOfStock}
          data-testid={`add-cart-${book.id}`}
          aria-label="Tambah ke keranjang"
          className={`absolute right-5 top-5 flex size-8 items-center justify-center rounded-full shadow backdrop-blur transition-colors ${isOutOfStock ? "cursor-not-allowed bg-[#E5E7EB] text-[#6B7280] opacity-60" : "bg-white/90 text-[#1F1D1A] hover:bg-[#DD6B20] hover:text-white"}`}
        >
          <ShoppingCart className="size-4" />
        </button>
      )}
      <div className="flex flex-1 flex-col px-1 pb-1 pt-3">
        <h3 className="font-heading text-base font-semibold leading-snug">
          <Link to={`/buku/${book.id}`} className="transition-colors hover:text-[#C05621]">{book.title}</Link>
        </h3>
        {hasVariants && <p className="mt-0.5 text-[11px] text-[#635F59]">{book.variants.length} pilihan variasi</p>}
        <p className="mt-2 font-mono text-lg font-bold tracking-tight text-[#9C4221]" data-testid={`book-price-${book.id}`}>
          {hasVariants ? `Mulai ${rupiah(minPrice)}` : rupiah(book.price)}
        </p>
        <div className="mt-3 flex-1" />
        <Link
          to={buyTo}
          data-testid={isDigital ? `buy-digital-button-${book.id}` : `buy-physical-button-${book.id}`}
          className="flex items-center justify-center gap-2 rounded-full bg-[#DD6B20] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#C05621]"
        >
          {isDigital ? <Zap className="size-4" /> : <Truck className="size-4" />}
          {hasVariants ? "Pilih Variasi" : isDigital ? "Beli Ebook" : "Pesan via JNE"}
        </Link>
        {!isDigital && (
          <div className="mt-2 flex items-center justify-center gap-1.5">
            {marketplaceLinks(book).map((m) => (
              <a
                key={m.name}
                href={m.url}
                target="_blank"
                rel="noreferrer"
                data-testid={`buy-${m.name.toLowerCase()}-${book.id}`}
                className="flex flex-1 items-center justify-center gap-1 rounded-full border border-[#E8DFC8] px-2 py-1.5 text-[11px] font-medium text-[#635F59] transition-colors hover:border-[#DD6B20] hover:text-[#C05621]"
              >
                {m.icon} {m.name}
              </a>
            ))}
          </div>
        )}
      </div>
    </motion.article>
  );
}

import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { motion } from "motion/react";
import { BookOpen, Truck } from "lucide-react";
import { SiShopee, SiTiktok } from "@icons-pack/react-simple-icons";
import { apiGet } from "@/lib/api";
import type { Book } from "@/lib/types";
import { LANGUAGE_META, SHOPEE_URL, WA_NUMBER } from "@/lib/types";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { BookCard } from "@/components/BookCard";
import { Reveal } from "@/components/Reveal";
import { Store } from "lucide-react";

const FILTERS = ["semua", "mandarin", "korea", "jepang", "inggris"];

export default function Catalog({ kind }: { kind: "digital" | "fisik" }) {
  const [params] = useSearchParams();
  const initial = params.get("bahasa") ?? "semua";
  const [filter, setFilter] = useState(FILTERS.includes(initial) ? initial : "semua");
  const { data: books, isLoading } = useQuery({
    queryKey: ["books", kind],
    queryFn: () => apiGet<Book[]>(`/books?type=${kind}`),
  });

  const filtered = useMemo(
    () => (books ?? []).filter((b) => filter === "semua" || b.language === filter),
    [books, filter],
  );

  const isDigital = kind === "digital";

  return (
    <div className="min-h-screen bg-[#FAF7F2]">
      <Navbar />
      <section className="mx-auto max-w-7xl px-4 pb-24 pt-14 sm:px-6 lg:px-8">
        <Reveal>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#DD6B20]">
            {isDigital ? "Etalase Ebook Digital" : "Etalase Buku Fisik"}
          </p>
          <h1 className="mt-3 max-w-2xl font-heading text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl" data-testid="catalog-heading">
            {isDigital ? "Ebook yang terkirim instan, begitu kamu bayar." : "Buku cetak pilihan, diantar JNE ke rumahmu."}
          </h1>
          <p className="mt-4 max-w-xl text-base leading-relaxed text-[#635F59]">
            {isDigital
              ? "Bayar lewat gateway (QRIS / VA / e-wallet), lalu konfirmasi otomatis ke WhatsApp admin — ebook langsung dikirim ke email kamu."
              : "Isi alamat rumah saat checkout dan dapatkan perkiraan ongkir JNE per wilayah. Atau beli langsung lewat marketplace favoritmu."}
          </p>
        </Reveal>

        {!isDigital && (
          <Reveal delay={0.1}>
            <div className="mt-8 flex flex-wrap items-center gap-4 rounded-2xl border border-[#E8DFC8] bg-white p-5" data-testid="marketplace-banner">
              <span className="flex items-center gap-2 text-sm font-semibold text-[#1F1D1A]">
                <Truck className="size-4 text-[#DD6B20]" /> Pengiriman JNE · estimasi 1-10 hari
              </span>
              <span className="hidden h-4 w-px bg-[#E8DFC8] sm:block" />
              <span className="text-sm text-[#635F59]">Atau beli lewat:</span>
              <div className="flex gap-2">
                <a href={SHOPEE_URL} target="_blank" rel="noreferrer" data-testid="marketplace-shopee-link" className="flex items-center gap-1.5 rounded-full border border-[#E8DFC8] px-3.5 py-1.5 text-xs font-semibold text-[#635F59] transition-colors hover:border-[#DD6B20] hover:text-[#C05621]"><SiShopee size={13} /> Shopee</a>
                <a href={`https://wa.me/${WA_NUMBER}?text=${encodeURIComponent("Halo Admin LAMIMI_ID, saya ingin beli buku fisik lewat Tokopedia.")}`} target="_blank" rel="noreferrer" data-testid="marketplace-tokopedia-link" className="flex items-center gap-1.5 rounded-full border border-[#E8DFC8] px-3.5 py-1.5 text-xs font-semibold text-[#635F59] transition-colors hover:border-[#DD6B20] hover:text-[#C05621]"><Store className="size-3.5" /> Tokopedia</a>
                <a href={`https://wa.me/${WA_NUMBER}?text=${encodeURIComponent("Halo Admin LAMIMI_ID, saya ingin beli buku fisik lewat TikTok Shop.")}`} target="_blank" rel="noreferrer" data-testid="marketplace-tiktok-link" className="flex items-center gap-1.5 rounded-full border border-[#E8DFC8] px-3.5 py-1.5 text-xs font-semibold text-[#635F59] transition-colors hover:border-[#DD6B20] hover:text-[#C05621]"><SiTiktok size={13} /> TikTok Shop</a>
              </div>
            </div>
          </Reveal>
        )}

        <div className="mt-10 flex flex-wrap gap-2" data-testid="language-filters">
          {FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              data-testid={`filter-${f}`}
              className={`relative rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                filter === f ? "text-white" : "border border-[#E8DFC8] bg-white text-[#635F59] hover:text-[#1F1D1A]"
              }`}
            >
              {filter === f && <motion.span layoutId={`filter-pill-${kind}`} className="absolute inset-0 rounded-full bg-[#1F1D1A]" transition={{ duration: 0.3 }} />}
              <span className="relative">{f === "semua" ? "Semua" : LANGUAGE_META[f]?.label}</span>
            </button>
          ))}
        </div>

        <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4" data-testid="catalog-grid">
          {isLoading &&
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="animate-pulse rounded-2xl border border-[#E8DFC8] bg-white p-3">
                <div className="aspect-[3/4] rounded-xl bg-[#F5EDE0]" />
                <div className="mt-3 h-4 w-3/4 rounded bg-[#F5EDE0]" />
                <div className="mt-2 h-4 w-1/3 rounded bg-[#F5EDE0]" />
              </div>
            ))}
          {!isLoading && filtered.map((b) => <BookCard key={b.id} book={b} />)}
          {!isLoading && filtered.length === 0 && (
            <div className="col-span-full flex flex-col items-start gap-3 rounded-2xl border border-dashed border-[#E8DFC8] bg-white p-10">
              <BookOpen className="size-8 text-[#DD6B20]" />
              <p className="text-sm text-[#635F59]">Belum ada buku di kategori ini. Coba filter lain atau hubungi admin.</p>
            </div>
          )}
        </div>
      </section>
      <Footer />
    </div>
  );
}

import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { motion } from "motion/react";
import { BookOpen, ChevronLeft, ChevronRight, Search, Truck } from "lucide-react";
import { SiShopee, SiTiktok } from "@icons-pack/react-simple-icons";
import { apiGet } from "@/lib/api";
import type { Book, BookCategory, LanguageEntry } from "@/lib/types";
import { SHOPEE_URL, WA_NUMBER } from "@/lib/types";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { BookCard } from "@/components/BookCard";
import { Reveal } from "@/components/Reveal";
import { Store } from "lucide-react";

const DIGITAL_PAGE_SIZE = 25;
const SORT_OPTIONS = [
  { key: "newest", label: "Newest" },
  { key: "oldest", label: "Oldest" },
  { key: "highest", label: "Highest Price" },
  { key: "lowest", label: "Lowest Price" },
];

export default function Catalog({ kind }: { kind: "digital" | "fisik" }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedLanguage = searchParams.get("bahasa") ?? "semua";
  const selectedCategory = searchParams.get("kategori") ?? "semua";
  const selectedSub = searchParams.get("sub") ?? "semua";
  const selectedSort = searchParams.get("sort") ?? "newest";
  const searchTitle = (searchParams.get("q") ?? "").trim().toLowerCase();
  const [languageMenuOpen, setLanguageMenuOpen] = useState(false);

  const isDigital = kind === "digital";

  const { data: books, isLoading: loadingBooks } = useQuery({
    queryKey: ["books", kind],
    queryFn: () => apiGet<Book[]>(`/books?type=${kind}`),
  });

  const { data: languages = [] } = useQuery({
    queryKey: ["languages"],
    queryFn: () => apiGet<LanguageEntry[]>("/languages"),
  });

  const { data: categories = [] } = useQuery({
    queryKey: ["categories"],
    queryFn: () => apiGet<BookCategory[]>("/categories"),
  });

  const visibleCategories = useMemo(
    () => categories.filter((c) => c.parent_type !== "category" && (!c.parent || selectedLanguage === "semua" || c.parent === selectedLanguage)),
    [categories, selectedLanguage],
  );

  const childCategories = useMemo(
    () => (selectedCategory === "semua" ? [] : categories.filter((c) => c.parent_type === "category" && c.parent === selectedCategory)),
    [categories, selectedCategory],
  );
  const childSlugs = useMemo(() => childCategories.map((c) => c.slug), [childCategories]);

  const filtered = useMemo(() => {
    const rows = (books ?? []).filter((b) => {
      const languageMatch = selectedLanguage === "semua" || b.language === selectedLanguage;
      const cats = b.categories ?? [];
      const categoryMatch =
        selectedCategory === "semua" ||
        (selectedSub !== "semua"
          ? cats.includes(selectedSub)
          : cats.includes(selectedCategory) || childSlugs.some((s) => cats.includes(s)));
      const titleMatch = !searchTitle || b.title.toLowerCase().includes(searchTitle);
      return languageMatch && categoryMatch && titleMatch;
    });

    const sorted = [...rows];
    switch (selectedSort) {
      case "oldest":
        sorted.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
        break;
      case "highest":
        sorted.sort((a, b) => b.price - a.price);
        break;
      case "lowest":
        sorted.sort((a, b) => a.price - b.price);
        break;
      case "newest":
      default:
        sorted.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        break;
    }

    return sorted;
  }, [books, selectedCategory, selectedSub, selectedLanguage, selectedSort, searchTitle, childSlugs]);

  const pageSize = isDigital ? DIGITAL_PAGE_SIZE : filtered.length || 1;
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const requestPage = Number(searchParams.get("page") ?? "1");
  const currentPage = Math.min(Math.max(requestPage, 1), pageCount);

  const pageBooks = useMemo(() => {
    if (!isDigital) return filtered;
    const start = (currentPage - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [currentPage, filtered, isDigital, pageSize]);

  const pageNumbers = Array.from({ length: pageCount }, (_, index) => index + 1);

  const handleLanguageChange = (language: string) => {
    const next = new URLSearchParams(searchParams);
    if (language === "semua") {
      next.delete("bahasa");
    } else {
      next.set("bahasa", language);
    }
    next.delete("kategori");
    next.delete("sub");
    next.set("page", "1");
    setSearchParams(next);
    setLanguageMenuOpen(false);
  };

  const handleCategoryChange = (category: string) => {
    const next = new URLSearchParams(searchParams);
    if (category === "semua") {
      next.delete("kategori");
    } else {
      next.set("kategori", category);
      const cat = categories.find((c) => c.slug === category);
      if (cat?.parent && cat.parent_type !== "category") next.set("bahasa", cat.parent);
    }
    next.delete("sub");
    next.set("page", "1");
    setSearchParams(next);
  };

  const handleSubcategoryChange = (sub: string) => {
    const next = new URLSearchParams(searchParams);
    if (sub === "semua") {
      next.delete("sub");
    } else {
      next.set("sub", sub);
    }
    next.set("page", "1");
    setSearchParams(next);
  };

  const handleSortChange = (sortKey: string) => {
    const next = new URLSearchParams(searchParams);
    if (sortKey === "newest") {
      next.delete("sort");
    } else {
      next.set("sort", sortKey);
    }
    next.set("page", "1");
    setSearchParams(next);
  };

  const handleTitleSearch = (value: string) => {
    const next = new URLSearchParams(searchParams);
    if (!value.trim()) {
      next.delete("q");
    } else {
      next.set("q", value);
    }
    next.set("page", "1");
    setSearchParams(next);
  };

  const goToPage = (page: number) => {
    const next = new URLSearchParams(searchParams);
    next.set("page", String(Math.min(Math.max(page, 1), pageCount)));
    setSearchParams(next);
  };

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
              ? "Pilih rekening tujuan (BCA / Seabank / QRIS / GoPay / OVO / ShopeePay), transfer sesuai total, upload bukti bayar — ebook langsung dikirim ke email kamu setelah diverifikasi admin."
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

        <div className="mt-10 flex flex-wrap items-center gap-2" data-testid="language-filters">
          <button
            onClick={() => {
              setLanguageMenuOpen(false);
              handleLanguageChange("semua");
              handleCategoryChange("semua");
            }}
            className={`relative rounded-full px-4 py-2 text-sm font-medium transition-colors ${
              selectedLanguage === "semua" && selectedCategory === "semua" ? "text-white" : "border border-[#E8DFC8] bg-white text-[#635F59] hover:text-[#1F1D1A]"
            }`}
          >
            {selectedLanguage === "semua" && selectedCategory === "semua" && <motion.span layoutId={`filter-pill-${kind}`} className="absolute inset-0 rounded-full bg-[#1F1D1A]" transition={{ duration: 0.3 }} />}
            <span className="relative">Semua</span>
          </button>

          <div className="relative">
            <button
              onClick={() => setLanguageMenuOpen((v) => !v)}
              className={`relative rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                selectedLanguage !== "semua" ? "bg-[#1F1D1A] text-white" : "border border-[#E8DFC8] bg-white text-[#635F59] hover:text-[#1F1D1A]"
              }`}
            >
              Bahasa{selectedLanguage !== "semua" ? `: ${languages.find((l) => l.slug === selectedLanguage)?.label ?? selectedLanguage}` : ""}
            </button>
            {languageMenuOpen && (
              <div className="absolute left-0 top-full z-30 mt-2 min-w-52 rounded-2xl border border-[#E8DFC8] bg-white p-2 shadow-xl">
                <button
                  onClick={() => handleLanguageChange("semua")}
                  className="block w-full rounded-xl px-3 py-2 text-left text-sm hover:bg-[#F5EDE0]"
                >
                  Semua Bahasa
                </button>
                {languages.map((l) => (
                  <button
                    key={l.slug}
                    onClick={() => handleLanguageChange(l.slug)}
                    className="block w-full rounded-xl px-3 py-2 text-left text-sm hover:bg-[#F5EDE0]"
                  >
                    {l.label || l.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          {visibleCategories.map((c) => (
            <button
              key={c.slug}
              onClick={() => handleCategoryChange(c.slug)}
              className={`relative rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                selectedCategory === c.slug ? "text-white" : "border border-[#E8DFC8] bg-white text-[#635F59] hover:text-[#1F1D1A]"
              }`}
            >
              {selectedCategory === c.slug && <motion.span layoutId={`filter-pill-${kind}`} className="absolute inset-0 rounded-full bg-[#1F1D1A]" transition={{ duration: 0.3 }} />}
              <span className="relative">{c.name}</span>
            </button>
          ))}
        </div>

        {childCategories.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-2" data-testid="subcategory-filters">
            <span className="text-xs font-semibold uppercase tracking-wide text-[#635F59]">Subkategori:</span>
            <button
              onClick={() => handleSubcategoryChange("semua")}
              className={`rounded-full px-4 py-1.5 text-xs font-medium transition-colors ${selectedSub === "semua" ? "bg-[#9C4221] text-white" : "border border-[#E8DFC8] bg-white text-[#635F59] hover:text-[#1F1D1A]"}`}
            >
              Semua
            </button>
            {childCategories.map((c) => (
              <button
                key={c.slug}
                onClick={() => handleSubcategoryChange(c.slug)}
                data-testid={`subcategory-${c.slug}`}
                className={`rounded-full px-4 py-1.5 text-xs font-medium transition-colors ${selectedSub === c.slug ? "bg-[#9C4221] text-white" : "border border-[#E8DFC8] bg-white text-[#635F59] hover:text-[#1F1D1A]"}`}
              >
                {c.name}
              </button>
            ))}
          </div>
        )}

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#E8DFC8] bg-white px-4 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#635F59]" />
              <input
                value={searchParams.get("q") ?? ""}
                onChange={(e) => handleTitleSearch(e.target.value)}
                placeholder="Cari judul buku"
                className="w-80 rounded-full border border-[#E8DFC8] bg-[#FAF7F2] px-10 py-2 text-sm outline-none transition focus:border-[#DD6B20]"
                data-testid="catalog-title-search"
              />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {SORT_OPTIONS.map((s) => (
              <button
                key={s.key}
                onClick={() => handleSortChange(s.key)}
                className={`rounded-full px-4 py-2 text-xs font-semibold transition ${
                  selectedSort === s.key
                    ? "bg-[#1F1D1A] text-white"
                    : "border border-[#E8DFC8] bg-white text-[#635F59] hover:text-[#C05621]"
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4" data-testid="catalog-grid">
          {loadingBooks &&
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="animate-pulse rounded-2xl border border-[#E8DFC8] bg-white p-3">
                <div className="aspect-[3/4] rounded-xl bg-[#F5EDE0]" />
                <div className="mt-3 h-4 w-3/4 rounded bg-[#F5EDE0]" />
                <div className="mt-2 h-4 w-1/3 rounded bg-[#F5EDE0]" />
              </div>
            ))}
          {!loadingBooks && pageBooks.map((b) => <BookCard key={b.id} book={b} />)}
          {!loadingBooks && filtered.length === 0 && (
            <div className="col-span-full flex flex-col items-start gap-3 rounded-2xl border border-dashed border-[#E8DFC8] bg-white p-10">
              <BookOpen className="size-8 text-[#DD6B20]" />
              <p className="text-sm text-[#635F59]">Belum ada buku di kategori ini. Coba filter lain atau hubungi admin.</p>
            </div>
          )}
        </div>

        {isDigital && !loadingBooks && pageCount > 1 && (
          <div className="mt-10 flex flex-wrap items-center justify-center gap-2 border-t border-[#E8DFC8] pt-8">
            <button
              onClick={() => goToPage(currentPage - 1)}
              disabled={currentPage === 1}
              className="inline-flex items-center gap-1 rounded-full border border-[#E8DFC8] bg-white px-4 py-2 text-sm font-semibold text-[#1F1D1A] transition hover:border-[#DD6B20] hover:text-[#C05621] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <ChevronLeft className="size-4" /> Prev
            </button>
            {pageNumbers.map((n) => (
              <button
                key={n}
                onClick={() => goToPage(n)}
                className={`min-w-10 rounded-full px-3 py-2 text-sm font-semibold transition ${
                  n === currentPage
                    ? "bg-[#1F1D1A] text-white"
                    : "border border-[#E8DFC8] bg-white text-[#635F59] hover:border-[#DD6B20] hover:text-[#C05621]"
                }`}
              >
                Page {n}
              </button>
            ))}
            <button
              onClick={() => goToPage(currentPage + 1)}
              disabled={currentPage === pageCount}
              className="inline-flex items-center gap-1 rounded-full border border-[#E8DFC8] bg-white px-4 py-2 text-sm font-semibold text-[#1F1D1A] transition hover:border-[#DD6B20] hover:text-[#C05621] disabled:cursor-not-allowed disabled:opacity-50"
            >
              Next <ChevronRight className="size-4" />
            </button>
          </div>
        )}

        <div className="mt-12 flex flex-wrap items-center justify-center gap-2 rounded-[2rem] border border-[#E8DFC8] bg-[#F5EDE0]/70 px-6 py-7 text-center">
          <p className="font-heading text-lg font-semibold italic leading-relaxed text-[#1F1D1A]">
            Butuh buku lain yang tidak ada di etalase? <a className="font-semibold text-[#C05621] underline underline-offset-4 hover:text-[#9C4221]" href={`https://wa.me/${WA_NUMBER}?text=${encodeURIComponent("Halo! Saya ingin request buku ... bentuk digital / fisik (pilih satu), apakah ada?")}`} target="_blank" rel="noreferrer">request ke WhatsApp</a>
          </p>
        </div>
      </section>
      <Footer />
    </div>
  );
}

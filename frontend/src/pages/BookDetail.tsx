import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, ShoppingCart, Truck, Zap } from "lucide-react";
import { toast } from "sonner";
import { apiGet } from "@/lib/api";
import type { Book } from "@/lib/types";
import { LANGUAGE_META } from "@/lib/types";
import { rupiah } from "@/lib/format";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { BookCard, handleAddToCart, marketplaceLinks } from "@/components/BookCard";
import { Reveal } from "@/components/Reveal";

export default function BookDetail() {
  const { id } = useParams();
  const { data: book, isLoading } = useQuery({
    queryKey: ["book", id],
    queryFn: () => apiGet<Book>(`/books/${id}`),
    retry: false,
  });
  const { data: related } = useQuery({
    queryKey: ["books", "related", book?.language, book?.type],
    queryFn: () => apiGet<Book[]>(`/books?type=${book?.type}&language=${book?.language}`),
    enabled: !!book,
  });
  const [sel, setSel] = useState<Record<string, string>>({});

  const isDigital = book?.type === "digital";
  const meta = book ? LANGUAGE_META[book.language] : undefined;
  const groups = book?.variant_groups ?? [];
  const hasVariants = groups.length > 0;
  const allSelected = groups.every((g) => sel[g.name]);
  const activeVariant = book?.variants.find((v) => {
    const selections = v.selections ?? {};
    return groups.every((g) => {
      if (!Object.prototype.hasOwnProperty.call(selections, g.name)) return true;
      return selections[g.name] === sel[g.name];
    });
  });
  const isOptionOutOfStock = (groupName: string, option: string) => {
    if (!book?.variants?.length) return false;
    const matching = book.variants.filter((v) => v.selections?.[groupName] === option);
    if (matching.length === 0) return false;
    const relevant = matching.filter((v) => {
      return groups.every((g) => g.name === groupName || !sel[g.name] || (v.selections ?? {})[g.name] === sel[g.name]);
    });
    if (relevant.length === 0) return true;
    return relevant.every((v) => v.stock === 0);
  };
  const getOptionStockText = (groupName: string, option: string) => {
    if (!book?.variants?.length) return "";
    const matching = book.variants.filter((v) => (v.selections ?? {})[groupName] === option);
    const relevant = matching.filter((v) => {
      return groups.every((g) => g.name === groupName || !sel[g.name] || (v.selections ?? {})[g.name] === sel[g.name]);
    });
    if (relevant.length === 0) return "";

    const stocks = relevant.map((v) => v.stock);
    if (stocks.some((s) => s < 0)) return "tersedia";

    const positive = stocks.filter((s) => s > 0);
    if (positive.length === 0) return "habis";
    return `sisa ${Math.min(...positive)}`;
  };
  const outOfStock = !!book && !isDigital && (hasVariants ? !!activeVariant && activeVariant.stock === 0 : book.stock === 0);

  const buy = (e?: React.MouseEvent) => {
    if (outOfStock) {
      e?.preventDefault();
      toast.error("Stok variasi ini sedang habis.");
      return;
    }
    if (hasVariants && !allSelected) {
      e?.preventDefault();
      toast.error("Pilih variasi dulu ya.");
    }
  };

  return (
    <div className="min-h-screen bg-[#FAF7F2]">
      <Navbar />
      <section className="mx-auto max-w-7xl px-4 pb-24 pt-10 sm:px-6 lg:px-8">
        <Link to={isDigital ? "/etalase/digital" : "/etalase/fisik"} data-testid="back-to-catalog" className="inline-flex items-center gap-1.5 text-sm font-medium text-[#635F59] transition-colors hover:text-[#C05621]">
          <ArrowLeft className="size-4" /> Kembali ke etalase
        </Link>

        {isLoading && (
          <div className="mt-8 grid animate-pulse gap-10 lg:grid-cols-12">
            <div className="aspect-[3/4] rounded-3xl bg-[#F5EDE0] lg:col-span-4" />
            <div className="space-y-4 lg:col-span-8">
              <div className="h-8 w-2/3 rounded bg-[#F5EDE0]" />
              <div className="h-4 w-1/3 rounded bg-[#F5EDE0]" />
              <div className="h-24 w-full rounded bg-[#F5EDE0]" />
            </div>
          </div>
        )}

        {book && (
          <div className="mt-8 grid gap-10 lg:grid-cols-12">
            <Reveal className="lg:col-span-4">
              <div className={`rounded-[2rem] border p-6 ${meta?.card ?? "border-[#E8DFC8] bg-[#F5EDE0]"}`}>
                <img src={book.cover_url} alt={book.title} className="w-full rounded-2xl shadow-2xl" data-testid="detail-cover" />
              </div>
            </Reveal>
            <div className="lg:col-span-8 lg:pt-4">
              <Reveal>
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${meta?.chip ?? "border-[#E8DFC8]"}`}>{meta?.label}</span>
                  {book.badge && <span className="rounded-full bg-[#1F1D1A] px-3 py-1 text-xs font-medium text-[#FAF7F2]">{book.badge}</span>}
                  <span className="rounded-full border border-[#E8DFC8] bg-white px-3 py-1 text-xs font-medium text-[#635F59]">
                    {isDigital ? "Ebook Digital · Terkirim Instan" : "Buku Fisik · Kirim via JNE"}
                  </span>
                </div>
                <h1 className="mt-5 max-w-xl font-heading text-3xl font-bold tracking-tight sm:text-4xl" data-testid="detail-title">{book.title}</h1>
                <p className="mt-2 text-sm text-[#635F59]">oleh {book.author}</p>
                <p className="mt-6 max-w-xl text-base leading-relaxed text-[#1F1D1A]">{book.description}</p>

                {hasVariants && (
                  <div className="mt-7 max-w-xl space-y-5" data-testid="variant-picker">
                    {groups.map((g) => (
                      <div key={g.name}>
                        <p className="text-sm font-semibold">{g.name}{sel[g.name] ? `: ${sel[g.name]}` : ""}</p>
                        <div className="mt-2 flex flex-wrap gap-2" data-testid={`variant-group-${g.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}>
                          {g.options.map((o) => {
                            const selected = sel[g.name] === o;
                            const optionOut = isOptionOutOfStock(g.name, o);
                            const stockText = selected ? getOptionStockText(g.name, o) : "";
                            return (
                              <button
                                key={o}
                                onClick={() => {
                                  if (optionOut) return;
                                  if (selected) {
                                    setSel((s) => {
                                      const next = { ...s };
                                      delete next[g.name];
                                      return next;
                                    });
                                    return;
                                  }
                                  setSel((s) => ({ ...s, [g.name]: o }));
                                }}
                                disabled={false}
                                aria-disabled={optionOut}
                                data-testid={`variant-option-${g.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${o.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}
                                className={`rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
                                  optionOut
                                    ? "cursor-not-allowed border-[#9CA3AF] bg-[#E5E7EB] text-[#6B7280] opacity-70"
                                    : selected
                                      ? "border-[#DD6B20] bg-[#FEEBC8] text-[#9A3412] ring-1 ring-[#DD6B20]"
                                      : "border-[#E8DFC8] bg-white text-[#635F59] hover:border-[#DD6B20]/60"
                                }`}
                              >
                                <span>{o}</span>
                                {selected && stockText && (
                                  <span className="mt-1 block text-[11px] font-semibold text-[#635F59]">
                                    {stockText === "tersedia" ? "Tersedia" : stockText === "habis" ? "Habis" : stockText}
                                  </span>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <p className="mt-7 font-mono text-3xl font-bold tracking-tight text-[#9C4221]" data-testid="detail-price">
                  {hasVariants
                    ? allSelected && activeVariant
                      ? rupiah(activeVariant.price)
                      : `Mulai ${rupiah(Math.min(...book.variants.map((v) => v.price)))}`
                    : rupiah(book.price)}
                </p>
                {hasVariants && allSelected && activeVariant && (
                  <p className="mt-1 text-xs text-[#635F59]" data-testid="detail-variant-label">Variasi: {activeVariant.label}</p>
                )}
                {!isDigital && (!hasVariants || (allSelected && activeVariant)) && (() => {
                  const st = hasVariants && activeVariant ? activeVariant.stock : book.stock;
                  return (
                    <p className={`mt-2 text-sm font-semibold ${st === 0 ? "text-red-600" : "text-[#15803D]"}`} data-testid="stock-info">
                      {st < 0 ? "Stok tersedia" : st > 0 ? `Stok tersedia: ${st}` : "Stok habis"}
                    </p>
                  );
                })()}

                <div className="mt-8 flex flex-wrap items-center gap-3">
                  <Link
                    to={hasVariants && !allSelected ? "#" : `/checkout/${book.id}${activeVariant ? `?v=${activeVariant.id}` : ""}`}
                    onClick={buy}
                    data-testid="detail-buy-button"
                    className={`inline-flex items-center gap-2 rounded-full bg-[#DD6B20] px-7 py-3.5 text-sm font-semibold text-white shadow-lg shadow-[#DD6B20]/25 transition-all hover:-translate-y-0.5 hover:bg-[#C05621] ${(hasVariants && !allSelected) || outOfStock ? "opacity-60" : ""}`}
                  >
                    {isDigital ? <Zap className="size-4" /> : <Truck className="size-4" />}
                    {outOfStock ? "Stok Habis" : isDigital ? "Beli Ebook Sekarang" : "Pesan via JNE"}
                    <ArrowRight className="size-4" />
                  </Link>
                  <button
                    onClick={() => {
                      if (outOfStock) return toast.error("Stok variasi ini sedang habis.");
                      if (hasVariants && (!allSelected || !activeVariant)) return toast.error("Pilih variasi dulu ya.");
                      handleAddToCart(book, activeVariant);
                    }}
                    data-testid="detail-add-cart-button"
                    className={`inline-flex items-center gap-2 rounded-full border border-[#1F1D1A]/15 bg-white px-6 py-3.5 text-sm font-semibold text-[#1F1D1A] transition-all hover:-translate-y-0.5 hover:border-[#DD6B20] hover:text-[#C05621] ${outOfStock ? "opacity-60" : ""}`}
                  >
                    <ShoppingCart className="size-4" /> Tambah ke Keranjang
                  </button>
                </div>

                {!isDigital && (
                  <div className="mt-6 rounded-2xl border border-[#E8DFC8] bg-white p-5" data-testid="detail-marketplace-box">
                    <p className="text-sm font-semibold">Atau beli lewat marketplace:</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {marketplaceLinks(book).map((m) => (
                        <a key={m.name} href={m.url} target="_blank" rel="noreferrer" data-testid={`detail-buy-${m.name.toLowerCase()}`} className="flex items-center gap-2 rounded-full border border-[#E8DFC8] px-4 py-2 text-sm font-semibold text-[#1F1D1A] transition-colors hover:border-[#DD6B20] hover:text-[#C05621]">
                          {m.icon} {m.name}
                        </a>
                      ))}
                    </div>
                    <p className="mt-3 text-xs text-[#635F59]">Ongkir marketplace mengikuti aturan platform masing-masing.</p>
                  </div>
                )}
              </Reveal>
            </div>
          </div>
        )}

        {related && related.filter((b) => b.id !== book?.id).length > 0 && (
          <div className="mt-20">
            <Reveal>
              <h2 className="font-heading text-2xl font-semibold tracking-tight">Buku serupa lainnya</h2>
            </Reveal>
            <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {related.filter((b) => b.id !== book?.id).slice(0, 4).map((b) => <BookCard key={b.id} book={b} />)}
            </div>
          </div>
        )}
      </section>
      <Footer />
    </div>
  );
}

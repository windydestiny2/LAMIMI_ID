import { useState } from "react";
import { MessageCircle, PackageSearch, Search } from "lucide-react";
import { apiGet } from "@/lib/api";
import type { OrderResponse } from "@/lib/types";
import { formatDate, ORDER_STATUS, rupiah } from "@/lib/format";
import { apiErrorMessage } from "@/lib/adminApi";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { Input } from "@/components/ui/input";
import { Reveal } from "@/components/Reveal";

export default function TrackOrder() {
  const [num, setNum] = useState("");
  const [result, setResult] = useState<OrderResponse | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const search = async () => {
    if (!num.trim()) return;
    setLoading(true);
    setError("");
    setResult(null);
    try {
      setResult(await apiGet<OrderResponse>(`/orders/${num.trim()}`));
    } catch (e) {
      setError(apiErrorMessage(e) === "Terjadi kesalahan. Coba lagi ya." ? "Pesanan tidak ditemukan. Periksa kembali nomornya ya." : apiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  const status = result ? ORDER_STATUS[result.order.status] : null;

  return (
    <div className="min-h-screen bg-[#FAF7F2]">
      <Navbar />
      <section className="mx-auto max-w-3xl px-4 pb-24 pt-16 sm:px-6 lg:px-8">
        <Reveal>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#DD6B20]">Lacak Pesanan</p>
          <h1 className="mt-3 font-heading text-3xl font-bold tracking-tight sm:text-4xl">Di mana pesananku sekarang?</h1>
          <p className="mt-3 text-base text-[#635F59]">Masukkan nomor pesanan (contoh: LM-AB12CD) yang kamu dapat setelah checkout.</p>
        </Reveal>

        <Reveal delay={0.1}>
          <div className="mt-8 flex gap-2">
            <Input
              value={num}
              onChange={(e) => setNum(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && search()}
              placeholder="LM-XXXXXX"
              data-testid="track-order-input"
              className="h-12 font-mono"
            />
            <button
              onClick={search}
              disabled={loading}
              data-testid="track-order-button"
              className="inline-flex items-center gap-2 rounded-full bg-[#DD6B20] px-6 text-sm font-semibold text-white transition-colors hover:bg-[#C05621] disabled:opacity-60"
            >
              <Search className="size-4" /> Lacak
            </button>
          </div>
        </Reveal>

        {error && (
          <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-700" data-testid="track-error">{error}</div>
        )}

        {result && status && (
          <Reveal className="mt-8">
            <div className="rounded-3xl border border-[#E8DFC8] bg-white p-6 sm:p-8" data-testid="track-result">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-mono text-lg font-bold" data-testid="track-order-number">{result.order.order_number}</p>
                  <p className="text-xs text-[#635F59]">{formatDate(result.order.created_at)}</p>
                </div>
                <span className={`rounded-full border px-3.5 py-1.5 text-xs font-semibold ${status.cls}`} data-testid="track-status">{status.label}</span>
              </div>
              <div className="mt-5 space-y-2 border-t border-[#E8DFC8] pt-5 text-sm">
                {result.order.items.map((i) => (
                  <div key={i.book_id} className="flex justify-between"><span>{i.title} x{i.qty}</span><span className="font-mono">{rupiah(i.price)}</span></div>
                ))}
                {result.order.order_type === "fisik" && (
                  <div className="flex justify-between text-[#635F59]"><span>Ongkir JNE ({result.order.region})</span><span className="font-mono">{rupiah(result.order.shipping_cost)}</span></div>
                )}
                <div className="flex justify-between border-t border-[#E8DFC8] pt-2 font-mono font-bold text-[#9C4221]"><span>Total</span><span>{rupiah(result.order.total)}</span></div>
              </div>
              {result.order.order_type === "fisik" && result.order.address && (
                <p className="mt-4 rounded-xl bg-[#F5EDE0] p-3.5 text-xs leading-relaxed text-[#635F59]">
                  Dikirim ke: {result.order.address}, {result.order.city}, {result.order.province} {result.order.postal_code}
                </p>
              )}
              <a href={result.whatsapp_url} target="_blank" rel="noreferrer" data-testid="track-whatsapp-button" className="mt-5 inline-flex items-center gap-2 rounded-full bg-green-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-green-700">
                <MessageCircle className="size-4" /> Hubungi Admin
                <PackageSearch className="hidden" />
              </a>
            </div>
          </Reveal>
        )}
      </section>
      <Footer />
    </div>
  );
}

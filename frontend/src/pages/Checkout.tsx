import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { motion } from "motion/react";
import { ArrowLeft, CheckCircle2, CreditCard, Loader2, MessageCircle, PackageSearch, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { apiGet, apiPost } from "@/lib/api";
import type { Book, OrderResponse, ShippingRegion } from "@/lib/types";
import { rupiah } from "@/lib/format";
import { apiErrorMessage } from "@/lib/adminApi";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const PAY_METHODS = ["QRIS", "VA BCA", "VA BNI", "GoPay", "OVO"];

export default function Checkout() {
  const { id } = useParams();
  const { data: book, isLoading } = useQuery({ queryKey: ["book", id], queryFn: () => apiGet<Book>(`/books/${id}`), retry: false });
  const { data: regions } = useQuery({ queryKey: ["shipping"], queryFn: () => apiGet<ShippingRegion[]>("/shipping") });

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [form, setForm] = useState({ name: "", phone: "", email: "", address: "", city: "", province: "", postal: "", region: "", notes: "" });
  const [method, setMethod] = useState("QRIS");
  const [result, setResult] = useState<OrderResponse | null>(null);
  const [processing, setProcessing] = useState(false);

  const isPhysical = book?.type === "fisik";
  const selectedRegion = regions?.find((r) => r.name === form.region);
  const total = (book?.price ?? 0) + (isPhysical ? selectedRegion?.cost ?? 0 : 0);

  const createOrder = useMutation({
    mutationFn: () =>
      apiPost<OrderResponse>("/orders", {
        customer_name: form.name,
        customer_email: form.email,
        customer_phone: form.phone,
        book_ids: [book!.id],
        order_type: book!.type,
        address: form.address,
        city: form.city,
        province: form.province,
        postal_code: form.postal,
        region: form.region,
        notes: form.notes,
      }),
    onSuccess: (data) => {
      setResult(data);
      setStep(2);
    },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  const pay = useMutation({
    mutationFn: () => apiPost<OrderResponse>(`/orders/${result!.order.order_number}/pay`, { method }),
    onSuccess: (data) => {
      setResult(data);
      setProcessing(false);
      setStep(3);
      toast.success("Pembayaran berhasil (simulasi Midtrans)");
    },
    onError: (e) => {
      setProcessing(false);
      toast.error(apiErrorMessage(e));
    },
  });

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const submitForm = () => {
    if (!form.name.trim() || !form.phone.trim()) return toast.error("Isi nama dan nomor WhatsApp dulu ya.");
    if (!isPhysical && !form.email.trim()) return toast.error("Isi email untuk pengiriman ebook ya.");
    if (isPhysical && (!form.address.trim() || !form.city.trim() || !form.province.trim() || !form.region))
      return toast.error("Lengkapi alamat dan wilayah pengiriman dulu ya.");
    createOrder.mutate();
  };

  const confirmPay = () => {
    setProcessing(true);
    setTimeout(() => pay.mutate(), 2000);
  };

  return (
    <div className="min-h-screen bg-[#FAF7F2]">
      <Navbar />
      <section className="mx-auto max-w-5xl px-4 pb-24 pt-10 sm:px-6 lg:px-8">
        <Link to={book ? `/buku/${book.id}` : "/"} data-testid="checkout-back-link" className="inline-flex items-center gap-1.5 text-sm font-medium text-[#635F59] transition-colors hover:text-[#C05621]">
          <ArrowLeft className="size-4" /> Kembali
        </Link>

        <div className="mt-6 flex items-center gap-2 text-xs font-semibold" data-testid="checkout-steps">
          {["Data Diri", "Pembayaran", "Selesai"].map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <span className={`flex size-7 items-center justify-center rounded-full ${step > i ? "bg-[#1F1D1A] text-white" : "border border-[#E8DFC8] bg-white text-[#635F59]"}`}>{i + 1}</span>
              <span className={step > i ? "text-[#1F1D1A]" : "text-[#635F59]"}>{s}</span>
              {i < 2 && <span className="mx-1 h-px w-8 bg-[#E8DFC8]" />}
            </div>
          ))}
        </div>

        {isLoading && <div className="mt-10 h-64 animate-pulse rounded-3xl bg-[#F5EDE0]" />}

        {book && (
          <div className="mt-8 grid gap-8 lg:grid-cols-12">
            {/* Summary */}
            <div className="lg:col-span-4">
              <div className="rounded-3xl border border-[#E8DFC8] bg-white p-5" data-testid="checkout-summary">
                <div className="flex gap-4">
                  <img src={book.cover_url} alt={book.title} className="w-20 rounded-xl border border-[#E8DFC8] object-cover" />
                  <div>
                    <p className="font-heading text-sm font-semibold leading-snug">{book.title}</p>
                    <p className="mt-1 text-xs text-[#635F59]">{isPhysical ? "Buku Fisik · JNE" : "Ebook Digital · Instan"}</p>
                    <p className="mt-1.5 font-mono text-sm font-bold text-[#9C4221]">{rupiah(book.price)}</p>
                  </div>
                </div>
                <div className="mt-5 space-y-2 border-t border-[#E8DFC8] pt-4 text-sm">
                  <div className="flex justify-between text-[#635F59]"><span>Subtotal</span><span>{rupiah(book.price)}</span></div>
                  {isPhysical && (
                    <div className="flex justify-between text-[#635F59]">
                      <span>Ongkir JNE {selectedRegion ? `(${selectedRegion.name})` : ""}</span>
                      <span>{selectedRegion ? rupiah(selectedRegion.cost) : "—"}</span>
                    </div>
                  )}
                  <div className="flex justify-between border-t border-[#E8DFC8] pt-2 font-mono text-base font-bold text-[#9C4221]">
                    <span>Total</span><span data-testid="checkout-total">{rupiah(total)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Main panel */}
            <div className="lg:col-span-8">
              {step === 1 && (
                <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="rounded-3xl border border-[#E8DFC8] bg-white p-6 sm:p-8" data-testid="checkout-form">
                  <h2 className="font-heading text-xl font-semibold">Data {isPhysical ? "Penerima" : "Pembeli"}</h2>
                  <div className="mt-6 grid gap-4 sm:grid-cols-2">
                    <div>
                      <Label htmlFor="name">Nama lengkap *</Label>
                      <Input id="name" data-testid="checkout-name-input" value={form.name} onChange={set("name")} placeholder="Nama kamu" className="mt-1.5" />
                    </div>
                    <div>
                      <Label htmlFor="phone">No. WhatsApp *</Label>
                      <Input id="phone" data-testid="checkout-phone-input" value={form.phone} onChange={set("phone")} placeholder="08xxxxxxxxxx" className="mt-1.5" />
                    </div>
                    <div className="sm:col-span-2">
                      <Label htmlFor="email">Email {isPhysical ? "" : "*"}</Label>
                      <Input id="email" type="email" data-testid="checkout-email-input" value={form.email} onChange={set("email")} placeholder="email@kamu.com" className="mt-1.5" />
                    </div>
                    {isPhysical && (
                      <>
                        <div className="sm:col-span-2">
                          <Label htmlFor="address">Alamat lengkap *</Label>
                          <Textarea id="address" data-testid="checkout-address-input" value={form.address} onChange={set("address")} placeholder="Jalan, nomor rumah, RT/RW, kelurahan, kecamatan" className="mt-1.5" />
                        </div>
                        <div>
                          <Label htmlFor="city">Kota / Kabupaten *</Label>
                          <Input id="city" data-testid="checkout-city-input" value={form.city} onChange={set("city")} placeholder="Contoh: Bandung" className="mt-1.5" />
                        </div>
                        <div>
                          <Label htmlFor="province">Provinsi *</Label>
                          <Input id="province" data-testid="checkout-province-input" value={form.province} onChange={set("province")} placeholder="Contoh: Jawa Barat" className="mt-1.5" />
                        </div>
                        <div>
                          <Label htmlFor="postal">Kode pos</Label>
                          <Input id="postal" data-testid="checkout-postal-input" value={form.postal} onChange={set("postal")} placeholder="40xxx" className="mt-1.5" />
                        </div>
                        <div>
                          <Label>Wilayah pengiriman (ongkir JNE) *</Label>
                          <Select value={form.region} onValueChange={(v) => setForm((f) => ({ ...f, region: v }))}>
                            <SelectTrigger className="mt-1.5 w-full" data-testid="shipping-region-select">
                              <SelectValue>{(v: string) => (v ? `${v} — ${rupiah(regions?.find((r) => r.name === v)?.cost ?? 0)}` : "Pilih wilayah")}</SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                              {(regions ?? []).map((r) => (
                                <SelectItem key={r.id} value={r.name} data-testid={`region-option-${r.name.replace(/[^a-z]/gi, "-").toLowerCase()}`}>
                                  {r.name} — {rupiah(r.cost)} · {r.eta}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </>
                    )}
                    <div className="sm:col-span-2">
                      <Label htmlFor="notes">Catatan (opsional)</Label>
                      <Input id="notes" data-testid="checkout-notes-input" value={form.notes} onChange={set("notes")} placeholder="Contoh: kirim secepatnya ya" className="mt-1.5" />
                    </div>
                  </div>
                  <button
                    onClick={submitForm}
                    disabled={createOrder.isPending}
                    data-testid="checkout-submit-button"
                    className="mt-7 inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#DD6B20] px-6 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-[#C05621] disabled:opacity-60"
                  >
                    {createOrder.isPending ? <Loader2 className="size-4 animate-spin" /> : <CreditCard className="size-4" />}
                    Lanjut ke Pembayaran
                  </button>
                </motion.div>
              )}

              {step === 2 && result && (
                <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="rounded-3xl border border-[#E8DFC8] bg-white p-6 sm:p-8" data-testid="payment-panel">
                  <div className="flex items-center justify-between">
                    <h2 className="font-heading text-xl font-semibold">Pembayaran</h2>
                    <span className="flex items-center gap-1.5 rounded-full bg-[#F5EDE0] px-3 py-1 text-[11px] font-semibold text-[#9C4221]"><ShieldCheck className="size-3.5" /> Midtrans (Simulasi)</span>
                  </div>
                  <p className="mt-1 text-sm text-[#635F59]">No. pesanan: <span className="font-mono font-bold text-[#1F1D1A]">{result.order.order_number}</span></p>
                  <p className="mt-4 text-sm font-medium">Pilih metode pembayaran:</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {PAY_METHODS.map((m) => (
                      <button
                        key={m}
                        onClick={() => setMethod(m)}
                        data-testid={`pay-method-${m.toLowerCase().replace(/ /g, "-")}`}
                        className={`rounded-full border px-4 py-2 text-sm font-medium transition-colors ${method === m ? "border-[#DD6B20] bg-[#FEEBC8] text-[#9A3412]" : "border-[#E8DFC8] text-[#635F59] hover:border-[#DD6B20]"}`}
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={confirmPay}
                    disabled={processing}
                    data-testid="confirm-payment-button"
                    className="mt-7 inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#1F1D1A] px-6 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-[#3a352f] disabled:opacity-70"
                  >
                    {processing ? <Loader2 className="size-4 animate-spin" /> : <CreditCard className="size-4" />}
                    {processing ? "Menghubungkan ke gateway..." : `Bayar ${rupiah(result.order.total)}`}
                  </button>
                  <p className="mt-3 text-center text-xs text-[#635F59]">Simulasi gateway — saat Midtrans asli aktif, dana masuk otomatis ke rekening pemilik.</p>
                </motion.div>
              )}

              {step === 3 && result && (
                <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} className="rounded-3xl border border-[#BBF7D0] bg-[#F0FDF4] p-6 sm:p-8" data-testid="success-panel">
                  <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", delay: 0.15 }}>
                    <CheckCircle2 className="size-14 text-green-600" />
                  </motion.div>
                  <h2 className="mt-4 font-heading text-2xl font-semibold text-green-900">Pembayaran berhasil!</h2>
                  <p className="mt-2 text-sm leading-relaxed text-green-800">
                    Pesanan <span className="font-mono font-bold">{result.order.order_number}</span> sudah lunas via {result.order.payment_method}.
                    {isPhysical
                      ? " Langkah terakhir: kirim detail pesanan ke admin lewat WhatsApp agar bukumu segera dipacking."
                      : " Langkah terakhir: kirim detail pesanan ke admin lewat WhatsApp — ebook langsung dikirim ke email kamu."}
                  </p>
                  <a
                    href={result.whatsapp_url}
                    target="_blank"
                    rel="noreferrer"
                    data-testid="whatsapp-handoff-button"
                    className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-full bg-green-600 px-6 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-green-700"
                  >
                    <MessageCircle className="size-4" /> Konfirmasi Pesanan via WhatsApp
                  </a>
                  <div className="mt-4 flex flex-wrap gap-3">
                    <Link to="/lacak" data-testid="success-track-link" className="inline-flex items-center gap-1.5 rounded-full border border-green-300 bg-white px-5 py-2.5 text-sm font-medium text-green-800 hover:border-green-500">
                      <PackageSearch className="size-4" /> Lacak Pesanan
                    </Link>
                    <Link to={isPhysical ? "/etalase/fisik" : "/etalase/digital"} className="inline-flex items-center rounded-full px-5 py-2.5 text-sm font-medium text-green-800 hover:underline">
                      Belanja lagi
                    </Link>
                  </div>
                </motion.div>
              )}
            </div>
          </div>
        )}
      </section>
      <Footer />
    </div>
  );
}

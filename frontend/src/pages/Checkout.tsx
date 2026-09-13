import { useEffect, useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { motion } from "motion/react";
import { ArrowLeft, CheckCircle2, Copy, ImageUp, Loader2, MessageCircle, PackageSearch, ShieldCheck, ShoppingBag } from "lucide-react";
import { toast } from "sonner";
import { apiGet, apiPost } from "@/lib/api";
import type { Book, OrderResponse, PaymentMethod, ShippingRegion } from "@/lib/types";
import { rupiah } from "@/lib/format";
import { apiErrorMessage } from "@/lib/adminApi";
import { clearCart, getCart, type CartItem } from "@/lib/cart";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { validateCheckoutContact } from "@/lib/checkoutValidation";

export default function Checkout() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const variantId = params.get("v") ?? "";
  const isCart = id === "keranjang";
  const [cartItems, setCartItems] = useState<CartItem[]>([]);

  useEffect(() => {
    if (isCart) setCartItems(getCart());
  }, [isCart]);

  const { data: book, isLoading } = useQuery({
    queryKey: ["book", id],
    queryFn: () => apiGet<Book>(`/books/${id}`),
    retry: false,
    enabled: !isCart,
  });
  const { data: regions } = useQuery({ queryKey: ["shipping"], queryFn: () => apiGet<ShippingRegion[]>("/shipping") });
  const { data: methods } = useQuery({ queryKey: ["payment-methods"], queryFn: () => apiGet<PaymentMethod[]>("/payment-methods") });

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [form, setForm] = useState({ name: "", phone: "", email: "", address: "", city: "", province: "", postal: "", region: "", notes: "" });
  const [voucherCode, setVoucherCode] = useState("");
  const [method, setMethod] = useState("");
  const [proof, setProof] = useState("");
  const [result, setResult] = useState<OrderResponse | null>(null);

  const items = useMemo(() => {
    if (isCart) return cartItems;
    if (!book) return [];
    const variant = book.variants.find((v) => v.id === variantId);
    return [{
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
    }];
  }, [isCart, cartItems, book, variantId]);

  const orderType = items[0]?.type ?? "digital";
  const isPhysical = orderType === "fisik";
  const subtotal = items.reduce((s, i) => s + i.price * i.qty, 0);
  const selectedRegion = regions?.find((r) => r.name === form.region);
  const quantityTotal = items.reduce((s, i) => s + i.qty, 0);
  const physicalUnits = items.filter((i) => i.type === "fisik").reduce((s, i) => s + i.qty, 0);
  const shippingMultiplier = isPhysical ? Math.max(1, Math.ceil(physicalUnits / 5)) : 1;
  const shippingCost = isPhysical ? (selectedRegion?.cost ?? 0) * shippingMultiplier : 0;
  const total = subtotal + shippingCost;
  const selectedMethod = methods?.find((m) => m.name === method);

  const createOrder = useMutation({
    mutationFn: () =>
      apiPost<OrderResponse>("/orders", {
        customer_name: form.name,
        customer_email: form.email,
        customer_phone: form.phone,
        items: items.map((i) => ({ book_id: i.id, variant_id: i.variant_id, qty: i.qty })),
        order_type: orderType,
        address: form.address,
        city: form.city,
        province: form.province,
        postal_code: form.postal,
        region: form.region,
        notes: form.notes,
        voucher_code: voucherCode.trim().toUpperCase(),
      }),
    onSuccess: (data) => {
      setResult(data);
      setStep(2);
    },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  const confirm = useMutation({
    mutationFn: () => apiPost<OrderResponse>(`/orders/${result!.order.order_number}/confirm-payment`, { method, proof }),
    onSuccess: (data) => {
      setResult(data);
      setStep(3);
      if (isCart) clearCart();
      toast.success("Bukti pembayaran diterima — menunggu verifikasi admin");
    },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const submitForm = () => {
    if (!form.name.trim()) return toast.error("Isi nama lengkap dulu ya.");

    const contactError = validateCheckoutContact({
      email: form.email,
      phone: form.phone,
      isPhysical,
    });
    if (contactError) return toast.error(contactError);

    if (isPhysical && (!form.address.trim() || !form.city.trim() || !form.province.trim() || !form.region))
      return toast.error("Lengkapi alamat dan wilayah pengiriman dulu ya.");
    createOrder.mutate();
  };

  const onProofFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) return toast.error("File harus berupa gambar (JPG/PNG).");
    if (file.size > 3 * 1024 * 1024) return toast.error("Ukuran gambar maksimal 3 MB.");
    const reader = new FileReader();
    reader.onload = () => setProof(String(reader.result));
    reader.readAsDataURL(file);
  };

  const copyNumber = (text: string) => {
    navigator.clipboard.writeText(text).then(() => toast.success("Nomor disalin"));
  };

  return (
    <div className="min-h-screen bg-[#FAF7F2]">
      <Navbar />
      <section className="mx-auto max-w-5xl px-4 pb-24 pt-10 sm:px-6 lg:px-8">
        <Link to={isCart ? "/etalase/digital" : book ? `/buku/${book.id}` : "/"} data-testid="checkout-back-link" className="inline-flex items-center gap-1.5 text-sm font-medium text-[#635F59] transition-colors hover:text-[#C05621]">
          <ArrowLeft className="size-4" /> Kembali
        </Link>

        {isCart && items.length === 0 && step === 1 && (
          <div className="mt-10 flex flex-col items-start gap-4 rounded-3xl border border-dashed border-[#E8DFC8] bg-white p-10" data-testid="cart-empty-state">
            <ShoppingBag className="size-10 text-[#DD6B20]" />
            <h1 className="font-heading text-2xl font-semibold">Keranjangmu kosong</h1>
            <p className="text-sm text-[#635F59]">Tambahkan buku lewat tombol keranjang di kartu buku, lalu kembali ke sini.</p>
            <Link to="/etalase/digital" className="rounded-full bg-[#DD6B20] px-6 py-3 text-sm font-semibold text-white hover:bg-[#C05621]">Jelajahi Ebook</Link>
          </div>
        )}

        {items.length > 0 && (
          <>
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

            <div className="mt-8 grid gap-8 lg:grid-cols-12">
              {/* Summary */}
              <div className="lg:col-span-4">
                <div className="rounded-3xl border border-[#E8DFC8] bg-white p-5" data-testid="checkout-summary">
                  <div className="space-y-3">
                    {items.map((i) => (
                      <div key={i.key} className={`flex gap-3 ${i.stock === 0 ? "rounded-2xl border border-[#9CA3AF] bg-[#E5E7EB] p-2 opacity-70" : ""}`}>
                        <img src={i.cover_url} alt={i.title} className="h-20 w-14 rounded-lg border border-[#E8DFC8] object-cover" />
                        <div>
                          <p className="text-sm font-semibold leading-snug">{i.title}</p>
                          {i.variant_label && <p className="mt-0.5 text-[11px] font-medium text-[#C05621]">{i.variant_label}</p>}
                          <p className="mt-0.5 text-xs text-[#635F59]">{i.type === "fisik" ? "Buku Fisik · JNE" : "Ebook Digital"}</p>
                          <p className="mt-1 font-mono text-sm font-bold text-[#9C4221]">{rupiah(i.price)} <span className="text-[#635F59] font-sans text-[11px]">x{i.qty}</span></p>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-5 space-y-2 border-t border-[#E8DFC8] pt-4 text-sm">
                    <div className="flex justify-between text-[#635F59]"><span>Subtotal ({quantityTotal} item)</span><span>{rupiah(subtotal)}</span></div>
                    {isPhysical && (
                      <div className="flex justify-between text-[#635F59]">
                        <span>
                          Ongkir JNE {selectedRegion ? `(${selectedRegion.name})` : ""}
                          {shippingMultiplier > 1 && <span className="ml-1 font-semibold text-[#9C4221]">x{shippingMultiplier}</span>}
                        </span>
                        <span>{selectedRegion ? rupiah(shippingCost) : "—"}</span>
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
                            <Input id="city" data-testid="checkout-city-input" value={form.city} onChange={set("city")} placeholder="Cth: Kab. Bogor / Kota Bogor" className="mt-1.5" />
                          </div>
                          <div>
                            <Label htmlFor="province">Provinsi *</Label>
                            <Input id="province" data-testid="checkout-province-input" value={form.province} onChange={set("province")} placeholder="Contoh: Jawa Barat" className="mt-1.5" />
                          </div>
                          <div>
                            <Label htmlFor="postal">Kode pos</Label>
                            <Input id="postal" data-testid="checkout-postal-input" value={form.postal} onChange={set("postal")} placeholder="16xxx" className="mt-1.5" />
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
                      <div className="sm:col-span-2">
                        <Label htmlFor="voucherCode">Kode Promo / Voucher (opsional)</Label>
                        <Input id="voucherCode" data-testid="checkout-voucher-input" value={voucherCode} onChange={(e) => setVoucherCode(e.target.value.toUpperCase())} placeholder="MASUKKAN KODE PROMO" className="mt-1.5 uppercase" />
                      </div>
                    </div>
                    <button
                      onClick={submitForm}
                      disabled={createOrder.isPending}
                      data-testid="checkout-submit-button"
                      className="mt-7 inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#DD6B20] px-6 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-[#C05621] disabled:opacity-60"
                    >
                      {createOrder.isPending ? <Loader2 className="size-4 animate-spin" /> : <ShieldCheck className="size-4" />}
                      Lanjut ke Pembayaran
                    </button>

                    {isPhysical && (
                      <div className="mt-4 rounded-2xl border border-[#E8DFC8] bg-[#FDF8EE] p-4">
                        <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wide text-[#9C4221]">
                          <ShieldCheck className="size-4" />
                          Syarat &amp; Ketentuan
                        </div>
                        <ul className="mt-3 space-y-2 text-sm leading-relaxed text-[#635F59]">
                          <li className="flex items-start gap-2">
                            <span className="mt-2 size-1.5 rounded-full bg-[#DD6B20]" />
                            <span>Buku fisik diproses PO selama 3–4 hari dan akan dikirim secepatnya.</span>
                          </li>
                          <li className="flex items-start gap-2">
                            <span className="mt-2 size-1.5 rounded-full bg-[#DD6B20]" />
                            <span>Jika alamat pengiriman tidak sesuai, segera konfirmasi Admin.</span>
                          </li>
                          <li className="flex items-start gap-2">
                            <span className="mt-2 size-1.5 rounded-full bg-[#DD6B20]" />
                            <span>Pastikan No. Whatsapp Aktif agar bisa kami hubungi.</span>
                          </li>
                          <li className="flex items-start gap-2">
                            <span className="mt-2 size-1.5 rounded-full bg-[#DD6B20]" />
                            <span>Ongkir berkelipatan setiap pembelian 5 pcs buku.</span>
                          </li>
                          <li className="flex items-start gap-2">
                            <span className="mt-2 size-1.5 rounded-full bg-[#DD6B20]" />
                            <span>Mohon isi ongkir sesuai alamat, jika tidak sesuai maka pengiriman tidak akan diproses.</span>
                          </li>
                        </ul>
                      </div>
                    )}
                  </motion.div>
                )}

                {step === 2 && result && (
                  <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="rounded-3xl border border-[#E8DFC8] bg-white p-6 sm:p-8" data-testid="payment-panel">
                    <div className="flex items-center justify-between">
                      <h2 className="font-heading text-xl font-semibold">Pembayaran Manual</h2>
                      <span className="flex items-center gap-1.5 rounded-full bg-[#F5EDE0] px-3 py-1 text-[11px] font-semibold text-[#9C4221]"><ShieldCheck className="size-3.5" /> Transfer / E-wallet</span>
                    </div>
                    <p className="mt-1 text-sm text-[#635F59]">No. pesanan: <span className="font-mono font-bold text-[#1F1D1A]">{result.order.order_number}</span></p>
                    <p className="mt-4 rounded-2xl bg-[#FEEBC8] p-4 text-sm text-[#78350F]">
                      Transfer tepat sebesar <span className="font-mono font-bold">{rupiah(result.order.total)}</span> ke salah satu rekening di bawah, lalu upload screenshot bukti pembayaranmu.
                    </p>

                    <div className="mt-5 space-y-2.5">
                      {(methods ?? []).map((m) => (
                        <button
                          key={m.id}
                          onClick={() => setMethod(m.name)}
                          data-testid={`pay-method-${m.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}
                          className={`w-full rounded-2xl border p-4 text-left transition-colors ${method === m.name ? "border-[#DD6B20] bg-[#FFF7ED] ring-1 ring-[#DD6B20]" : "border-[#E8DFC8] hover:border-[#DD6B20]/50"}`}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <p className="text-sm font-bold">{m.name}</p>
                              <p className="text-xs text-[#635F59]">a.n. {m.account_name}</p>
                              {m.account_number && (
                                <p className="mt-1 flex items-center gap-2 font-mono text-base font-bold tracking-wide text-[#1F1D1A]">
                                  {m.account_number}
                                  <span
                                    role="button"
                                    tabIndex={0}
                                    onClick={(e) => { e.stopPropagation(); copyNumber(m.account_number); }}
                                    onKeyDown={(e) => e.key === "Enter" && copyNumber(m.account_number)}
                                    data-testid={`copy-${m.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}
                                    className="rounded-full border border-[#E8DFC8] bg-white p-1.5 text-[#635F59] transition-colors hover:border-[#DD6B20] hover:text-[#C05621]"
                                  >
                                    <Copy className="size-3.5" />
                                  </span>
                                </p>
                              )}
                            </div>
                            <span className={`flex size-5 shrink-0 items-center justify-center rounded-full border-2 ${method === m.name ? "border-[#DD6B20] bg-[#DD6B20]" : "border-[#E8DFC8]"}`}>
                              {method === m.name && <CheckCircle2 className="size-3.5 text-white" />}
                            </span>
                          </div>
                          {m.name === "QRIS" && method === "QRIS" && (
                            m.qr_image
                              ? <img src={m.qr_image} alt="Barcode QRIS" className="mt-3 w-56 rounded-xl border border-[#E8DFC8] bg-white p-2" data-testid="qris-image" />
                              : <p className="mt-3 rounded-xl bg-[#F5EDE0] p-3 text-xs text-[#635F59]">Barcode QRIS segera hadir — sementara gunakan metode lain ya.</p>
                          )}
                        </button>
                      ))}
                    </div>

                    <div className="mt-6">
                      <Label>Upload bukti pembayaran (wajib) *</Label>
                      <label
                        htmlFor="proof"
                        data-testid="proof-upload-label"
                        className={`mt-2 flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed p-6 text-center transition-colors ${proof ? "border-green-300 bg-green-50" : "border-[#E8DFC8] hover:border-[#DD6B20]"}`}
                      >
                        {proof ? (
                          <img src={proof} alt="Bukti pembayaran" className="max-h-48 rounded-xl" data-testid="proof-preview" />
                        ) : (
                          <>
                            <ImageUp className="size-8 text-[#DD6B20]" />
                            <span className="text-sm text-[#635F59]">Klik untuk pilih screenshot bukti transfer (JPG/PNG, maks 3 MB)</span>
                          </>
                        )}
                        <input id="proof" type="file" accept="image/*" onChange={onProofFile} className="hidden" data-testid="proof-upload-input" />
                      </label>
                    </div>

                    <button
                      onClick={() => confirm.mutate()}
                      disabled={!method || !proof || confirm.isPending}
                      data-testid="confirm-payment-button"
                      className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#1F1D1A] px-6 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-[#3a352f] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {confirm.isPending ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
                      Saya Sudah Bayar — Konfirmasi
                    </button>
                    {!proof && <p className="mt-2 text-center text-xs text-[#B91C1C]" data-testid="proof-required-hint">Upload bukti pembayaran dulu untuk bisa lanjut ke WhatsApp.</p>}
                  </motion.div>
                )}

                {step === 3 && result && (
                  <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} className="rounded-3xl border border-[#BBF7D0] bg-[#F0FDF4] p-6 sm:p-8" data-testid="success-panel">
                    <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", delay: 0.15 }}>
                      <CheckCircle2 className="size-14 text-green-600" />
                    </motion.div>
                    {result.order.payment_status === "Pembayaran Diterima" ? (
                      <>
                        <h2 className="mt-4 font-heading text-2xl font-semibold text-green-900">Bukti pembayaran diterima!</h2>
                        <p className="mt-2 text-sm leading-relaxed text-green-800">
                          Pesanan <span className="font-mono font-bold">{result.order.order_number}</span> sedang diverifikasi admin ({result.order.payment_method}).
                          {isPhysical
                            ? " Langkah terakhir: kirim detail pesanan ke admin lewat WhatsApp agar bukumu segera dipacking."
                            : " Langkah terakhir: kirim detail pesanan ke admin lewat WhatsApp — ebook langsung dikirim ke email kamu setelah pembayaran terverifikasi."}
                        </p>
                      </>
                    ) : (
                      <>
                        <h2 className="mt-4 font-heading text-2xl font-semibold text-[#9C4221]">Pembayaran Kurang</h2>
                        <p className="mt-2 text-sm leading-relaxed text-[#9C4221]">
                          Pesanan <span className="font-mono font-bold">{result.order.order_number}</span> membutuhkan kekurangan sebesar <span className="font-mono font-bold">{rupiah(result.order.payment_shortage)}</span> untuk bisa diterima admin. Silakan kirim kembali bukti payment yang sesuai.
                        </p>
                      </>
                    )}
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
          </>
        )}
      </section>
      <Footer />
    </div>
  );
}

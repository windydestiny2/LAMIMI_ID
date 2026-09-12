import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BookOpen, BookPlus, Loader2, LogOut, MessageCircle, Package, Pencil, Trash2, Wallet } from "lucide-react";
import { toast } from "sonner";
import type { AdminStats, AdminUser, Book, Order, ShippingRegion } from "@/lib/types";
import { LANGUAGE_META } from "@/lib/types";
import { formatDate, ORDER_STATUS, rupiah } from "@/lib/format";
import { aDelete, aGet, aPatch, aPost, aPut, apiErrorMessage, clearAdminToken, getAdminToken } from "@/lib/adminApi";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";

interface BookForm {
  title: string; author: string; language: string; type: string; price: string;
  description: string; cover_url: string; badge: string; featured: boolean;
  shopee_url: string; tokopedia_url: string; tiktok_url: string;
}
const EMPTY_FORM: BookForm = { title: "", author: "", language: "mandarin", type: "digital", price: "", description: "", cover_url: "", badge: "", featured: false, shopee_url: "", tokopedia_url: "", tiktok_url: "" };

export default function AdminDashboard() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [me, setMe] = useState<AdminUser | null>(null);
  const [checking, setChecking] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Book | null>(null);
  const [form, setForm] = useState<BookForm>(EMPTY_FORM);
  const [shipEdit, setShipEdit] = useState<Record<string, { cost: string; eta: string }>>({});

  useEffect(() => {
    if (!getAdminToken()) {
      navigate("/admin/login", { replace: true });
      return;
    }
    aGet<AdminUser>("/auth/me")
      .then(setMe)
      .catch(() => {
        clearAdminToken();
        navigate("/admin/login", { replace: true });
      })
      .finally(() => setChecking(false));
  }, [navigate]);

  const stats = useQuery({ queryKey: ["admin-stats"], queryFn: () => aGet<AdminStats>("/admin/stats"), enabled: !!me });
  const orders = useQuery({ queryKey: ["admin-orders"], queryFn: () => aGet<Order[]>("/admin/orders"), enabled: !!me });
  const books = useQuery({ queryKey: ["admin-books"], queryFn: () => aGet<Book[]>("/books"), enabled: !!me });
  const shipping = useQuery({ queryKey: ["shipping"], queryFn: () => aGet<ShippingRegion[]>("/shipping"), enabled: !!me });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["admin-stats"] });
    qc.invalidateQueries({ queryKey: ["admin-orders"] });
    qc.invalidateQueries({ queryKey: ["admin-books"] });
    qc.invalidateQueries({ queryKey: ["shipping"] });
  };

  const updateStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => aPatch(`/admin/orders/${id}`, { status }),
    onSuccess: () => { toast.success("Status pesanan diperbarui"); refresh(); },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  const saveBook = useMutation({
    mutationFn: () => {
      const body = { ...form, price: parseInt(form.price) || 0 };
      return editing ? aPut(`/admin/books/${editing.id}`, body) : aPost("/admin/books", body);
    },
    onSuccess: () => {
      toast.success(editing ? "Buku diperbarui" : "Buku ditambahkan");
      setDialogOpen(false);
      setEditing(null);
      setForm(EMPTY_FORM);
      refresh();
    },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  const deleteBook = useMutation({
    mutationFn: (id: string) => aDelete(`/admin/books/${id}`),
    onSuccess: () => { toast.success("Buku dihapus"); refresh(); },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  const saveShipping = useMutation({
    mutationFn: (r: ShippingRegion) => aPut(`/admin/shipping/${r.id}`, { name: r.name, cost: parseInt(shipEdit[r.id]?.cost ?? "") || r.cost, eta: shipEdit[r.id]?.eta ?? r.eta }),
    onSuccess: () => { toast.success("Ongkir diperbarui"); refresh(); },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  const openEdit = (b: Book) => {
    setEditing(b);
    setForm({ title: b.title, author: b.author, language: b.language, type: b.type, price: String(b.price), description: b.description, cover_url: b.cover_url, badge: b.badge, featured: b.featured, shopee_url: b.shopee_url, tokopedia_url: b.tokopedia_url, tiktok_url: b.tiktok_url });
    setDialogOpen(true);
  };

  const logout = async () => {
    await aPost("/auth/logout").catch(() => undefined);
    clearAdminToken();
    navigate("/admin/login", { replace: true });
  };

  if (checking) {
    return <div className="flex min-h-screen items-center justify-center bg-[#FAF7F2]"><Loader2 className="size-8 animate-spin text-[#DD6B20]" /></div>;
  }

  const customerWa = (phone: string) => {
    const p = phone.replace(/[^0-9]/g, "");
    return `https://wa.me/${p.startsWith("0") ? "62" + p.slice(1) : p}`;
  };

  return (
    <div className="min-h-screen bg-[#FAF7F2]" data-testid="admin-dashboard">
      <header className="sticky top-0 z-40 border-b border-[#E8DFC8]/70 bg-[#FAF7F2]/85 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2.5">
            <span className="flex size-9 items-center justify-center rounded-xl bg-[#DD6B20] text-white"><BookOpen className="size-5" /></span>
            <div>
              <p className="font-heading text-base font-bold leading-tight">LAMIMI_ID Admin</p>
              <p className="text-[11px] text-[#635F59]">{me?.email}</p>
            </div>
          </div>
          <button onClick={logout} data-testid="admin-logout-button" className="inline-flex items-center gap-2 rounded-full border border-[#E8DFC8] bg-white px-4 py-2 text-sm font-medium text-[#635F59] hover:text-red-600">
            <LogOut className="size-4" /> Keluar
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4" data-testid="admin-stats">
          {[
            { label: "Total Pesanan", value: stats.data?.total_orders ?? "—", icon: <Package className="size-5 text-[#DD6B20]" /> },
            { label: "Sudah Lunas", value: stats.data?.paid_orders ?? "—", icon: <Wallet className="size-5 text-green-600" /> },
            { label: "Menunggu", value: stats.data?.pending_orders ?? "—", icon: <Loader2 className="size-5 text-amber-600" /> },
            { label: "Pendapatan", value: stats.data ? rupiah(stats.data.revenue) : "—", icon: <Wallet className="size-5 text-[#0D9488]" /> },
          ].map((s) => (
            <div key={s.label} className="rounded-2xl border border-[#E8DFC8] bg-white p-5">
              <div className="flex items-center justify-between"><p className="text-xs font-medium text-[#635F59]">{s.label}</p>{s.icon}</div>
              <p className="mt-2 font-mono text-2xl font-bold tracking-tight">{s.value}</p>
            </div>
          ))}
        </div>

        <Tabs defaultValue="pesanan" className="mt-8">
          <TabsList>
            <TabsTrigger value="pesanan" data-testid="tab-orders">Pesanan</TabsTrigger>
            <TabsTrigger value="buku" data-testid="tab-books">Buku</TabsTrigger>
            <TabsTrigger value="ongkir" data-testid="tab-shipping">Ongkir JNE</TabsTrigger>
          </TabsList>

          <TabsContent value="pesanan" className="mt-6">
            <div className="overflow-x-auto rounded-2xl border border-[#E8DFC8] bg-white">
              <table className="w-full min-w-[760px] text-sm">
                <thead>
                  <tr className="border-b border-[#E8DFC8] text-left text-xs uppercase tracking-wide text-[#635F59]">
                    <th className="px-5 py-3.5">Pesanan</th><th className="px-5 py-3.5">Customer</th><th className="px-5 py-3.5">Item</th><th className="px-5 py-3.5">Jenis</th><th className="px-5 py-3.5">Total</th><th className="px-5 py-3.5">Status</th><th className="px-5 py-3.5"></th>
                  </tr>
                </thead>
                <tbody>
                  {(orders.data ?? []).map((o) => (
                    <tr key={o.id} className="border-b border-[#E8DFC8]/60 last:border-0" data-testid={`order-row-${o.order_number}`}>
                      <td className="px-5 py-3.5"><p className="font-mono font-bold">{o.order_number}</p><p className="text-xs text-[#635F59]">{formatDate(o.created_at)}</p></td>
                      <td className="px-5 py-3.5"><p className="font-medium">{o.customer_name}</p><p className="text-xs text-[#635F59]">{o.customer_phone}</p></td>
                      <td className="max-w-52 px-5 py-3.5"><p className="truncate text-xs">{o.items.map((i) => i.title).join(", ")}</p></td>
                      <td className="px-5 py-3.5"><span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${o.order_type === "digital" ? "bg-[#E0F2FE] text-[#0369A1]" : "bg-[#FEEBC8] text-[#9A3412]"}`}>{o.order_type === "digital" ? "Ebook" : "Fisik"}</span></td>
                      <td className="px-5 py-3.5 font-mono font-bold text-[#9C4221]">{rupiah(o.total)}</td>
                      <td className="px-5 py-3.5">
                        <Select value={o.status} onValueChange={(v) => updateStatus.mutate({ id: o.id, status: v })}>
                          <SelectTrigger size="sm" data-testid={`order-status-select-${o.order_number}`}>
                            <SelectValue>{(v: string) => ORDER_STATUS[v]?.label ?? v}</SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            {Object.entries(ORDER_STATUS).map(([k, s]) => <SelectItem key={k} value={k}>{s.label}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="px-5 py-3.5">
                        <a href={customerWa(o.customer_phone)} target="_blank" rel="noreferrer" data-testid={`order-wa-${o.order_number}`} className="inline-flex items-center gap-1 rounded-full bg-green-600 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-green-700">
                          <MessageCircle className="size-3" /> Chat
                        </a>
                      </td>
                    </tr>
                  ))}
                  {orders.data?.length === 0 && <tr><td colSpan={7} className="px-5 py-10 text-center text-sm text-[#635F59]">Belum ada pesanan masuk.</td></tr>}
                </tbody>
              </table>
            </div>
          </TabsContent>

          <TabsContent value="buku" className="mt-6">
            <button onClick={() => { setEditing(null); setForm(EMPTY_FORM); setDialogOpen(true); }} data-testid="admin-add-book-button" className="inline-flex items-center gap-2 rounded-full bg-[#DD6B20] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#C05621]">
              <BookPlus className="size-4" /> Tambah Buku
            </button>
            <div className="mt-5 overflow-x-auto rounded-2xl border border-[#E8DFC8] bg-white">
              <table className="w-full min-w-[720px] text-sm">
                <thead>
                  <tr className="border-b border-[#E8DFC8] text-left text-xs uppercase tracking-wide text-[#635F59]">
                    <th className="px-5 py-3.5">Buku</th><th className="px-5 py-3.5">Bahasa</th><th className="px-5 py-3.5">Jenis</th><th className="px-5 py-3.5">Harga</th><th className="px-5 py-3.5"></th>
                  </tr>
                </thead>
                <tbody>
                  {(books.data ?? []).map((b) => (
                    <tr key={b.id} className="border-b border-[#E8DFC8]/60 last:border-0" data-testid={`book-row-${b.id}`}>
                      <td className="px-5 py-3"><div className="flex items-center gap-3"><img src={b.cover_url} alt="" className="h-12 w-9 rounded-md border border-[#E8DFC8] object-cover" /><p className="font-medium">{b.title}</p></div></td>
                      <td className="px-5 py-3"><span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${LANGUAGE_META[b.language]?.chip ?? ""}`}>{LANGUAGE_META[b.language]?.label ?? b.language}</span></td>
                      <td className="px-5 py-3 text-xs">{b.type === "digital" ? "Ebook" : "Fisik"}</td>
                      <td className="px-5 py-3 font-mono font-bold text-[#9C4221]">{rupiah(b.price)}</td>
                      <td className="px-5 py-3">
                        <div className="flex gap-1.5">
                          <button onClick={() => openEdit(b)} data-testid={`edit-book-${b.id}`} className="rounded-full border border-[#E8DFC8] p-2 text-[#635F59] hover:border-[#DD6B20] hover:text-[#C05621]"><Pencil className="size-3.5" /></button>
                          <button onClick={() => window.confirm(`Hapus "${b.title}"?`) && deleteBook.mutate(b.id)} data-testid={`delete-book-${b.id}`} className="rounded-full border border-[#E8DFC8] p-2 text-[#635F59] hover:border-red-300 hover:text-red-600"><Trash2 className="size-3.5" /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </TabsContent>

          <TabsContent value="ongkir" className="mt-6">
            <p className="max-w-lg text-sm text-[#635F59]">Tarif flat JNE per wilayah. Angka ini yang muncul saat customer checkout buku fisik.</p>
            <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {(shipping.data ?? []).map((r) => (
                <div key={r.id} className="rounded-2xl border border-[#E8DFC8] bg-white p-5" data-testid={`shipping-card-${r.id}`}>
                  <p className="font-heading font-semibold">{r.name}</p>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-xs">Ongkir (Rp)</Label>
                      <Input data-testid={`shipping-cost-${r.id}`} value={shipEdit[r.id]?.cost ?? String(r.cost)} onChange={(e) => setShipEdit((s) => ({ ...s, [r.id]: { cost: e.target.value, eta: s[r.id]?.eta ?? r.eta } }))} className="mt-1" />
                    </div>
                    <div>
                      <Label className="text-xs">Estimasi</Label>
                      <Input data-testid={`shipping-eta-${r.id}`} value={shipEdit[r.id]?.eta ?? r.eta} onChange={(e) => setShipEdit((s) => ({ ...s, [r.id]: { cost: s[r.id]?.cost ?? String(r.cost), eta: e.target.value } }))} className="mt-1" />
                    </div>
                  </div>
                  <button onClick={() => saveShipping.mutate(r)} data-testid={`shipping-save-${r.id}`} className="mt-3 w-full rounded-full bg-[#1F1D1A] py-2 text-xs font-semibold text-white hover:bg-[#3a352f]">Simpan</button>
                </div>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </main>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg" data-testid="book-form-dialog">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Buku" : "Tambah Buku Baru"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3.5 sm:grid-cols-2">
            <div className="sm:col-span-2"><Label>Judul *</Label><Input data-testid="admin-book-title-input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="mt-1.5" /></div>
            <div><Label>Penulis</Label><Input data-testid="admin-book-author-input" value={form.author} onChange={(e) => setForm({ ...form, author: e.target.value })} className="mt-1.5" /></div>
            <div><Label>Harga (Rp) *</Label><Input data-testid="admin-book-price-input" type="number" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} className="mt-1.5" /></div>
            <div>
              <Label>Bahasa</Label>
              <Select value={form.language} onValueChange={(v) => setForm({ ...form, language: v })}>
                <SelectTrigger className="mt-1.5 w-full" data-testid="admin-book-language-select"><SelectValue>{(v: string) => LANGUAGE_META[v]?.label ?? v}</SelectValue></SelectTrigger>
                <SelectContent>{Object.entries(LANGUAGE_META).map(([k, m]) => <SelectItem key={k} value={k}>{m.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Jenis</Label>
              <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                <SelectTrigger className="mt-1.5 w-full" data-testid="admin-book-type-select"><SelectValue>{(v: string) => (v === "digital" ? "Ebook Digital" : "Buku Fisik")}</SelectValue></SelectTrigger>
                <SelectContent><SelectItem value="digital">Ebook Digital</SelectItem><SelectItem value="fisik">Buku Fisik</SelectItem></SelectContent>
              </Select>
            </div>
            <div className="sm:col-span-2"><Label>URL Sampul</Label><Input data-testid="admin-book-cover-input" value={form.cover_url} onChange={(e) => setForm({ ...form, cover_url: e.target.value })} placeholder="https://..." className="mt-1.5" /></div>
            <div><Label>Badge</Label><Input data-testid="admin-book-badge-input" value={form.badge} onChange={(e) => setForm({ ...form, badge: e.target.value })} placeholder="HSK 1-2" className="mt-1.5" /></div>
            <div className="flex items-end gap-2 pb-1">
              <Checkbox checked={form.featured} onCheckedChange={(c) => setForm({ ...form, featured: c === true })} data-testid="admin-book-featured-checkbox" />
              <Label>Unggulan di beranda</Label>
            </div>
            <div className="sm:col-span-2"><Label>Deskripsi</Label><Textarea data-testid="admin-book-description-input" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="mt-1.5" /></div>
            {form.type === "fisik" && (
              <>
                <div className="sm:col-span-2"><Label>Link Shopee</Label><Input data-testid="admin-book-shopee-input" value={form.shopee_url} onChange={(e) => setForm({ ...form, shopee_url: e.target.value })} className="mt-1.5" /></div>
                <div><Label>Link Tokopedia</Label><Input data-testid="admin-book-tokopedia-input" value={form.tokopedia_url} onChange={(e) => setForm({ ...form, tokopedia_url: e.target.value })} className="mt-1.5" /></div>
                <div><Label>Link TikTok Shop</Label><Input data-testid="admin-book-tiktok-input" value={form.tiktok_url} onChange={(e) => setForm({ ...form, tiktok_url: e.target.value })} className="mt-1.5" /></div>
              </>
            )}
          </div>
          <button
            onClick={() => (form.title.trim() && form.price ? saveBook.mutate() : toast.error("Judul dan harga wajib diisi."))}
            disabled={saveBook.isPending}
            data-testid="admin-book-save-button"
            className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#DD6B20] py-3 text-sm font-semibold text-white hover:bg-[#C05621] disabled:opacity-60"
          >
            {saveBook.isPending ? <Loader2 className="size-4 animate-spin" /> : <BookOpen className="size-4" />}
            {editing ? "Simpan Perubahan" : "Tambah Buku"}
          </button>
        </DialogContent>
      </Dialog>
    </div>
  );
}

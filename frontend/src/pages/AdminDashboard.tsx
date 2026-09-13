import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BookOpen, BookPlus, Calendar, Eye, ImageUp, Landmark, Layers, Loader2, LogOut, MessageCircle, Package, Pencil, Plus, Search, Ticket, Trash2, Wallet, X } from "lucide-react";
import { toast } from "sonner";
import type { AdminStats, AdminUser, Book, Order, PaymentMethod, ShippingRegion, BookCategory, LanguageEntry, Voucher } from "@/lib/types";
import { LANGUAGE_META } from "@/lib/types";
import { formatDate, ORDER_STATUS, rupiah } from "@/lib/format";
import { aDelete, aGet, aPatch, aPost, aPut, apiErrorMessage, clearAdminToken, getAdminToken, uploadCover } from "@/lib/adminApi";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { filterAdminBookRowsByType } from "@/lib/adminBookFilters";

interface BookForm {
  title: string; author: string; language: string; type: string; price: string;
  description: string; cover_url: string; badge: string; featured: boolean;
  shopee_url: string; tokopedia_url: string; tiktok_url: string; stock: string;
  categories: string[];
}
const EMPTY_FORM: BookForm = { title: "", author: "", language: "mandarin", type: "digital", price: "", description: "", cover_url: "", badge: "", featured: false, shopee_url: "", tokopedia_url: "", tiktok_url: "", stock: "-1", categories: [] };

interface VGroup { name: string; options: string }
interface VRow { id: string; label: string; selections: Record<string, string>; price: string; stock: string }

function parseGroups(groups: VGroup[]) {
  return groups
    .map((g) => ({ name: g.name.trim(), options: g.options.split(",").map((o) => o.trim()).filter(Boolean) }))
    .filter((g) => g.name && g.options.length > 0);
}

const parseStock = (s: string) => (s.trim() === "" ? -1 : parseInt(s));

const ADMIN_BOOK_PAGE_SIZE = 20;

export default function AdminDashboard() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [me, setMe] = useState<AdminUser | null>(null);
  const [checking, setChecking] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Book | null>(null);
  const [form, setForm] = useState<BookForm>(EMPTY_FORM);
  const [vGroups, setVGroups] = useState<VGroup[]>([]);
  const [vRows, setVRows] = useState<VRow[]>([]);
  const [shipEdit, setShipEdit] = useState<Record<string, { cost: string; eta: string }>>({});
  const [pmEdit, setPmEdit] = useState<Record<string, { account_name: string; account_number: string; qr_image: string; active: boolean }>>({});
  const [proofView, setProofView] = useState<string | null>(null);
  const [voucherForm, setVoucherForm] = useState({ code: "", description: "", discount_type: "amount", discount_value: "0", active: true, valid_from: "", valid_until: "" });
  const [voucherEditingId, setVoucherEditingId] = useState<string | null>(null);
  const [languageForm, setLanguageForm] = useState({ name: "", description: "", label: "" });
  const [languageEditingId, setLanguageEditingId] = useState<string | null>(null);
  const [categoryForm, setCategoryForm] = useState({ name: "", description: "", parentKey: "global" });
  const [categoryEditingId, setCategoryEditingId] = useState<string | null>(null);
  const [adminBookPage, setAdminBookPage] = useState(1);
  const [adminBookCategory, setAdminBookCategory] = useState("semua");
  const [adminBookType, setAdminBookType] = useState("semua");
  const [adminBookSearch, setAdminBookSearch] = useState("");
  const [adminBookSort, setAdminBookSort] = useState("newest");
  const [adminOrderSearch, setAdminOrderSearch] = useState("");
  const [adminOrderDate, setAdminOrderDate] = useState("");

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
  const orders = useQuery({
    queryKey: ["admin-orders", adminOrderSearch, adminOrderDate],
    queryFn: () => aGet<Order[]>(`/admin/orders?${adminOrderSearch ? `search=${encodeURIComponent(adminOrderSearch)}&` : ""}${adminOrderDate ? `date=${encodeURIComponent(adminOrderDate)}` : ""}`),
    enabled: !!me,
  });
  const books = useQuery({ queryKey: ["admin-books"], queryFn: () => aGet<Book[]>("/books"), enabled: !!me });
  const shipping = useQuery({ queryKey: ["shipping"], queryFn: () => aGet<ShippingRegion[]>("/shipping"), enabled: !!me });
  const payMethods = useQuery({ queryKey: ["admin-payment-methods"], queryFn: () => aGet<PaymentMethod[]>("/admin/payment-methods"), enabled: !!me });
  const vouchers = useQuery({ queryKey: ["admin-vouchers"], queryFn: () => aGet<Voucher[]>("/admin/vouchers"), enabled: !!me });
  const languages = useQuery({ queryKey: ["admin-languages"], queryFn: () => aGet<LanguageEntry[]>("/admin/languages"), enabled: !!me });
  const categories = useQuery({ queryKey: ["admin-categories"], queryFn: () => aGet<BookCategory[]>("/admin/categories"), enabled: !!me });

  const adminBookRows = useMemo(() => {
    const rows = filterAdminBookRowsByType(books.data ?? [], adminBookType).filter((b) => {
      if (adminBookCategory !== "semua" && !(b.categories ?? []).includes(adminBookCategory)) return false;
      if (!adminBookSearch.trim()) return true;
      return b.title.toLowerCase().includes(adminBookSearch.trim().toLowerCase());
    });

    const sorted = [...rows];
    switch (adminBookSort) {
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
  }, [adminBookCategory, adminBookSearch, adminBookSort, adminBookType, books.data]);

  const adminBookPageCount = Math.max(1, Math.ceil(adminBookRows.length / ADMIN_BOOK_PAGE_SIZE));
  const adminBookPageStart = (adminBookPage - 1) * ADMIN_BOOK_PAGE_SIZE;
  const adminBookPageRows = adminBookRows.slice(adminBookPageStart, adminBookPageStart + ADMIN_BOOK_PAGE_SIZE);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["admin-stats"] });
    qc.invalidateQueries({ queryKey: ["admin-orders"] });
    qc.invalidateQueries({ queryKey: ["admin-books"] });
    qc.invalidateQueries({ queryKey: ["shipping"] });
    qc.invalidateQueries({ queryKey: ["admin-payment-methods"] });
    qc.invalidateQueries({ queryKey: ["admin-vouchers"] });
    qc.invalidateQueries({ queryKey: ["admin-languages"] });
    qc.invalidateQueries({ queryKey: ["admin-categories"] });
  };

  const updateStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => aPatch(`/admin/orders/${id}`, { status }),
    onSuccess: () => { toast.success("Status pesanan diperbarui"); refresh(); },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  const saveBook = useMutation({
    mutationFn: () => {
      const groups = parseGroups(vGroups);
      const body = {
        ...form,
        price: parseInt(form.price) || 0,
        stock: parseStock(form.stock),
        categories: form.categories,
        variant_groups: groups,
        variants: vRows.map((r) => ({ id: r.id, label: r.label, selections: r.selections, price: parseInt(r.price) || 0, stock: parseStock(r.stock) })),
      };
      return editing ? aPut(`/admin/books/${editing.id}`, body) : aPost("/admin/books", body);
    },
    onSuccess: () => {
      toast.success(editing ? "Buku diperbarui" : "Buku ditambahkan");
      setDialogOpen(false);
      setEditing(null);
      setForm(EMPTY_FORM);
      setVGroups([]);
      setVRows([]);
      refresh();
    },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  const deleteBook = useMutation({
    mutationFn: (id: string) => aDelete(`/admin/books/${id}`),
    onSuccess: () => { toast.success("Buku dihapus"); refresh(); },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  const saveLanguage = useMutation({
    mutationFn: () => {
      const payload = {
        name: languageForm.name.trim(),
        slug: (languageForm.label || languageForm.name).trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
        label: languageForm.label.trim() || languageForm.name.trim(),
        description: languageForm.description.trim(),
        active: true,
      };
      return languageEditingId ? aPut<LanguageEntry>(`/admin/languages/${languageEditingId}`, payload) : aPost<LanguageEntry>("/admin/languages", payload);
    },
    onSuccess: () => {
      toast.success(languageEditingId ? "Bahasa diperbarui" : "Bahasa ditambahkan");
      setLanguageEditingId(null);
      setLanguageForm({ name: "", description: "", label: "" });
      refresh();
    },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  const deleteLanguage = useMutation({
    mutationFn: (id: string) => aDelete(`/admin/languages/${id}`),
    onSuccess: () => { toast.success("Bahasa dihapus"); refresh(); },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  const saveCategory = useMutation({
    mutationFn: () => {
      const [pkType, pkSlug] = categoryForm.parentKey.includes(":") ? categoryForm.parentKey.split(":") : ["", ""];
      const payload = {
        name: categoryForm.name.trim(),
        slug: categoryForm.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
        description: categoryForm.description.trim(),
        parent: pkSlug,
        parent_type: pkType === "lang" ? "language" : pkType === "cat" ? "category" : "",
        active: true,
      };
      return categoryEditingId ? aPut<BookCategory>(`/admin/categories/${categoryEditingId}`, payload) : aPost<BookCategory>("/admin/categories", payload);
    },
    onSuccess: () => {
      toast.success(categoryEditingId ? "Kategori diperbarui" : "Kategori ditambahkan");
      setCategoryEditingId(null);
      setCategoryForm({ name: "", description: "", parentKey: "global" });
      refresh();
    },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  const deleteCategory = useMutation({
    mutationFn: (id: string) => aDelete(`/admin/categories/${id}`),
    onSuccess: () => { toast.success("Kategori dihapus"); refresh(); },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  const saveVoucher = useMutation({
    mutationFn: () => {
      const payload = {
        code: voucherForm.code.trim().toUpperCase(),
        description: voucherForm.description.trim(),
        discount_type: voucherForm.discount_type,
        discount_value: parseInt(voucherForm.discount_value) || 0,
        active: voucherForm.active,
        valid_from: voucherForm.valid_from ? new Date(voucherForm.valid_from).toISOString() : new Date().toISOString(),
        valid_until: voucherForm.valid_until ? new Date(voucherForm.valid_until).toISOString() : new Date().toISOString(),
      };
      return voucherEditingId ? aPut<Voucher>(`/admin/vouchers/${voucherEditingId}`, payload) : aPost<Voucher>("/admin/vouchers", payload);
    },
    onSuccess: () => {
      toast.success(voucherEditingId ? "Voucher diperbarui" : "Voucher ditambahkan");
      setVoucherEditingId(null);
      setVoucherForm({ code: "", description: "", discount_type: "amount", discount_value: "0", active: true, valid_from: "", valid_until: "" });
      refresh();
    },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  const deleteVoucher = useMutation({
    mutationFn: (id: string) => aDelete(`/admin/vouchers/${id}`),
    onSuccess: () => { toast.success("Voucher dihapus"); refresh(); },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  const saveShipping = useMutation({
    mutationFn: (r: ShippingRegion) => aPut(`/admin/shipping/${r.id}`, { name: r.name, cost: parseInt(shipEdit[r.id]?.cost ?? "") || r.cost, eta: shipEdit[r.id]?.eta ?? r.eta }),
    onSuccess: () => { toast.success("Ongkir diperbarui"); refresh(); },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  const savePayMethod = useMutation({
    mutationFn: (m: PaymentMethod) => {
      const edit = pmEdit[m.id] ?? { account_name: m.account_name, account_number: m.account_number, qr_image: m.qr_image, active: m.active };
      return aPut(`/admin/payment-methods/${m.id}`, { name: m.name, ...edit });
    },
    onSuccess: () => { toast.success("Metode pembayaran diperbarui"); refresh(); },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  const openEdit = (b: Book) => {
    setEditing(b);
    setForm({ title: b.title, author: b.author, language: b.language, type: b.type, price: String(b.price), description: b.description, cover_url: b.cover_url, badge: b.badge, featured: b.featured, shopee_url: b.shopee_url, tokopedia_url: b.tokopedia_url, tiktok_url: b.tiktok_url, stock: String(b.stock ?? -1), categories: b.categories ?? [] });
    setVGroups(b.variant_groups.map((g) => ({ name: g.name, options: g.options.join(", ") })));
    setVRows(b.variants.map((v) => ({ id: v.id, label: v.label, selections: v.selections, price: String(v.price), stock: String(v.stock ?? -1) })));
    setDialogOpen(true);
  };

  const openNew = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setVGroups([]);
    setVRows([]);
    setDialogOpen(true);
  };

  const generateCombos = () => {
    const groups = parseGroups(vGroups);
    if (groups.length === 0) {
      setVRows([]);
      return;
    }
    let combos: Record<string, string>[] = [{}];
    for (const g of groups) {
      combos = combos.flatMap((c) => g.options.map((o) => ({ ...c, [g.name]: o })));
    }
    if (combos.length > 200) return toast.error("Kombinasi terlalu banyak (maks 200). Kurangi opsi variasinya.");
    setVRows((prev) =>
      combos.map((c) => {
        const label = groups.map((g) => c[g.name]).join(" / ");
        const existing = prev.find((r) => r.label === label);
        return { id: existing?.id ?? crypto.randomUUID(), label, selections: c, price: existing?.price ?? form.price ?? "0", stock: existing?.stock ?? "-1" };
      }),
    );
    toast.success(`${combos.length} kombinasi variasi dibuat`);
  };

  const logout = async () => {
    await aPost("/auth/logout").catch(() => undefined);
    clearAdminToken();
    navigate("/admin/login", { replace: true });
  };

  const onCoverFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) return toast.error("Format file harus gambar.");
    if (file.size > 2 * 1024 * 1024) return toast.error("Ukuran gambar maksimal 2 MB.");
    try {
      const { cover_url } = await uploadCover(file);
      setForm((s) => ({ ...s, cover_url }));
      toast.success("Gambar sampul berhasil diupload");
    } catch (err) {
      toast.error(apiErrorMessage(err));
    }
  };

  const onQrFile = (m: PaymentMethod) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) return toast.error("Ukuran gambar maksimal 2 MB.");
    const reader = new FileReader();
    reader.onload = () =>
      setPmEdit((s) => ({ ...s, [m.id]: { account_name: s[m.id]?.account_name ?? m.account_name, account_number: s[m.id]?.account_number ?? m.account_number, active: s[m.id]?.active ?? m.active, qr_image: String(reader.result) } }));
    reader.readAsDataURL(file);
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
            { label: "Sudah Bayar", value: stats.data?.paid_orders ?? "—", icon: <Wallet className="size-5 text-green-600" /> },
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
            <TabsTrigger value="pembayaran" data-testid="tab-payment">Pembayaran</TabsTrigger>
            <TabsTrigger value="promo" data-testid="tab-vouchers"><Ticket className="size-3.5" /> Promo</TabsTrigger>
            <TabsTrigger value="bahasa" data-testid="tab-languages">Bahasa</TabsTrigger>
            <TabsTrigger value="kategori" data-testid="tab-categories">Kategori</TabsTrigger>
          </TabsList>

          <TabsContent value="pesanan" className="mt-6">
            <div className="mb-4 flex flex-wrap items-center gap-3 rounded-2xl border border-[#E8DFC8] bg-white p-3">
              <div className="relative min-w-[260px] flex-1">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#635F59]" />
                <Input
                  type="search"
                  value={adminOrderSearch}
                  onChange={(e) => setAdminOrderSearch(e.target.value)}
                  placeholder="Cari nama customer atau nomor pesanan"
                  className="pl-9"
                  data-testid="admin-order-search"
                />
              </div>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#635F59]" />
                <Input
                  type="date"
                  value={adminOrderDate}
                  onChange={(e) => setAdminOrderDate(e.target.value)}
                  className="pl-9"
                  data-testid="admin-order-date"
                />
              </div>
            </div>
            <div className="overflow-x-auto rounded-2xl border border-[#E8DFC8] bg-white">
              <table className="w-full min-w-[820px] text-sm">
                <thead>
                  <tr className="border-b border-[#E8DFC8] text-left text-xs uppercase tracking-wide text-[#635F59]">
                    <th className="px-5 py-3.5">Pesanan</th><th className="px-5 py-3.5">Customer</th><th className="px-5 py-3.5">Item</th><th className="px-5 py-3.5">Jenis</th><th className="px-5 py-3.5">Total</th><th className="px-5 py-3.5">Status</th><th className="px-5 py-3.5"></th>
                  </tr>
                </thead>
                <tbody>
                  {(orders.data ?? []).map((o) => (
                    <tr key={o.id} className="border-b border-[#E8DFC8]/60 last:border-0" data-testid={`order-row-${o.order_number}`}>
                      <td className="px-5 py-3.5">
                        <p className="font-mono font-bold">{o.order_number}</p>
                        <p className="text-xs text-[#635F59]">{formatDate(o.created_at)}</p>
                        {o.payment_method && <p className="mt-0.5 text-[11px] text-[#635F59]">{o.payment_method}</p>}
                      </td>
                      <td className="px-5 py-3.5"><p className="font-medium">{o.customer_name}</p><p className="text-xs text-[#635F59]">{o.customer_phone}</p></td>
                      <td className="max-w-60 px-5 py-3.5"><p className="line-clamp-2 text-xs">{o.items.map((i) => i.title + (i.variant_label ? ` (${i.variant_label})` : "")).join(", ")}</p></td>
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
                        <div className="space-y-1">
                          <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${o.payment_status === "Pembayaran Diterima" ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}>{o.payment_status}</span>
                          {o.payment_shortage > 0 && <span className="text-[11px] font-semibold text-[#B91C1C]">Kurang: {rupiah(o.payment_shortage)}</span>}
                          {o.payment_received_amount > 0 && <span className="block text-[11px] text-[#635F59]">Dibayar: {rupiah(o.payment_received_amount)}</span>}
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex gap-1.5">
                          {o.payment_proof && (
                            <button onClick={() => setProofView(o.payment_proof)} data-testid={`order-proof-${o.order_number}`} className="inline-flex items-center gap-1 rounded-full border border-[#E8DFC8] bg-white px-3 py-1.5 text-[11px] font-semibold text-[#635F59] hover:border-[#DD6B20] hover:text-[#C05621]">
                              <Eye className="size-3" /> Bukti
                            </button>
                          )}
                          <a href={customerWa(o.customer_phone)} target="_blank" rel="noreferrer" data-testid={`order-wa-${o.order_number}`} className="inline-flex items-center gap-1 rounded-full bg-green-600 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-green-700">
                            <MessageCircle className="size-3" /> Chat
                          </a>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {orders.data?.length === 0 && <tr><td colSpan={7} className="px-5 py-10 text-center text-sm text-[#635F59]">Belum ada pesanan masuk.</td></tr>}
                </tbody>
              </table>
            </div>
          </TabsContent>

          <TabsContent value="buku" className="mt-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-3">
                <button onClick={openNew} data-testid="admin-add-book-button" className="inline-flex items-center gap-2 rounded-full bg-[#DD6B20] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#C05621]">
                  <BookPlus className="size-4" /> Tambah Buku
                </button>

                <div className="relative min-w-[260px]">
                  <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#635F59]" />
                  <Input
                    type="search"
                    value={adminBookSearch}
                    onChange={(e) => {
                      setAdminBookSearch(e.target.value);
                      setAdminBookPage(1);
                    }}
                    placeholder="Cari judul buku"
                    className="pl-9"
                    data-testid="admin-book-search"
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={adminBookType}
                  onChange={(e) => {
                    setAdminBookType(e.target.value);
                    setAdminBookPage(1);
                  }}
                  className="rounded-full border border-[#E8DFC8] bg-white px-4 py-2 text-xs font-semibold text-[#635F59] outline-none"
                  data-testid="admin-book-type-filter"
                >
                  <option value="semua">Semua tipe</option>
                  <option value="digital">Ebook</option>
                  <option value="fisik">Fisik</option>
                </select>

                <select
                  value={adminBookCategory}
                  onChange={(e) => {
                    setAdminBookCategory(e.target.value);
                    setAdminBookPage(1);
                  }}
                  className="rounded-full border border-[#E8DFC8] bg-white px-4 py-2 text-xs font-semibold text-[#635F59] outline-none"
                  data-testid="admin-book-category-filter"
                >
                  <option value="semua">Semua kategori</option>
                  {(categories.data ?? []).map((c) => (
                    <option key={c.id} value={c.slug}>{c.name}</option>
                  ))}
                </select>

                <select
                  value={adminBookSort}
                  onChange={(e) => {
                    setAdminBookSort(e.target.value);
                    setAdminBookPage(1);
                  }}
                  className="rounded-full border border-[#E8DFC8] bg-white px-4 py-2 text-xs font-semibold text-[#635F59] outline-none"
                  data-testid="admin-book-sort-filter"
                >
                  <option value="newest">Newest</option>
                  <option value="oldest">Oldest</option>
                  <option value="highest">Highest Price</option>
                  <option value="lowest">Lowest Price</option>
                </select>
              </div>
            </div>

            <div className="mt-5 overflow-x-auto rounded-2xl border border-[#E8DFC8] bg-white">
              <table className="w-full min-w-[720px] text-sm">
                <thead>
                  <tr className="border-b border-[#E8DFC8] text-left text-xs uppercase tracking-wide text-[#635F59]">
                    <th className="px-5 py-3.5">Buku</th><th className="px-5 py-3.5">Bahasa</th><th className="px-5 py-3.5">Jenis</th><th className="px-5 py-3.5">Harga</th><th className="px-5 py-3.5"></th>
                  </tr>
                </thead>
                <tbody>
                  {adminBookPageRows.map((b) => (
                    <tr key={b.id} className="border-b border-[#E8DFC8]/60 last:border-0" data-testid={`book-row-${b.id}`}>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <img src={b.cover_url} alt="" className="h-12 w-9 rounded-md border border-[#E8DFC8] object-cover" />
                          <div>
                            <p className="font-medium">{b.title}</p>
                            {b.variants.length > 0 && <p className="mt-0.5 flex items-center gap-1 text-[11px] text-[#635F59]"><Layers className="size-3" /> {b.variants.length} variasi</p>}
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3"><span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${LANGUAGE_META[b.language]?.chip ?? ""}`}>{LANGUAGE_META[b.language]?.label ?? b.language}</span></td>
                      <td className="px-5 py-3 text-xs">{b.type === "digital" ? "Ebook" : "Fisik"}</td>
                      <td className="px-5 py-3 font-mono font-bold text-[#9C4221]">
                        {b.variants.length > 0 ? `Mulai ${rupiah(Math.min(...b.variants.map((v) => v.price)))}` : rupiah(b.price)}
                      </td>
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

            {adminBookPageCount > 1 && (
              <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
                <button
                  onClick={() => setAdminBookPage((p) => Math.max(1, p - 1))}
                  disabled={adminBookPage === 1}
                  className="rounded-full border border-[#E8DFC8] bg-white px-4 py-2 text-xs font-semibold text-[#635F59] disabled:opacity-50"
                >
                  Prev
                </button>
                {Array.from({ length: adminBookPageCount }, (_, i) => i + 1).map((n) => (
                  <button
                    key={n}
                    onClick={() => setAdminBookPage(n)}
                    className={`min-w-10 rounded-full px-3 py-2 text-xs font-bold ${n === adminBookPage ? "bg-[#1F1D1A] text-white" : "border border-[#E8DFC8] bg-white text-[#635F59]"}`}
                  >
                    {n}
                  </button>
                ))}
                <button
                  onClick={() => setAdminBookPage((p) => Math.min(adminBookPageCount, p + 1))}
                  disabled={adminBookPage === adminBookPageCount}
                  className="rounded-full border border-[#E8DFC8] bg-white px-4 py-2 text-xs font-semibold text-[#635F59] disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            )}
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

          <TabsContent value="pembayaran" className="mt-6">
            <p className="max-w-lg text-sm text-[#635F59]">Rekening tujuan yang tampil ke customer saat checkout. QRIS: upload foto barcode agar muncul di halaman pembayaran.</p>
            <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {(payMethods.data ?? []).map((m) => {
                const edit = pmEdit[m.id] ?? { account_name: m.account_name, account_number: m.account_number, qr_image: m.qr_image, active: m.active };
                return (
                  <div key={m.id} className="rounded-2xl border border-[#E8DFC8] bg-white p-5" data-testid={`payment-card-${m.id}`}>
                    <p className="flex items-center gap-2 font-heading font-semibold"><Landmark className="size-4 text-[#DD6B20]" /> {m.name}</p>
                    <div className="mt-3 space-y-2.5">
                      <div>
                        <Label className="text-xs">Atas nama</Label>
                        <Input data-testid={`pm-name-${m.id}`} value={edit.account_name} onChange={(e) => setPmEdit((s) => ({ ...s, [m.id]: { ...edit, account_name: e.target.value } }))} className="mt-1" />
                      </div>
                      <div>
                        <Label className="text-xs">Nomor rekening / HP</Label>
                        <Input data-testid={`pm-number-${m.id}`} value={edit.account_number} onChange={(e) => setPmEdit((s) => ({ ...s, [m.id]: { ...edit, account_number: e.target.value } }))} className="mt-1" />
                      </div>
                      {m.name === "QRIS" && (
                        <div>
                          <Label className="text-xs">Foto barcode QRIS</Label>
                          {edit.qr_image && <img src={edit.qr_image} alt="QRIS" className="mt-2 w-32 rounded-lg border border-[#E8DFC8]" />}
                          <label className="mt-2 flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-[#E8DFC8] px-3 py-2.5 text-xs text-[#635F59] hover:border-[#DD6B20]" data-testid={`pm-qr-upload-${m.id}`}>
                            <ImageUp className="size-4 text-[#DD6B20]" /> {edit.qr_image ? "Ganti gambar" : "Upload gambar QRIS"}
                            <input type="file" accept="image/*" className="hidden" onChange={onQrFile(m)} data-testid={`pm-qr-input-${m.id}`} />
                          </label>
                        </div>
                      )}
                      <label className="flex items-center gap-2 text-xs text-[#635F59]">
                        <Checkbox checked={edit.active} onCheckedChange={(c) => setPmEdit((s) => ({ ...s, [m.id]: { ...edit, active: c === true } }))} data-testid={`pm-active-${m.id}`} />
                        Tampilkan ke customer
                      </label>
                    </div>
                    <button onClick={() => savePayMethod.mutate(m)} data-testid={`pm-save-${m.id}`} className="mt-3 w-full rounded-full bg-[#1F1D1A] py-2 text-xs font-semibold text-white hover:bg-[#3a352f]">Simpan</button>
                  </div>
                );
              })}
            </div>
          </TabsContent>

          <TabsContent value="promo" className="mt-6">
            <div className="rounded-2xl border border-[#E8DFC8] bg-white p-5">
              <div className="grid gap-4 md:grid-cols-5">
                <div>
                  <Label>Kode Voucher</Label>
                  <Input value={voucherForm.code} onChange={(e) => setVoucherForm({ ...voucherForm, code: e.target.value })} className="mt-1" data-testid="voucher-code-input" />
                </div>
                <div>
                  <Label>Deskripsi</Label>
                  <Input value={voucherForm.description} onChange={(e) => setVoucherForm({ ...voucherForm, description: e.target.value })} className="mt-1" data-testid="voucher-description-input" />
                </div>
                <div>
                  <Label>Tipe Diskon</Label>
                  <Select value={voucherForm.discount_type} onValueChange={(v) => setVoucherForm({ ...voucherForm, discount_type: v })}>
                    <SelectTrigger className="mt-1 w-full" data-testid="voucher-type-select"><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="amount">Nominal</SelectItem><SelectItem value="percent">Persen</SelectItem></SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Nilai Diskon</Label>
                  <Input type="number" value={voucherForm.discount_value} onChange={(e) => setVoucherForm({ ...voucherForm, discount_value: e.target.value })} className="mt-1" data-testid="voucher-amount-input" />
                </div>
                <div className="flex items-end">
                  <button onClick={() => saveVoucher.mutate()} className="w-full rounded-full bg-[#DD6B20] px-4 py-2 text-xs font-semibold text-white hover:bg-[#C05621]" data-testid="voucher-save-button">
                    {voucherEditingId ? "Simpan" : "Tambah"}
                  </button>
                </div>
              </div>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <div>
                  <Label>Mulai Berlaku</Label>
                  <Input type="datetime-local" value={voucherForm.valid_from} onChange={(e) => setVoucherForm({ ...voucherForm, valid_from: e.target.value })} className="mt-1" data-testid="voucher-from-input" />
                </div>
                <div>
                  <Label>Berakhir</Label>
                  <Input type="datetime-local" value={voucherForm.valid_until} onChange={(e) => setVoucherForm({ ...voucherForm, valid_until: e.target.value })} className="mt-1" data-testid="voucher-until-input" />
                </div>
              </div>
              <div className="mt-3 flex items-center gap-2 text-xs text-[#635F59]">
                <Checkbox checked={voucherForm.active} onCheckedChange={(c) => setVoucherForm({ ...voucherForm, active: c === true })} data-testid="voucher-active-checkbox" />
                <span>Aktif</span>
              </div>
              <div className="mt-5 grid gap-3">
                {(vouchers.data ?? []).map((v) => (
                  <div key={v.id} className="flex items-center justify-between rounded-xl border border-[#E8DFC8] p-3">
                    <div>
                      <p className="font-heading font-semibold">{v.code}</p>
                      <p className="text-xs text-[#635F59]">{v.description || "Promo"} · {v.discount_type === "percent" ? `${v.discount_value}%` : `Rp ${v.discount_value}`}</p>
                      <p className="text-[11px] text-[#635F59]">{formatDate(v.valid_from)} — {formatDate(v.valid_until)}</p>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => { setVoucherEditingId(v.id); setVoucherForm({ code: v.code, description: v.description, discount_type: v.discount_type, discount_value: String(v.discount_value), active: v.active, valid_from: v.valid_from ? new Date(v.valid_from).toISOString().slice(0,16) : "", valid_until: v.valid_until ? new Date(v.valid_until).toISOString().slice(0,16) : "" }); }} className="rounded-full border border-[#E8DFC8] p-2 text-[#635F59] hover:text-[#DD6B20]"><Pencil className="size-3.5" /></button>
                      <button onClick={() => window.confirm(`Hapus voucher "${v.code}"?`) && deleteVoucher.mutate(v.id)} className="rounded-full border border-[#E8DFC8] p-2 text-[#635F59] hover:text-red-600"><Trash2 className="size-3.5" /></button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="bahasa" className="mt-6">
            <div className="rounded-2xl border border-[#E8DFC8] bg-white p-5">
              <div className="grid gap-4 md:grid-cols-[1fr,1fr,1fr,auto]">
                <div>
                  <Label>Nama bahasa</Label>
                  <Input value={languageForm.name} onChange={(e) => setLanguageForm({ ...languageForm, name: e.target.value })} className="mt-1" data-testid="language-name-input" />
                </div>
                <div>
                  <Label>Label tampilan</Label>
                  <Input value={languageForm.label} onChange={(e) => setLanguageForm({ ...languageForm, label: e.target.value })} className="mt-1" data-testid="language-label-input" />
                </div>
                <div>
                  <Label>Deskripsi</Label>
                  <Input value={languageForm.description} onChange={(e) => setLanguageForm({ ...languageForm, description: e.target.value })} className="mt-1" data-testid="language-description-input" />
                </div>
                <div className="flex items-end">
                  <button onClick={() => saveLanguage.mutate()} className="w-full rounded-full bg-[#DD6B20] px-4 py-2 text-xs font-semibold text-white hover:bg-[#C05621]" data-testid="language-save-button">
                    {languageEditingId ? "Simpan" : "Tambah"}
                  </button>
                </div>
              </div>
              <div className="mt-5 grid gap-3">
                {(languages.data ?? []).map((l) => (
                  <div key={l.id} className="flex items-center justify-between rounded-xl border border-[#E8DFC8] p-3">
                    <div>
                      <p className="font-heading font-semibold">{l.label || l.name}</p>
                      <p className="text-xs text-[#635F59]">{l.description || l.slug}</p>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => { setLanguageEditingId(l.id); setLanguageForm({ name: l.name, description: l.description, label: l.label || l.name }); }} className="rounded-full border border-[#E8DFC8] p-2 text-[#635F59] hover:text-[#DD6B20]"><Pencil className="size-3.5" /></button>
                      <button onClick={() => window.confirm(`Hapus bahasa "${l.name}"?`) && deleteLanguage.mutate(l.id)} className="rounded-full border border-[#E8DFC8] p-2 text-[#635F59] hover:text-red-600"><Trash2 className="size-3.5" /></button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="kategori" className="mt-6">
            <div className="rounded-2xl border border-[#E8DFC8] bg-white p-5">
              <p className="mb-3 text-xs text-[#635F59]">Pilih induk bahasa untuk menjadikannya subkategori (misal "Mandarin Bisnis" di bawah Mandarin), atau biarkan Global agar tampil di semua bahasa.</p>
              <div className="grid gap-4 md:grid-cols-[1fr,1fr,1fr,auto]">
                <div>
                  <Label>Nama kategori</Label>
                  <Input value={categoryForm.name} onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })} className="mt-1" data-testid="category-name-input" />
                </div>
                <div>
                  <Label>Induk (opsional)</Label>
                  <Select value={categoryForm.parentKey} onValueChange={(v) => setCategoryForm({ ...categoryForm, parentKey: v })}>
                    <SelectTrigger className="mt-1 w-full" data-testid="category-parent-select">
                      <SelectValue>{(v: string) => {
                        if (v === "global") return "Global (semua bahasa)";
                        const [t, s] = v.split(":");
                        if (t === "lang") return `Bahasa: ${(languages.data ?? []).find((l) => l.slug === s)?.label ?? s}`;
                        return `Subkategori dari: ${(categories.data ?? []).find((c) => c.slug === s)?.name ?? s}`;
                      }}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="global">Global (semua bahasa)</SelectItem>
                      {(languages.data ?? []).map((l) => <SelectItem key={l.slug} value={`lang:${l.slug}`}>Bahasa: {l.label || l.name}</SelectItem>)}
                      {(categories.data ?? []).filter((c) => c.parent_type !== "category" && c.id !== categoryEditingId).map((c) => <SelectItem key={c.slug} value={`cat:${c.slug}`}>Subkategori dari: {c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Deskripsi</Label>
                  <Input value={categoryForm.description} onChange={(e) => setCategoryForm({ ...categoryForm, description: e.target.value })} className="mt-1" data-testid="category-description-input" />
                </div>
                <div className="flex items-end">
                  <button onClick={() => saveCategory.mutate()} className="w-full rounded-full bg-[#DD6B20] px-4 py-2 text-xs font-semibold text-white hover:bg-[#C05621]" data-testid="category-save-button">
                    {categoryEditingId ? "Simpan" : "Tambah"}
                  </button>
                </div>
              </div>
              <div className="mt-5 grid gap-3">
                {(categories.data ?? []).map((c) => (
                  <div key={c.id} className="flex items-center justify-between rounded-xl border border-[#E8DFC8] p-3">
                    <div>
                      <p className="font-heading font-semibold">{c.name}</p>
                      <p className="text-xs text-[#635F59]">
                        {c.parent_type === "category"
                          ? `Subkategori dari kategori "${(categories.data ?? []).find((x) => x.slug === c.parent)?.name ?? c.parent}"`
                          : c.parent
                            ? `Subkategori dari ${(languages.data ?? []).find((l) => l.slug === c.parent)?.label ?? c.parent}`
                            : "Global"}
                        {c.description ? ` · ${c.description}` : ""}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => { setCategoryEditingId(c.id); setCategoryForm({ name: c.name, description: c.description, parentKey: c.parent ? `${c.parent_type === "category" ? "cat" : "lang"}:${c.parent}` : "global" }); }} className="rounded-full border border-[#E8DFC8] p-2 text-[#635F59] hover:text-[#DD6B20]" data-testid={`category-edit-${c.slug}`}><Pencil className="size-3.5" /></button>
                      <button onClick={() => window.confirm(`Hapus kategori "${c.name}"?`) && deleteCategory.mutate(c.id)} className="rounded-full border border-[#E8DFC8] p-2 text-[#635F59] hover:text-red-600"><Trash2 className="size-3.5" /></button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </main>

      <Dialog open={!!proofView} onOpenChange={() => setProofView(null)}>
        <DialogContent className="sm:max-w-md" data-testid="proof-dialog">
          <DialogHeader><DialogTitle>Bukti Pembayaran</DialogTitle></DialogHeader>
          {proofView && <img src={proofView} alt="Bukti pembayaran" className="w-full rounded-xl border border-[#E8DFC8]" />}
        </DialogContent>
      </Dialog>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl" data-testid="book-form-dialog">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Buku" : "Tambah Buku Baru"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3.5 sm:grid-cols-2">
            <div className="sm:col-span-2"><Label>Judul *</Label><Input data-testid="admin-book-title-input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="mt-1.5" /></div>
            <div><Label>Penulis</Label><Input data-testid="admin-book-author-input" value={form.author} onChange={(e) => setForm({ ...form, author: e.target.value })} className="mt-1.5" /></div>
            <div><Label>Harga dasar (Rp) *</Label><Input data-testid="admin-book-price-input" type="number" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} className="mt-1.5" /></div>
            <div>
              <Label>Bahasa</Label>
              <Select value={form.language} onValueChange={(v) => setForm({ ...form, language: v })}>
                <SelectTrigger className="mt-1.5 w-full" data-testid="admin-book-language-select"><SelectValue>{(v: string) => (languages.data ?? []).find((l) => l.slug === v)?.label ?? v}</SelectValue></SelectTrigger>
                <SelectContent>{(languages.data ?? []).map((l) => <SelectItem key={l.slug} value={l.slug}>{l.label || l.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Jenis</Label>
              <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                <SelectTrigger className="mt-1.5 w-full" data-testid="admin-book-type-select"><SelectValue>{(v: string) => (v === "digital" ? "Ebook Digital" : "Buku Fisik")}</SelectValue></SelectTrigger>
                <SelectContent><SelectItem value="digital">Ebook Digital</SelectItem><SelectItem value="fisik">Buku Fisik</SelectItem></SelectContent>
              </Select>
            </div>
            {form.type === "fisik" && vRows.length === 0 && (
              <div className="sm:col-span-2">
                <Label>Stok buku fisik (kosongkan / -1 = tanpa batas)</Label>
                <Input data-testid="admin-book-stock-input" type="number" value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} className="mt-1.5" />
              </div>
            )}
            <div className="sm:col-span-2">
              <Label>Kategori Buku</Label>
              <div className="mt-2 flex flex-wrap gap-2">
                {[...(categories.data ?? [])].sort((a, b) => Number(a.parent_type === "category") - Number(b.parent_type === "category")).map((c) => {
                  const active = form.categories.includes(c.slug);
                  return (
                    <label key={c.id} className="flex items-center gap-2 rounded-full border border-[#E8DFC8] px-3 py-2 text-xs font-semibold text-[#635F59]">
                      <Checkbox checked={active} onCheckedChange={(checked) => setForm({ ...form, categories: checked === true ? [...form.categories, c.slug] : form.categories.filter((x) => x !== c.slug) })} />
                      {c.parent_type === "category" ? `└ ${c.name}` : c.name}
                    </label>
                  );
                })}
              </div>
            </div>
            <div className="sm:col-span-2">
              <Label>URL Sampul / Upload Gambar</Label>
              <div className="mt-1.5 flex items-center gap-2">
                <Input data-testid="admin-book-cover-input" value={form.cover_url} onChange={(e) => setForm({ ...form, cover_url: e.target.value })} placeholder="https://... atau data:image/..." className="flex-1" />
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-[#E8DFC8] bg-white px-3 py-2 text-xs font-semibold text-[#635F59] hover:border-[#DD6B20] hover:text-[#C05621]">
                  <ImageUp className="size-4 text-[#DD6B20]" /> Upload
                  <input type="file" accept="image/*" className="hidden" onChange={onCoverFile} data-testid="admin-book-cover-file" />
                </label>
              </div>
              {form.cover_url && <img src={form.cover_url} alt="Sampul buku" className="mt-2 max-h-20 rounded-lg border border-[#E8DFC8] object-cover" />}
            </div>
            <div><Label>Badge</Label><Input data-testid="admin-book-badge-input" value={form.badge} onChange={(e) => setForm({ ...form, badge: e.target.value })} placeholder="Best Seller" className="mt-1.5" /></div>
            <div className="flex items-end gap-2 pb-1">
              <Checkbox checked={form.featured} onCheckedChange={(c) => setForm({ ...form, featured: c === true })} data-testid="admin-book-featured-checkbox" />
              <Label>Unggulan di beranda</Label>
            </div>
            <div className="sm:col-span-2"><Label>Deskripsi</Label><Textarea data-testid="admin-book-description-input" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="mt-1.5" /></div>

            {/* Variant editor */}
            <div className="rounded-2xl border border-[#E8DFC8] bg-[#FAF7F2] p-4 sm:col-span-2" data-testid="variant-editor">
              <div className="flex items-center justify-between">
                <p className="flex items-center gap-2 text-sm font-semibold"><Layers className="size-4 text-[#DD6B20]" /> Variasi (opsional, ala Shopee)</p>
                <button
                  type="button"
                  onClick={() => setVGroups((g) => [...g, { name: "", options: "" }])}
                  data-testid="admin-add-variant-group"
                  className="inline-flex items-center gap-1 rounded-full border border-[#E8DFC8] bg-white px-3 py-1.5 text-xs font-semibold text-[#635F59] hover:border-[#DD6B20] hover:text-[#C05621]"
                >
                  <Plus className="size-3.5" /> Tambah Grup
                </button>
              </div>
              <p className="mt-1 text-xs text-[#635F59]">Contoh: nama grup "Level" dengan opsi "Level 1, Level 2, Level 3". Kosongkan semua grup jika buku tanpa variasi.</p>
              <div className="mt-3 space-y-2.5">
                {vGroups.map((g, gi) => (
                  <div key={gi} className="flex items-center gap-2">
                    <Input
                      value={g.name}
                      onChange={(e) => setVGroups((gs) => gs.map((x, i) => (i === gi ? { ...x, name: e.target.value } : x)))}
                      placeholder="Nama grup: Level / Ukuran / Jenis"
                      data-testid={`admin-variant-group-name-${gi}`}
                      className="w-40"
                    />
                    <Input
                      value={g.options}
                      onChange={(e) => setVGroups((gs) => gs.map((x, i) => (i === gi ? { ...x, options: e.target.value } : x)))}
                      placeholder="Opsi, pisahkan koma: Level 1, Level 2, Level 3"
                      data-testid={`admin-variant-group-options-${gi}`}
                      className="flex-1"
                    />
                    <button type="button" onClick={() => setVGroups((gs) => gs.filter((_, i) => i !== gi))} data-testid={`admin-variant-group-remove-${gi}`} className="rounded-full p-2 text-[#635F59] hover:text-red-600"><X className="size-4" /></button>
                  </div>
                ))}
              </div>
              {vGroups.length > 0 && (
                <button type="button" onClick={generateCombos} data-testid="admin-generate-variants" className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-[#1F1D1A] px-4 py-2 text-xs font-semibold text-white hover:bg-[#3a352f]">
                  <Layers className="size-3.5" /> Buat / Perbarui Kombinasi Harga & Stok
                </button>
              )}
              {vRows.length > 0 && (
                <div className="mt-3 max-h-64 space-y-1.5 overflow-y-auto rounded-xl border border-[#E8DFC8] bg-white p-3">
                  <div className="flex items-center gap-3 text-[10px] font-semibold uppercase tracking-wide text-[#635F59]">
                    <span className="flex-1">Kombinasi</span><span className="w-28">Harga (Rp)</span><span className="w-24">Stok (-1 = ∞)</span>
                  </div>
                  {vRows.map((r, ri) => (
                    <div key={r.id} className="flex items-center gap-3">
                      <span className="flex-1 text-xs font-medium">{r.label}</span>
                      <Input
                        type="number"
                        value={r.price}
                        onChange={(e) => setVRows((rs) => rs.map((x, i) => (i === ri ? { ...x, price: e.target.value } : x)))}
                        data-testid={`admin-variant-price-${r.label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}
                        className="w-28"
                        placeholder="Harga"
                      />
                      <Input
                        type="number"
                        value={r.stock}
                        onChange={(e) => setVRows((rs) => rs.map((x, i) => (i === ri ? { ...x, stock: e.target.value } : x)))}
                        data-testid={`admin-variant-stock-${r.label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}
                        className="w-24"
                        placeholder="-1"
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>

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

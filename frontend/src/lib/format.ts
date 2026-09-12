export const rupiah = (n: number) => "Rp " + n.toLocaleString("id-ID");

export const ORDER_STATUS: Record<string, { label: string; cls: string }> = {
  menunggu_pembayaran: { label: "Menunggu Pembayaran", cls: "bg-amber-100 text-amber-800 border-amber-200" },
  menunggu_verifikasi: { label: "Menunggu Verifikasi", cls: "bg-teal-100 text-teal-800 border-teal-200" },
  lunas: { label: "Lunas", cls: "bg-green-100 text-green-800 border-green-200" },
  diproses: { label: "Diproses", cls: "bg-sky-100 text-sky-800 border-sky-200" },
  dikirim: { label: "Dikirim", cls: "bg-indigo-100 text-indigo-800 border-indigo-200" },
  selesai: { label: "Selesai", cls: "bg-emerald-100 text-emerald-800 border-emerald-200" },
  dibatalkan: { label: "Dibatalkan", cls: "bg-red-100 text-red-800 border-red-200" },
};

export const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

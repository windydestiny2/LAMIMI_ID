import { Link } from "react-router-dom";
import { BookOpen, MessageCircle, Truck } from "lucide-react";
import { SiShopee } from "@icons-pack/react-simple-icons";
import { SHOPEE_URL, WA_DISPLAY, WA_NUMBER } from "@/lib/types";

export function Footer() {
  return (
    <footer className="bg-[#1F1D1A] text-[#FAF7F2]" data-testid="main-footer">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-16 sm:grid-cols-3 sm:px-6 lg:px-8">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="flex size-9 items-center justify-center rounded-xl bg-[#DD6B20] text-white">
              <BookOpen className="size-5" />
            </span>
            <span className="font-heading text-xl font-bold">LAMIMI_ID</span>
          </div>
          <p className="mt-4 max-w-xs text-sm leading-relaxed text-[#D6CFC7]">
            Toko ebook bahasa Mandarin, Korea, Jepang, dan Inggris — plus koleksi buku fisik pilihan yang dikirim ke seluruh Indonesia.
          </p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#FBD38D]">Jelajahi</p>
          <ul className="mt-4 space-y-2.5 text-sm text-[#D6CFC7]">
            <li><Link to="/etalase/digital" className="transition-colors hover:text-white">Etalase Ebook Digital</Link></li>
            <li><Link to="/etalase/fisik" className="transition-colors hover:text-white">Etalase Buku Fisik</Link></li>
            <li><Link to="/lacak" className="transition-colors hover:text-white">Lacak Pesanan</Link></li>
            <li><Link to="/admin/login" data-testid="footer-admin-link" className="transition-colors hover:text-white">Masuk Admin</Link></li>
            <li><a href={SHOPEE_URL} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 transition-colors hover:text-white"><SiShopee size={14} /> Toko Shopee Kami</a></li>
          </ul>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#FBD38D]">Kontak & Pengiriman</p>
          <ul className="mt-4 space-y-2.5 text-sm text-[#D6CFC7]">
            <li className="flex items-center gap-2"><MessageCircle className="size-4 text-[#FBD38D]" /> WhatsApp: {WA_DISPLAY}</li>
            <li className="flex items-center gap-2"><Truck className="size-4 text-[#FBD38D]" /> Buku fisik dikirim via JNE</li>
            <li className="text-xs leading-relaxed text-[#a39d94]">Ebook digital dikirim instan ke email / WhatsApp setelah pembayaran terkonfirmasi.</li>
          </ul>
        </div>
      </div>
      <div className="border-t border-white/10 py-5 text-center text-xs text-[#a39d94]">
        © 2026 LAMIMI_ID — Belajar bahasa dunia, dari rak digital kami.
      </div>
    </footer>
  );
}

# PRD — LAMIMI_ID

## Problem Statement (asli)
Website toko live gratis bernama LAMIMI_ID: (1) toko ebook digital Mandarin/Korea/Jepang/Inggris, (2) etalase buku fisik dengan alamat rumah + estimasi ongkir JNE + opsi beli via Shopee/Tokopedia/TikTok (https://s.shopee.co.id/8AV4Tsb6bM), (3) pembayaran ebook via payment gateway langsung ke rekening pemilik + pesanan terkirim ke WhatsApp 085173290889.

## User Personas
- Pembeli ebook: pelajar bahasa, ingin checkout cepat dan file instan.
- Pembeli buku fisik: ingin estimasi ongkir JNE atau checkout marketplace.
- Pemilik (admin): kelola katalog, lihat pesanan, atur ongkir.

## Keputusan User
- Payment: TANPA gateway — transfer manual ke rekening/e-wallet pemilik (BCA 1673204663, Seabank 901485568151, GoPay/OVO 085173290889, ShopeePay 085173413197 a.n. Windy Destiny Tarmidi; QRIS menyusul). Customer WAJIB upload bukti pembayaran sebelum bisa lanjut ke WhatsApp. (Midtrans dibatalkan user.)
- WhatsApp: link wa.me otomatis terisi detail pesanan ke 085173290889.
- Ongkir: flat per wilayah (Jawa 12rb, Sumatera 25rb, Bali/NT 28rb, Kalimantan 35rb, Sulawesi 38rb, Papua/Maluku 55rb).
- Katalog: panel admin dengan login (password baru: Windy_0803); user akan kirim daftar buku untuk diimport sekaligus.
- Desain: hangat (krem/amber/coral) + playful pastel per bahasa.

## Arsitektur
- FastAPI + MongoDB (motor) — backend/server.py: models Book/Order/ShippingRegion, JWT auth (cookie + Bearer), admin CRUD, stats, wa.me URL builder. Auto-seed saat startup (buku, wilayah, admin).
- React 19 + Vite + Tailwind v4 + motion/react + lenis; pages: Home, Catalog (digital/fisik), BookDetail, Checkout (3 langkah), TrackOrder, AdminLogin, AdminDashboard.
- Fonts: Lora (heading), Plus Jakarta Sans (body), JetBrains Mono (harga).

## Terimplementasi (12 Sep 2026)
- Storefront lengkap: hero kinetik masked-reveal + parallax, marquee editorial, bab bahasa 01-04, ebook unggulan, teaser buku fisik, manifesto, footer.
- Etalase digital (filter bahasa) & fisik (banner marketplace Shopee/Tokopedia/TikTok).
- Checkout: form → pembayaran manual (pilih rekening, tombol salin nomor) → upload bukti wajib → status menunggu_verifikasi → tombol WhatsApp.
- Keranjang multi-item (localStorage, ebook & fisik dipisah, drawer + badge di navbar, checkout /checkout/keranjang).
- Checkout fisik: alamat + wilayah → ongkir JNE flat → total.
- Lacak pesanan by nomor LM-XXXXXX.
- Admin: login (password Windy_0803), statistik, tabel pesanan + ubah status + chat customer + lihat bukti bayar, CRUD buku, editor ongkir, editor metode pembayaran + upload QRIS.
- Link "Masuk Admin" di footer situs.
- Terverifikasi: curl semua endpoint via URL publik (login password baru, tolak password lama, confirm-payment tolak tanpa bukti), typecheck bersih, e2e browser keranjang→checkout→upload bukti→sukses→admin.

## Backlog
- P0: User kirim foto barcode QRIS → upload via admin tab Pembayaran.
- P0: User kirim daftar buku (zip/teks) → import sekaligus ke katalog.
- P1: Link Tokopedia & TikTok Shop asli per buku (saat ini fallback chat WA).
- P1: Notifikasi WhatsApp otomatis (Fonnte/Watzap) tanpa perlu customer klik.
- P2: Kode promo, qty per item keranjang, RajaOngkir ongkir real-time.

import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { motion, useScroll, useTransform } from "motion/react";
import { ArrowRight, Languages, Package, Sparkles, Truck, Zap } from "lucide-react";
import { apiGet } from "@/lib/api";
import type { Book } from "@/lib/types";
import { LANGUAGE_META } from "@/lib/types";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { EditorialRibbon } from "@/components/EditorialRibbon";
import { BookCard } from "@/components/BookCard";
import { Reveal } from "@/components/Reveal";

const IMG = "https://static.prod-images.emergentagent.com/jobs/51f7e078-38c7-42d6-91d5-1c65bce9bd40/images";
const HERO_AMBIENT = "https://images.unsplash.com/photo-1758610605872-3195caed0bdd?crop=entropy&cs=srgb&fm=jpg&w=1200&q=80";
const PHYSICAL_IMG = "https://images.unsplash.com/photo-1688644707880-3d0df0fb2dc5?crop=entropy&cs=srgb&fm=jpg&w=900&q=80";
const MANIFESTO_IMG = "https://images.unsplash.com/photo-1699443817739-cf2f7cbcd18d?crop=entropy&cs=srgb&fm=jpg&w=900&q=80";

const HERO_LINES = ["Belajar bahasa dunia,", "mulai dari rak", "digital pertamamu."];

const CHAPTERS = [
  { num: "01", title: "Kurasi lintas bahasa", desc: "Mandarin, Korea, Jepang, dan Inggris — tiap ebook dipilih untuk pelajar Indonesia, dari nol sampai siap ujian." },
  { num: "02", title: "Harga ramah pelajar", desc: "Ebook mulai dari Rp 5 ribu. Sekali bayar, file jadi milikmu selamanya, bisa dibaca di mana saja." },
  { num: "03", title: "Terkirim instan & pasti", desc: "Ebook dikirim ke email/WhatsApp begitu pembayaran terkonfirmasi oleh Admin. Buku fisik meluncur via JNE." },
];

export default function Home() {
  const { scrollY } = useScroll();
  const yCover = useTransform(scrollY, [0, 600], [0, -50]);
  const yBg = useTransform(scrollY, [0, 600], [0, 40]);
  const { data: featured } = useQuery({
    queryKey: ["books", "featured"],
    queryFn: () => apiGet<Book[]>("/books?type=digital&featured=true"),
  });

  return (
    <div className="min-h-screen bg-[#FAF7F2]">
      <Navbar />

      {/* HERO */}
      <section className="relative overflow-hidden">
        <div className="mx-auto grid max-w-7xl grid-cols-1 items-center gap-10 px-4 pb-20 pt-16 sm:px-6 lg:grid-cols-12 lg:gap-12 lg:pt-24 lg:px-8">
          <div className="lg:col-span-7">
            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="inline-flex items-center gap-2 rounded-full border border-[#FBD38D] bg-[#FEEBC8] px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-[#9A3412]"
              data-testid="hero-overline"
            >
              <Sparkles className="size-3.5" /> Toko Ebook · LAMIMI_ID
            </motion.p>
            <h1 className="mt-6 font-heading text-4xl font-bold leading-[1.12] tracking-tight text-[#1F1D1A] sm:text-5xl lg:text-[56px]" data-testid="hero-heading">
              {HERO_LINES.map((line, i) => (
                <span key={line} className="block overflow-hidden pb-1">
                  <motion.span
                    className="block"
                    initial={{ y: "110%" }}
                    animate={{ y: 0 }}
                    transition={{ duration: 0.75, delay: 0.15 + i * 0.13, ease: [0.16, 1, 0.3, 1] }}
                  >
                    {i === 2 ? <span className="italic text-[#C05621]">{line}</span> : line}
                  </motion.span>
                </span>
              ))}
            </h1>
            <motion.p
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, delay: 0.65 }}
              className="mt-5 max-w-lg text-base leading-relaxed text-[#635F59]"
            >
              Ebook Mandarin, Korea, Jepang, dan Inggris yang terkirim instan setelah pembayaran — plus etalase buku fisik yang dikirim ke rumahmu via JNE.
            </motion.p>
            <motion.div
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, delay: 0.8 }}
              className="mt-8 flex flex-wrap items-center gap-3"
            >
              <Link
                to="/etalase/digital"
                data-testid="hero-cta-digital"
                className="inline-flex items-center gap-2 rounded-full bg-[#DD6B20] px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-[#DD6B20]/25 transition-all hover:-translate-y-0.5 hover:bg-[#C05621]"
              >
                <Zap className="size-4" /> Jelajahi Ebook Digital
              </Link>
              <Link
                to="/etalase/fisik"
                data-testid="hero-cta-fisik"
                className="inline-flex items-center gap-2 rounded-full border border-[#1F1D1A]/15 bg-white px-6 py-3 text-sm font-semibold text-[#1F1D1A] transition-all hover:-translate-y-0.5 hover:border-[#DD6B20] hover:text-[#C05621]"
              >
                <Package className="size-4" /> Lihat Buku Fisik
              </Link>
            </motion.div>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6, delay: 1 }}
              className="mt-10 flex flex-wrap gap-x-8 gap-y-3 text-sm text-[#635F59]"
            >
              <span className="flex items-center gap-2"><Languages className="size-4 text-[#DD6B20]" />Buku Bahasa Terlengkap</span>
              <span className="flex items-center gap-2"><Zap className="size-4 text-[#DD6B20]" /> Ebook Instant</span>
              <span className="flex items-center gap-2"><Truck className="size-4 text-[#DD6B20]" /> Ongkir JNE seluruh Indonesia</span>
            </motion.div>
          </div>

          <div className="relative lg:col-span-5">
            <motion.div
              initial={{ opacity: 0, scale: 0.94 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.8, delay: 0.4, ease: [0.16, 1, 0.3, 1] }}
              className="relative mx-auto max-w-sm"
            >
              <motion.div style={{ y: yBg }} className="absolute -inset-6 overflow-hidden rounded-[2rem]">
                <img src={HERO_AMBIENT} alt="" className="h-full w-full object-cover opacity-90" />
                <div className="absolute inset-0 bg-gradient-to-tr from-[#261D15]/80 to-[#432715]/60" />
              </motion.div>
              <motion.img
                style={{ y: yCover }}
                src={`${IMG}/c0461f8e0ee6c8ec0ce6e7906e26fdc9682de9545f111029e9673c0881cd2770.jpeg`}
                alt="Ebook Korea Pemula"
                className="animate-float-slow w-56 rotate-[-4deg] rounded-2xl border-4 border-white shadow-2xl sm:w-64"
                data-testid="hero-cover-main"
              />
              <motion.img
                style={{ y: yBg }}
                src={`${IMG}/ac1ef3c766e43024e4b70d77ec810b7bc8734f692a9aeb7e3c133a2a5b577e09.jpeg`}
                alt="Ebook Mandarin Dasar"
                className="absolute -bottom-10 -right-4 w-36 rotate-[6deg] rounded-xl border-4 border-white shadow-xl sm:w-44"
                data-testid="hero-cover-secondary"
              />
              <div className="absolute -left-6 top-8 rounded-2xl border border-[#E8DFC8] bg-white/90 px-4 py-2.5 shadow-lg backdrop-blur">
                <p className="font-mono text-sm font-bold text-[#9C4221]">Rp 45rb+</p>
                <p className="text-[11px] text-[#635F59]">mulai per ebook</p>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      <EditorialRibbon />

      {/* LANGUAGE CHAPTERS */}
      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <Reveal>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#DD6B20]">Etalase Digital</p>
          <h2 className="mt-3 max-w-xl font-heading text-2xl font-semibold tracking-tight sm:text-3xl lg:text-4xl">
            Empat bahasa, empat pintu menuju dunia baru.
          </h2>
        </Reveal>
        <div className="mt-10 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {Object.entries(LANGUAGE_META).map(([key, meta], i) => (
            <Reveal key={key} delay={i * 0.08}>
              <Link
                to={`/etalase/digital?bahasa=${key}`}
                data-testid={`chapter-${key}`}
                className={`group block rounded-3xl border p-6 transition-transform hover:-translate-y-1.5 ${meta.card}`}
              >
                <span className={`font-mono text-xs font-bold ${meta.text}`}>0{i + 1}</span>
                <h3 className="mt-3 font-heading text-xl font-semibold">{meta.label}</h3>
                <p className="mt-1 text-sm opacity-75">{meta.sub}</p>
                <span className={`mt-5 inline-flex items-center gap-1.5 text-sm font-semibold ${meta.text}`}>
                  Lihat koleksi <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
                </span>
              </Link>
            </Reveal>
          ))}
        </div>
      </section>

      {/* FEATURED */}
      <section className="border-y border-[#E8DFC8] bg-white py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <Reveal className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#DD6B20]">Paling Dicari</p>
              <h2 className="mt-3 font-heading text-2xl font-semibold tracking-tight sm:text-3xl lg:text-4xl">Ebook unggulan minggu ini</h2>
            </div>
            <Link to="/etalase/digital" data-testid="featured-see-all" className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#C05621] hover:underline">
              Semua ebook <ArrowRight className="size-4" />
            </Link>
          </Reveal>
          <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {(featured ?? []).slice(0, 4).map((b, i) => (
              <Reveal key={b.id} delay={i * 0.07}>
                <BookCard book={b} />
              </Reveal>
            ))}
            {featured !== undefined && featured.length === 0 && (
              <p className="col-span-full text-sm text-[#635F59]">Koleksi unggulan segera hadir.</p>
            )}
          </div>
        </div>
      </section>

      {/* PHYSICAL TEASER */}
      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <div className="grid items-center gap-10 lg:grid-cols-12">
          <Reveal className="lg:col-span-5">
            <div className="overflow-hidden rounded-[2rem] border border-[#E8DFC8] shadow-xl">
              <img src={PHYSICAL_IMG} alt="Tumpukan buku fisik berwarna-warni" className="aspect-[4/3] w-full object-cover" />
            </div>
          </Reveal>
          <div className="lg:col-span-7">
            <Reveal>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#DD6B20]">Etalase Buku Fisik</p>
              <h2 className="mt-3 max-w-lg font-heading text-2xl font-semibold tracking-tight sm:text-3xl lg:text-4xl">
                Lebih suka memegang buku sungguhan? Kami kirim via JNE.
              </h2>
              <p className="mt-4 max-w-lg text-base leading-relaxed text-[#635F59]">
                Pilih buku cetak favoritmu, isi alamat rumah, dan dapatkan perkiraan ongkir JNE sesuai wilayahmu. Mau checkout lewat marketplace? Tersedia juga opsi Shopee, Tokopedia, dan TikTok Shop.
              </p>
              <Link
                to="/etalase/fisik"
                data-testid="physical-teaser-cta"
                className="mt-7 inline-flex items-center gap-2 rounded-full bg-[#1F1D1A] px-6 py-3 text-sm font-semibold text-white transition-all hover:-translate-y-0.5 hover:bg-[#3a352f]"
              >
                <Truck className="size-4" /> Buka Etalase Fisik
              </Link>
            </Reveal>
          </div>
        </div>
      </section>

      {/* MANIFESTO */}
      <section className="border-y border-[#E8DFC8] bg-[#F5EDE0] py-20">
        <div className="mx-auto grid max-w-7xl items-start gap-12 px-4 sm:px-6 lg:grid-cols-12 lg:px-8">
          <div className="lg:col-span-5">
            <Reveal>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#DD6B20]">Manifesto Kami</p>
              <h2 className="mt-3 font-heading text-2xl font-semibold tracking-tight sm:text-3xl lg:text-4xl">
                "When There is a Will, There is a Way".
              </h2>
              <div className="mt-8 overflow-hidden rounded-[2rem] border border-[#E8DFC8]">
                <img src={MANIFESTO_IMG} alt="Rak buku di sudut perpustakaan yang hangat" className="aspect-[4/3] w-full object-cover" />
              </div>
            </Reveal>
          </div>
          <div className="space-y-8 lg:col-span-7 lg:pt-14">
            {CHAPTERS.map((c, i) => (
              <Reveal key={c.num} delay={i * 0.1}>
                <div className="flex gap-6 border-b border-[#E8DFC8] pb-8 last:border-0">
                  <span className="font-mono text-sm font-bold text-[#C05621]">{c.num}</span>
                  <div>
                    <h3 className="font-heading text-xl font-semibold">{c.title}</h3>
                    <p className="mt-2 max-w-md text-sm leading-relaxed text-[#635F59]">{c.desc}</p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}

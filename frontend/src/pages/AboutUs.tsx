import { Link } from "react-router-dom";
import { ArrowRight, BookOpen, MessageCircle, Quote, Star, Truck } from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";

const REVIEW_PHOTOS = [
  {
    name: "Sari",
    title: "Pelajar Korea",
    image: "https://images.unsplash.com/photo-1527980965255-d3b416303d12?auto=format&fit=crop&w=900&q=80",
    quote: "Materi bukunya rapi dan langsung bisa dipakai belajar sambil jalan.",
  },
  {
    name: "Raka",
    title: "Course taker",
    image: "https://images.unsplash.com/photo-1508214751196-bc0cdd6dad92?auto=format&fit=crop&w=900&q=80",
    quote: "Ebook sampai cepat, pilihan bahasanya lengkap, dan pengiriman fisik cepat.",
  },
  {
    name: "Nadya",
    title: "Pembaca Mandarain",
    image: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=900&q=80",
    quote: "Tema untuk belajar mandarin terasa ringan dan saya bukan hanya baca, tapi yakin ikut kursus.",
  },
  {
    name: "Ayu",
    title: "Pemula Bahasa Jepang",
    image: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=900&q=80",
    quote: "Saya suka karena semua buku di etalase tersedia dengan petunjuk yang rapi.",
  },
];

export default function AboutUs() {
  return (
    <div className="min-h-screen bg-[#FAF7F2] text-[#1F1D1A]">
      <Navbar />

      <section className="relative overflow-hidden">
        <div className="absolute left-0 top-20 h-52 w-52 rounded-full bg-[#FBD38D]/40 blur-3xl" />
        <div className="absolute right-0 top-60 h-72 w-72 rounded-full bg-[#DD6B20]/10 blur-3xl" />

        <div className="mx-auto grid max-w-7xl items-center gap-12 px-4 py-16 sm:px-6 lg:grid-cols-12 lg:px-8">
          <div className="lg:col-span-6">
            <span className="inline-flex items-center rounded-full border border-[#E8DFC8] bg-[#FFF8EE] px-4 py-2 text-[11px] font-bold uppercase tracking-[0.2em] text-[#9C4221]">
              <BookOpen className="mr-2 size-4" /> LAMIMI_ID
            </span>
            <h1 className="mt-6 font-heading text-4xl font-bold leading-tight tracking-tight text-[#1F1D1A] sm:text-5xl lg:text-6xl">
              Belajar bahasa mulai dari rak yang terasa dekat.
            </h1>
            <p className="mt-6 max-w-2xl text-base leading-relaxed text-[#635F59]">
              LAMIMI_ID adalah ruang belajar bahasa yang menggabungkan bahan bacaan yang rapi,
              buku yang bermanfaat, dan proses checkout yang terasa ringan untuk setiap pelajar.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/etalase/digital" className="inline-flex items-center gap-2 rounded-full bg-[#DD6B20] px-6 py-3 text-sm font-semibold text-white hover:bg-[#C05621]">
                Jelajahi Ebook <ArrowRight className="size-4" />
              </Link>
              <a href="https://wa.me/6285173290889" target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-full border border-[#1F1D1A]/15 bg-white px-6 py-3 text-sm font-semibold text-[#1F1D1A] hover:border-[#DD6B20] hover:text-[#C05621]">
                <MessageCircle className="size-4" /> Chat Admin
              </a>
            </div>

            <div className="mt-10 flex flex-wrap gap-8">
              <div>
                <p className="font-mono text-3xl font-bold text-[#9C4221]">100+</p>
                <p className="mt-1 text-xs font-semibold uppercase tracking-[0.14em] text-[#635F59]">Ebook</p>
              </div>
              <div>
                <p className="font-mono text-3xl font-bold text-[#9C4221]">04</p>
                <p className="mt-1 text-xs font-semibold uppercase tracking-[0.14em] text-[#635F59]">Bahasa</p>
              </div>
              <div>
                <p className="font-mono text-3xl font-bold text-[#9C4221]">24/7</p>
                <p className="mt-1 text-xs font-semibold uppercase tracking-[0.14em] text-[#635F59]">Support</p>
              </div>
            </div>
          </div>

          <div className="lg:col-span-6">
            <div className="relative">
              <div className="absolute -inset-5 rounded-[3rem] border border-[#E8DFC8] bg-[#F5EDE0]" />
              <div className="relative overflow-hidden rounded-[2rem] border border-white/70 bg-white p-3 shadow-2xl">
                <img
                  src="https://images.unsplash.com/photo-1524995997946-a1c2e315a42f?auto=format&fit=crop&w=1200&q=80"
                  alt="LAMIMI_ID"
                  className="aspect-[4/5] w-full rounded-[1.5rem] object-cover"
                />
              </div>
              <div className="absolute -left-3 top-8 rounded-2xl border border-[#E8DFC8] bg-white px-4 py-3 shadow-lg">
                <div className="flex items-center gap-2">
                  <Star className="size-4 fill-[#DD6B20] text-[#DD6B20]" />
                  <span className="font-heading text-xl font-bold text-[#9C4221]">5.0</span>
                </div>
                <p className="text-[11px] font-semibold text-[#635F59]">Rated by learners</p>
              </div>
              <div className="absolute -right-4 bottom-8 rounded-2xl border border-[#E8DFC8] bg-[#1F1D1A] px-4 py-3 text-white shadow-xl">
                <div className="flex items-center gap-2">
                  <Truck className="size-4 text-[#FBD38D]" />
                  <span className="text-xs font-semibold">Kirim cepat</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-y border-[#E8DFC8] bg-white py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-10 lg:grid-cols-3">
            <div className="rounded-[2rem] border border-[#E8DFC8] bg-[#FDF8EE] p-8">
              <span className="mb-6 inline-flex h-11 w-11 items-center justify-center rounded-full bg-[#DD6B20] text-white">
                <BookOpen className="size-5" />
              </span>
              <h3 className="font-heading text-2xl font-semibold text-[#1F1D1A]">Bahan yang terasa rapi</h3>
              <p className="mt-4 text-sm leading-relaxed text-[#635F59]">
                Setiap judul dipilih untuk membuat belajar bahasa terasa fokus dan memiliki arah.
              </p>
            </div>

            <div className="rounded-[2rem] border border-[#E8DFC8] bg-[#FDF8EE] p-8">
              <span className="mb-6 inline-flex h-11 w-11 items-center justify-center rounded-full bg-[#DD6B20] text-white">
                <Truck className="size-5" />
              </span>
              <h3 className="font-heading text-2xl font-semibold text-[#1F1D1A]">Kirim instan & aman</h3>
              <p className="mt-4 text-sm leading-relaxed text-[#635F59]">
                Ebook dikirim setelah pembayaran terverifikasi, dan buku fisik siap dikirim lewat JNE.
              </p>
            </div>

            <div className="rounded-[2rem] border border-[#E8DFC8] bg-[#FDF8EE] p-8">
              <span className="mb-6 inline-flex h-11 w-11 items-center justify-center rounded-full bg-[#DD6B20] text-white">
                <MessageCircle className="size-5" />
              </span>
              <h3 className="font-heading text-2xl font-semibold text-[#1F1D1A]">Komunitas yang hangat</h3>
              <p className="mt-4 text-sm leading-relaxed text-[#635F59]">
                Komunikasi lewat WhatsApp membuat semua perjalanan belajar terasa lebih dekat.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#DD6B20]">Review Learners</p>
              <h2 className="mt-3 font-heading text-3xl font-semibold tracking-tight sm:text-4xl">
                Komunitas LAMIMI_ID
              </h2>
            </div>
            <div className="flex items-center gap-1 rounded-full border border-[#E8DFC8] bg-white px-4 py-2">
              {Array.from({ length: 5 }).map((_, i) => <Star key={i} className="size-4 fill-[#DD6B20] text-[#DD6B20]" />)}
              <span className="ml-2 text-sm font-semibold text-[#635F59]">5.0</span>
            </div>
          </div>

          <div className="relative mt-8 flex overflow-hidden">
            <div className="animate-marquee flex min-w-max gap-5">
              {[...REVIEW_PHOTOS, ...REVIEW_PHOTOS].map((review, i) => (
                <article key={`${review.name}-${i}`} className="w-72 shrink-0 rounded-[2rem] border border-[#E8DFC8] bg-white p-4 shadow-sm">
                  <div className="overflow-hidden rounded-[1.5rem]">
                    <img src={review.image} alt={review.name} className="aspect-[4/3] w-full object-cover" />
                  </div>
                  <div className="mt-4">
                    <div className="flex items-center gap-1">
                      {Array.from({ length: 5 }).map((_, idx) => <Star key={idx} className="size-4 fill-[#DD6B20] text-[#DD6B20]" />)}
                    </div>
                    <div className="mt-3 flex items-start gap-2">
                      <Quote className="mt-1 size-4 text-[#DD6B20]" />
                      <p className="text-sm leading-relaxed text-[#635F59]">“{review.quote}”</p>
                    </div>
                    <div className="mt-4 border-t border-[#E8DFC8] pt-3">
                      <p className="font-heading text-base font-bold text-[#1F1D1A]">{review.name}</p>
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-[#635F59]">{review.title}</p>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}

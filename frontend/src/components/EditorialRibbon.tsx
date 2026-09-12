import { Sparkles } from "lucide-react";

const ITEMS = [
  "MANDARIN 中文",
  "KOREA 한국어",
  "JEPANG 日本語",
  "INGGRIS · ENGLISH",
  "EBOOK TERKIRIM INSTAN",
  "BUKU FISIK VIA JNE",
  "PEMBAYARAN QRIS & VA",
];

export function EditorialRibbon() {
  const doubled = [...ITEMS, ...ITEMS];
  return (
    <div className="overflow-hidden border-y border-[#E8DFC8] bg-[#F5EDE0] py-3.5" data-testid="editorial-ribbon">
      <div className="animate-marquee flex w-max items-center gap-8 whitespace-nowrap">
        {doubled.map((item, i) => (
          <span key={i} className="flex items-center gap-8 font-heading text-sm font-semibold tracking-[0.22em] text-[#9C4221]">
            {item}
            <Sparkles className="size-3.5 text-[#DD6B20]" />
          </span>
        ))}
      </div>
    </div>
  );
}

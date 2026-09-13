export interface VariantGroup {
  name: string;
  options: string[];
}

export interface Variant {
  id: string;
  label: string;
  selections: Record<string, string>;
  price: number;
  stock: number; // -1 = unlimited
}

export interface Book {
  id: string;
  title: string;
  author: string;
  language: string;
  type: string; // digital | fisik
  price: number;
  description: string;
  cover_url: string;
  badge: string;
  featured: boolean;
  shopee_url: string;
  tokopedia_url: string;
  tiktok_url: string;
  categories: string[];
  variant_groups: VariantGroup[];
  variants: Variant[];
  stock: number; // -1 = unlimited (ebook default)
  created_at: string;
}

export interface LanguageEntry {
  id: string;
  name: string;
  slug: string;
  label: string;
  description: string;
  active: boolean;
  created_at: string;
}

export interface BookCategory {
  id: string;
  name: string;
  slug: string;
  description: string;
  parent: string; // slug bahasa / slug kategori induk; "" = global
  parent_type: string; // "" | "language" | "category"
  active: boolean;
  created_at: string;
}

export interface OrderItem {
  book_id: string;
  title: string;
  price: number;
  qty: number;
  variant_id: string;
  variant_label: string;
}

export interface Order {
  id: string;
  order_number: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  items: OrderItem[];
  order_type: string;
  address: string;
  city: string;
  province: string;
  postal_code: string;
  region: string;
  notes: string;
  shipping_cost: number;
  subtotal: number;
  discount_amount: number;
  total: number;
  voucher_code: string;
  status: string;
  payment_method: string;
  payment_proof: string;
  payment_received_amount: number;
  payment_status: string;
  payment_shortage: number;
  created_at: string;
}

export interface OrderResponse {
  order: Order;
  whatsapp_url: string;
}

export interface ShippingRegion {
  id: string;
  name: string;
  cost: number;
  eta: string;
}

export interface PaymentMethod {
  id: string;
  name: string;
  account_name: string;
  account_number: string;
  qr_image: string;
  active: boolean;
}

export interface Voucher {
  id: string;
  code: string;
  description: string;
  discount_type: string;
  discount_value: number;
  active: boolean;
  valid_from: string;
  valid_until: string;
  created_at: string;
}

export interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: string;
}

export interface AdminStats {
  total_orders: number;
  paid_orders: number;
  pending_orders: number;
  revenue: number;
  total_books: number;
}

export const SHOPEE_URL = "https://s.shopee.co.id/8AV4Tsb6bM";
export const WA_NUMBER = "6285173290889";
export const WA_DISPLAY = "0851-7329-0889";

export const LANGUAGE_META: Record<
  string,
  { label: string; sub: string; chip: string; card: string; text: string }
> = {
  mandarin: {
    label: "Mandarin",
    sub: "中文 · HSK 1-6 & Percakapan",
    chip: "bg-[#FEEBC8] text-[#9A3412] border-[#FBD38D]",
    card: "bg-[#FEEBC8] border-[#FBD38D]",
    text: "text-[#9A3412]",
  },
  korea: {
    label: "Korea",
    sub: "한국어 · TOPIK & Hangul",
    chip: "bg-[#EDE9FE] text-[#581C87] border-[#DDD6FE]",
    card: "bg-[#EDE9FE] border-[#DDD6FE]",
    text: "text-[#581C87]",
  },
  jepang: {
    label: "Jepang",
    sub: "日本語 · JLPT N5-N1 & Kanji",
    chip: "bg-[#E0F2FE] text-[#0369A1] border-[#BAE6FD]",
    card: "bg-[#E0F2FE] border-[#BAE6FD]",
    text: "text-[#0369A1]",
  },
  inggris: {
    label: "Inggris",
    sub: "English · Grammar, IELTS & TOEFL",
    chip: "bg-[#DCFCE7] text-[#166534] border-[#BBF7D0]",
    card: "bg-[#DCFCE7] border-[#BBF7D0]",
    text: "text-[#166534]",
  },
};

export interface CartItem {
  key: string; // book_id + variant_id
  id: string; // book id
  variant_id: string;
  variant_label: string;
  type: string;
  title: string;
  price: number;
  cover_url: string;
}

const KEY = "lamimi_cart_v2";
const EVENT = "lamimi-cart";

export function getCart(): CartItem[] {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

function save(items: CartItem[]) {
  localStorage.setItem(KEY, JSON.stringify(items));
  window.dispatchEvent(new Event(EVENT));
}

export function addToCart(item: CartItem): { ok: boolean; reason?: "dupe" | "tipe" } {
  const items = getCart();
  if (items.some((i) => i.key === item.key)) return { ok: false, reason: "dupe" };
  if (items.length > 0 && items[0].type !== item.type) return { ok: false, reason: "tipe" };
  save([...items, item]);
  return { ok: true };
}

export function removeFromCart(key: string) {
  save(getCart().filter((i) => i.key !== key));
}

export function clearCart() {
  save([]);
}

export function onCartChange(handler: () => void) {
  window.addEventListener(EVENT, handler);
  return () => window.removeEventListener(EVENT, handler);
}

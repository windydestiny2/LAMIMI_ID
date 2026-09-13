export interface CartItem {
  key: string; // book_id + variant_id
  id: string; // book id
  variant_id: string;
  variant_label: string;
  type: string;
  title: string;
  price: number;
  cover_url: string;
  qty: number;
  stock?: number;
}

const KEY = "lamimi_cart_v2";
const EVENT = "lamimi-cart";

export function getCart(): CartItem[] {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(raw) ? raw.map((i) => ({ ...i, qty: i.qty ?? 1 })) : [];
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
  const existing = items.find((i) => i.key === item.key);
  if (existing) {
    existing.qty += item.qty ?? 1;
    save(items);
    return { ok: true };
  }

  save([...items, { ...item, qty: item.qty ?? 1 }]);
  return { ok: true };
}

export function updateCartQty(key: string, qty: number) {
  const items = getCart();
  const target = items.find((i) => i.key === key);
  if (!target) return;
  target.qty = Math.max(1, qty);
  save(items);
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

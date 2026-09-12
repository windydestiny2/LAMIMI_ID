import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ShoppingBag, X } from "lucide-react";
import { Sheet, SheetClose, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { getCart, onCartChange, removeFromCart, type CartItem } from "@/lib/cart";
import { rupiah } from "@/lib/format";

export function CartDrawer() {
  const [items, setItems] = useState<CartItem[]>([]);

  useEffect(() => {
    setItems(getCart());
    return onCartChange(() => setItems(getCart()));
  }, []);

  const total = items.reduce((s, i) => s + i.price, 0);

  return (
    <Sheet>
      <SheetTrigger render={<Button variant="outline" size="icon" className="relative rounded-full border-[#E8DFC8]" data-testid="cart-button" />}>
        <ShoppingBag className="size-4.5" />
        {items.length > 0 && (
          <span className="absolute -right-1.5 -top-1.5 flex size-5 items-center justify-center rounded-full bg-[#DD6B20] text-[10px] font-bold text-white" data-testid="cart-count">
            {items.length}
          </span>
        )}
      </SheetTrigger>
      <SheetContent side="right" className="flex w-full flex-col bg-[#FAF7F2] sm:max-w-md" data-testid="cart-drawer">
        <SheetTitle className="font-heading text-lg font-bold">Keranjang ({items.length})</SheetTitle>
        {items.length === 0 ? (
          <div className="flex flex-1 flex-col items-start justify-center gap-3">
            <ShoppingBag className="size-10 text-[#DD6B20]" />
            <p className="text-sm text-[#635F59]">Keranjangmu masih kosong. Yuk pilih buku favoritmu!</p>
          </div>
        ) : (
          <>
            <div className="mt-4 flex-1 space-y-3 overflow-y-auto">
              {items.map((i) => (
                <div key={i.key} className="flex items-center gap-3 rounded-2xl border border-[#E8DFC8] bg-white p-3" data-testid={`cart-item-${i.key}`}>
                  <img src={i.cover_url} alt="" className="h-16 w-12 rounded-lg border border-[#E8DFC8] object-cover" />
                  <div className="flex-1">
                    <p className="text-sm font-semibold leading-snug">{i.title}</p>
                    {i.variant_label && <p className="mt-0.5 text-[11px] text-[#635F59]">{i.variant_label}</p>}
                    <p className="mt-0.5 font-mono text-sm font-bold text-[#9C4221]">{rupiah(i.price)}</p>
                  </div>
                  <button onClick={() => removeFromCart(i.key)} data-testid={`cart-remove-${i.key}`} className="rounded-full p-2 text-[#635F59] transition-colors hover:bg-red-50 hover:text-red-600" aria-label="Hapus">
                    <X className="size-4" />
                  </button>
                </div>
              ))}
            </div>
            <div className="border-t border-[#E8DFC8] pt-4">
              <div className="flex justify-between text-sm">
                <span className="text-[#635F59]">Subtotal {items[0].type === "fisik" ? "(ongkir dihitung saat checkout)" : ""}</span>
                <span className="font-mono font-bold text-[#9C4221]" data-testid="cart-total">{rupiah(total)}</span>
              </div>
              <SheetClose render={<Link to="/checkout/keranjang" data-testid="cart-checkout-button" className="mt-4 flex items-center justify-center gap-2 rounded-full bg-[#DD6B20] px-6 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-[#C05621]" />}>
                Checkout {items.length} Item
              </SheetClose>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

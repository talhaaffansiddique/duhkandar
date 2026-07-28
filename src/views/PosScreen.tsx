import { useMemo, useState } from "react";
import { doc, increment, updateDoc } from "firebase/firestore";
import { db } from "../firebase/config";
import { useAuth } from "../context/AuthContext";
import { useShopCollection, useShopAuditedWrites, useShopPath, useShopDoc, generateReceiptNumber } from "../lib/firestore";
import type { Product, SaleLineItem, PaymentMethod } from "../types";

interface CartLine {
  productId: string;
  productName: string;
  qty: number;
  unitPrice: number;
  warranty: string;
}

function money(n: number) {
  return "Rs " + Math.round(n).toLocaleString();
}
function warrantyLabel(p: Product): string {
  if (!p.warrantyValue) return "—";
  const unit = p.warrantyUnit === "Years" ? (p.warrantyValue === 1 ? "yr" : "yrs") : "mo";
  return `${p.warrantyValue} ${unit}`;
}
function peekNextReceiptNo(dateKey?: string, seq?: number): string {
  const now = new Date();
  const y = String(now.getFullYear()).slice(-2);
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const todayKey = `${y}-${m}-${d}`;
  const next = dateKey === todayKey ? (seq ?? 0) + 1 : 1;
  return `${todayKey}--${String(next).padStart(3, "0")}`;
}

export default function PosScreen() {
  const { profile } = useAuth();
  const { shop } = useShopDoc();
  const { data: products } = useShopCollection<Product>("products");
  const { create: createSale } = useShopAuditedWrites("sales");
  const productsPath = useShopPath("products");

  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [customer, setCustomer] = useState("");
  const [payment, setPayment] = useState<PaymentMethod>("Cash");
  const [showPreview, setShowPreview] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return products;
    return products.filter((p) => p.name.toLowerCase().includes(term) || p.sku.toLowerCase().includes(term));
  }, [products, search]);

  const subtotal = cart.reduce((s, l) => s + l.qty * l.unitPrice, 0);

  function addToCart(p: Product) {
    setCart((prev) => {
      const existing = prev.find((l) => l.productId === p.id);
      if (existing) {
        return prev.map((l) => (l.productId === p.id ? { ...l, qty: l.qty + 1 } : l));
      }
      return [...prev, { productId: p.id, productName: p.name, qty: 1, unitPrice: p.price, warranty: warrantyLabel(p) }];
    });
  }
  function updateLine(idx: number, patch: Partial<CartLine>) {
    setCart((prev) => prev.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
  }
  function removeLine(idx: number) {
    setCart((prev) => prev.filter((_, i) => i !== idx));
  }

  function openCheckout() {
    if (cart.length === 0) {
      setErr("Add at least one product to the cart first.");
      return;
    }
    setErr(null);
    setShowPreview(true);
  }

  async function completeSale() {
    if (!productsPath) return;
    setCompleting(true);
    setErr(null);
    try {
      const receiptNo = await generateReceiptNumber(shop!.id);
      const items: SaleLineItem[] = cart.map((l) => ({
        productId: l.productId,
        productName: l.productName,
        qty: l.qty,
        unitPrice: l.unitPrice,
        warranty: l.warranty,
      }));
      await createSale({
        receiptNo,
        customer: customer.trim() || "Walk-in Customer",
        items,
        amount: subtotal,
        payment,
        status: "Paid",
        cashierName: profile?.name || "Unknown",
      });
      await Promise.all(
        cart.map((l) => updateDoc(doc(db, productsPath, l.productId), { stock: increment(-l.qty) }))
      );
      setCart([]);
      setCustomer("");
      setPayment("Cash");
      setShowPreview(false);
    } catch (e) {
      console.error(e);
      setErr("Could not complete the sale. Try again.");
    } finally {
      setCompleting(false);
    }
  }

  const nextReceiptNo = peekNextReceiptNo(shop?.lastReceiptDateKey, shop?.lastReceiptSeq);
  const customerName = customer.trim() || "Walk-in Customer";

  return (
    <div>
      <div className="poswrap">
        <div>
          <input
            className="input"
            style={{ width: "100%", marginBottom: 12 }}
            placeholder="Search products or SKU"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className="poscat">
            {filtered.length === 0 ? (
              <p style={{ fontSize: 12, color: "var(--muted)" }}>No products match.</p>
            ) : (
              filtered.map((p) => (
                <button key={p.id} className="posproduct" onClick={() => addToCart(p)}>
                  <div className="pname">{p.name}</div>
                  <div className="pmeta">{p.sku}</div>
                  <div className="pprice">{money(p.price)}</div>
                </button>
              ))
            )}
          </div>
        </div>

        <div className="card">
          <p className="sectitle">Cart</p>
          {cart.length === 0 ? (
            <p style={{ fontSize: 12, color: "var(--muted)" }}>Click a product to add it to the cart.</p>
          ) : (
            <>
              <div className="cartrow cartheader">
                <span>Product</span>
                <span>Qty</span>
                <span>Price</span>
                <span>Warranty</span>
                <span>Total</span>
                <span />
              </div>
              {cart.map((l, idx) => (
                <div className="cartrow" key={l.productId}>
                  <span>{l.productName}</span>
                  <input
                    type="number"
                    min={1}
                    value={l.qty}
                    onChange={(e) => updateLine(idx, { qty: Math.max(1, Number(e.target.value)) })}
                  />
                  <input
                    type="number"
                    value={l.unitPrice}
                    onChange={(e) => updateLine(idx, { unitPrice: Math.max(0, Number(e.target.value)) })}
                  />
                  <input value={l.warranty} onChange={(e) => updateLine(idx, { warranty: e.target.value })} />
                  <span className="num">{(l.qty * l.unitPrice).toLocaleString()}</span>
                  <button className="btn" style={{ padding: "3px 7px", fontSize: 11 }} onClick={() => removeLine(idx)}>
                    ×
                  </button>
                </div>
              ))}
            </>
          )}

          <div className="field" style={{ marginTop: 12 }}>
            <label>Customer name (optional)</label>
            <input value={customer} onChange={(e) => setCustomer(e.target.value)} placeholder="Walk-in Customer" />
          </div>

          <label style={{ fontSize: 12, color: "var(--muted)", display: "block", marginBottom: 4 }}>
            Payment method
          </label>
          <div className="paymethods">
            <button className={"paymethod" + (payment === "Cash" ? " on" : "")} onClick={() => setPayment("Cash")}>
              Cash
            </button>
            {(shop?.acceptOnlinePayments ?? true) && (
              <button className={"paymethod" + (payment === "Online" ? " on" : "")} onClick={() => setPayment("Online")}>
                Online
              </button>
            )}
            {(shop?.acceptCardPayments ?? true) && (
              <button className={"paymethod" + (payment === "Card" ? " on" : "")} onClick={() => setPayment("Card")}>
                Card
              </button>
            )}
          </div>

          <div className="postotal-line">
            <span>Subtotal</span>
            <span className="num">{money(subtotal)}</span>
          </div>
          <div className="postotal-line grand">
            <span>Total</span>
            <span className="num">{money(subtotal)}</span>
          </div>

          {err && <p className="errortext">{err}</p>}
          <button className="btn primary" style={{ width: "100%", marginTop: 12, padding: 11 }} onClick={openCheckout}>
            Checkout
          </button>
          <div className="foot-note" style={{ marginTop: 10 }}>
            <i /> Checkout opens a receipt preview — the sale is only recorded once you click Complete sale. Closing
            the preview keeps your cart exactly as it was.
          </div>
        </div>
      </div>

      {showPreview && (
        <div className="overlay open">
          <div className="modal">
            <div className="modal-head">
              <div>
                <h3 style={{ marginBottom: 2 }}>{shop?.businessName || "Your shop"}</h3>
                <p style={{ fontSize: 11, color: "var(--muted)", margin: 0 }}>{shop?.address}</p>
              </div>
            </div>
            <p style={{ fontSize: 12, color: "var(--muted)", margin: "0 0 14px" }}>
              Receipt <strong>{nextReceiptNo} (preview)</strong> ·{" "}
              {new Date().toLocaleDateString(undefined, { year: "numeric", month: "short", day: "2-digit" })},{" "}
              {new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} · Cashier:{" "}
              {profile?.name}
            </p>
            <p style={{ fontSize: 13, margin: "0 0 10px" }}>
              <strong>Customer:</strong> {customerName} &nbsp;·&nbsp; <strong>Payment:</strong> {payment}
            </p>
            {cart.map((l, i) => (
              <div className="receipt-line" key={i}>
                <span>
                  {l.productName} × {l.qty}
                  {l.warranty && l.warranty !== "—" && (
                    <span style={{ color: "var(--muted)" }}> ({l.warranty} warranty)</span>
                  )}
                </span>
                <span className="num">{money(l.qty * l.unitPrice)}</span>
              </div>
            ))}
            <div className="receipt-line" style={{ borderBottom: "none", fontWeight: 700, paddingTop: 8 }}>
              <span>Total</span>
              <span className="num">{money(subtotal)}</span>
            </div>
            <div className="foot-note" style={{ marginTop: 12 }}>
              <i /> This is a preview — nothing is recorded yet.
            </div>
            {err && <p className="errortext">{err}</p>}
            <div className="modal-foot">
              <button className="btn" onClick={() => setShowPreview(false)} disabled={completing}>
                Back to cart
              </button>
              <button className="btn" onClick={() => window.print()}>
                Print preview
              </button>
              <button className="btn primary" onClick={completeSale} disabled={completing}>
                {completing ? "Completing…" : "Complete sale"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

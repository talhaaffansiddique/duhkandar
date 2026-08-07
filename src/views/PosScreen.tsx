import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { doc, increment, updateDoc } from "firebase/firestore";
import { db } from "../firebase/config";
import { useAuth } from "../context/AuthContext";
import {
  useShopCollection,
  useShopAuditedWrites,
  useShopPath,
  useShopDoc,
  useShopUsers,
  generateReceiptNumber,
  byCreatedDesc,
} from "../lib/firestore";
import { usePermissions } from "../lib/permissions";
import { nameWithStatus } from "../types";
import type { Product, Sale, SaleLineItem, PaymentMethod } from "../types";
import Modal from "../components/Modal";

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

function SellTab() {
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
  const totalItemsCount = cart.reduce((s, l) => s + l.qty, 0);

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
            <i /> Checkout opens an invoice preview — the sale is only recorded once you click Confirm &amp; Sell.
            Closing the preview keeps your cart exactly as it was.
          </div>
        </div>
      </div>

      {showPreview && (
        <div className="overlay open">
          <div className="modal invoicepreview">
            <div className="invoice-banner">🖨 PROPOSED INVOICE PREVIEW — CLICK CONFIRM TO TRANSACT</div>
            <div className="invoice-body">
              <div className="invoice-head">
                <h3>{shop?.businessName || "DUKANDAR SHOP"}</h3>
                <p>Receipt / Cash Memo</p>
              </div>
              <div className="invoice-meta">
                <div>
                  <strong>Invoice No:</strong> {nextReceiptNo} (preview)
                </div>
                <div>
                  <strong>Customer:</strong> {customerName}
                </div>
                <div>
                  <strong>Date:</strong>{" "}
                  {new Date().toLocaleDateString(undefined, { year: "numeric", month: "short", day: "2-digit" })},{" "}
                  {new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </div>
                <div>
                  <strong>Cashier:</strong> {profile?.name}
                </div>
              </div>

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

              <div className="receipt-line" style={{ borderBottom: "none", paddingTop: 8 }}>
                <span>TOTAL ITEMS COUNT</span>
                <span className="num">{totalItemsCount}</span>
              </div>
              <div className="receipt-line" style={{ borderBottom: "none", fontWeight: 700, fontSize: 15 }}>
                <span>GRAND TOTAL</span>
                <span className="num">{money(subtotal)}</span>
              </div>

              <p style={{ textAlign: "center", fontSize: 12, color: "var(--muted)", margin: "14px 0 0" }}>
                Thank you for shopping with us!
              </p>
              {err && <p className="errortext">{err}</p>}
            </div>
            <div className="modal-foot">
              <button className="btn" onClick={() => setShowPreview(false)} disabled={completing}>
                Cancel Checkout
              </button>
              <button className="btn" onClick={() => window.print()}>
                Print preview
              </button>
              <button className="btn primary" onClick={completeSale} disabled={completing}>
                {completing ? "Confirming…" : "Confirm & Sell"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function EditSaleModal({ sale, onClose }: { sale: Sale; onClose: () => void }) {
  const { profile } = useAuth();
  const { update: updateSale } = useShopAuditedWrites("sales");
  const [customer, setCustomer] = useState(sale.customer);
  const [payment, setPayment] = useState<PaymentMethod>(sale.payment);
  const [status, setStatus] = useState<Sale["status"]>(sale.status);
  const [items, setItems] = useState<SaleLineItem[]>(sale.items.map((it) => ({ ...it })));
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const amount = items.reduce((s, it) => s + it.qty * it.unitPrice, 0);

  function updateItem(idx: number, patch: Partial<SaleLineItem>) {
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  }

  async function save() {
    setSaving(true);
    setErr(null);
    try {
      await updateSale(sale.id, {
        customer: customer.trim() || "Walk-in Customer",
        payment,
        status,
        items,
        amount,
      });
      onClose();
    } catch (e) {
      console.error(e);
      setErr("Could not save changes. Try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      title={`Edit transaction ${sale.receiptNo}`}
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button className="btn primary" onClick={save} disabled={saving}>
            {saving ? "Saving…" : "Save changes"}
          </button>
        </>
      }
    >
      <p style={{ fontSize: 11, color: "var(--muted)", margin: "-8px 0 12px" }}>
        Editing by {profile?.name} — this changes the permanent sale record. Use carefully.
      </p>
      <div className="field-row">
        <div className="field">
          <label>Customer</label>
          <input value={customer} onChange={(e) => setCustomer(e.target.value)} />
        </div>
        <div className="field">
          <label>Payment method</label>
          <select value={payment} onChange={(e) => setPayment(e.target.value as PaymentMethod)}>
            <option value="Cash">Cash</option>
            <option value="Online">Online</option>
            <option value="Card">Card</option>
          </select>
        </div>
      </div>
      <div className="field" style={{ marginBottom: 10 }}>
        <label>Status</label>
        <select value={status} onChange={(e) => setStatus(e.target.value as Sale["status"])}>
          <option value="Paid">Paid</option>
          <option value="Refunded">Refunded</option>
        </select>
      </div>
      <div className="cartrow cartheader">
        <span>Product</span>
        <span>Qty</span>
        <span>Price</span>
        <span>Warranty</span>
        <span>Total</span>
        <span />
      </div>
      {items.map((it, idx) => (
        <div className="cartrow" key={idx}>
          <span>{it.productName}</span>
          <input
            type="number"
            min={1}
            value={it.qty}
            onChange={(e) => updateItem(idx, { qty: Math.max(1, Number(e.target.value)) })}
          />
          <input
            type="number"
            value={it.unitPrice}
            onChange={(e) => updateItem(idx, { unitPrice: Math.max(0, Number(e.target.value)) })}
          />
          <input value={it.warranty ?? ""} onChange={(e) => updateItem(idx, { warranty: e.target.value })} />
          <span className="num">{(it.qty * it.unitPrice).toLocaleString()}</span>
          <span />
        </div>
      ))}
      <div className="postotal-line grand" style={{ marginTop: 10 }}>
        <span>Total</span>
        <span className="num">{money(amount)}</span>
      </div>
      {err && <p className="errortext">{err}</p>}
    </Modal>
  );
}

function TransactionsTab() {
  const { data: sales, loading } = useShopCollection<Sale>("sales", byCreatedDesc());
  const { data: users } = useShopUsers();
  const { isAdmin } = usePermissions();

  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [search, setSearch] = useState("");
  const [paymentFilter, setPaymentFilter] = useState<"All" | PaymentMethod>("All");
  const [statusFilter, setStatusFilter] = useState<"All" | Sale["status"]>("All");
  const [editing, setEditing] = useState<Sale | null>(null);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    const fromMs = dateFrom ? new Date(dateFrom + "T00:00:00").getTime() : null;
    const toMs = dateTo ? new Date(dateTo + "T23:59:59").getTime() : null;
    return sales.filter((s) => {
      if (fromMs !== null && s.createdAt < fromMs) return false;
      if (toMs !== null && s.createdAt > toMs) return false;
      if (paymentFilter !== "All" && s.payment !== paymentFilter) return false;
      if (statusFilter !== "All" && s.status !== statusFilter) return false;
      if (term) {
        const hay = `${s.receiptNo} ${s.customer} ${s.cashierName} ${s.payment} ${s.status}`.toLowerCase();
        if (!hay.includes(term)) return false;
      }
      return true;
    });
  }, [sales, dateFrom, dateTo, paymentFilter, statusFilter, search]);

  return (
    <div>
      <div className="card" style={{ marginBottom: 14 }}>
        <div className="field-row">
          <div className="field">
            <label>From date</label>
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          </div>
          <div className="field">
            <label>To date</label>
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          </div>
          <div className="field">
            <label>Payment</label>
            <select value={paymentFilter} onChange={(e) => setPaymentFilter(e.target.value as "All" | PaymentMethod)}>
              <option value="All">All</option>
              <option value="Cash">Cash</option>
              <option value="Online">Online</option>
              <option value="Card">Card</option>
            </select>
          </div>
          <div className="field">
            <label>Status</label>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as "All" | Sale["status"])}>
              <option value="All">All</option>
              <option value="Paid">Paid</option>
              <option value="Refunded">Refunded</option>
            </select>
          </div>
        </div>
        <div className="field">
          <label>Search (receipt no, customer, cashier)</label>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="26-08-07--001" />
        </div>
      </div>

      <div className="card">
        {loading ? (
          <p style={{ fontSize: 12, color: "var(--muted)" }}>Loading…</p>
        ) : filtered.length === 0 ? (
          <p style={{ fontSize: 12, color: "var(--muted)" }}>No transactions match these filters.</p>
        ) : (
          <div className="table-wrap scroll5">
            <table>
              <tbody>
                <tr>
                  <th>Receipt</th>
                  <th>Date &amp; time</th>
                  <th>Customer</th>
                  <th>Cashier</th>
                  <th>Payment</th>
                  <th className="num">Amount</th>
                  <th>Status</th>
                  {isAdmin && <th />}
                </tr>
                {filtered.map((s) => (
                  <tr key={s.id}>
                    <td>{s.receiptNo}</td>
                    <td>
                      {new Date(s.createdAt).toLocaleDateString()}{" "}
                      {new Date(s.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </td>
                    <td>{s.customer}</td>
                    <td>{nameWithStatus(s.cashierName, users)}</td>
                    <td>{s.payment}</td>
                    <td className="num">{money(s.amount)}</td>
                    <td>
                      <span className={"pill " + (s.status === "Paid" ? "good" : "bad")}>{s.status}</span>
                    </td>
                    {isAdmin && (
                      <td>
                        <button className="btn" style={{ padding: "4px 10px", fontSize: 12 }} onClick={() => setEditing(s)}>
                          Edit
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="foot-note">
          <i /> Every POS sale ever recorded, newest first. Only an Admin with full rights can edit a past
          transaction.
        </div>
      </div>

      {editing && <EditSaleModal sale={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

export default function PosScreen() {
  const [params, setParams] = useSearchParams();
  const sub = params.get("sub") || "sell";

  return (
    <div>
      <div className="tabs2">
        {(["sell", "transactions"] as const).map((t) => (
          <button key={t} className={"tab2" + (sub === t ? " on" : "")} onClick={() => setParams({ sub: t })}>
            {t === "sell" ? "Sell" : "POS transactions"}
          </button>
        ))}
      </div>
      {sub === "sell" && <SellTab />}
      {sub === "transactions" && <TransactionsTab />}
    </div>
  );
}

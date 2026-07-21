import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "../firebase/config";
import { useShopCollection, useShopPath, byCreatedDesc } from "../lib/firestore";
import { useSortableRows } from "../hooks/useSortableRows";
import type { Sale, Product, Purchase, Expense } from "../types";

function money(n: number) {
  return "Rs " + Math.round(n).toLocaleString();
}

function exportRowsToPdf(title: string, columns: string[], rows: (string | number)[][]) {
  import("jspdf").then(({ default: jsPDF }) => {
    const pdf = new jsPDF();
    pdf.setFontSize(14);
    pdf.text(title, 14, 16);
    pdf.setFontSize(9);
    let y = 26;
    pdf.text(columns.join("  |  "), 14, y);
    y += 6;
    rows.forEach((row) => {
      pdf.text(row.join("  |  "), 14, y);
      y += 6;
      if (y > 280) {
        pdf.addPage();
        y = 16;
      }
    });
    pdf.save(`${title.replace(/\s+/g, "_")}.pdf`);
  });
}

function SortHeader({
  label,
  sortKey,
  headerProps,
  num,
}: {
  label: string;
  sortKey: string;
  headerProps: (key: string) => { className: string; onClick: () => void };
  num?: boolean;
}) {
  const props = headerProps(sortKey);
  return (
    <th className={props.className + (num ? " num" : "")} onClick={props.onClick}>
      {label}
      <span className="arrow">▲▼</span>
    </th>
  );
}

function FinancialTab() {
  const { data: sales } = useShopCollection<Sale>("sales", byCreatedDesc());
  const { data: expenses } = useShopCollection<Expense>("expenses");
  const salesPath = useShopPath("sales");
  const [from, setFrom] = useState(() => new Date(Date.now() - 6 * 86400000).toISOString().slice(0, 10));
  const [to, setTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [payment, setPayment] = useState("All payment types");

  const filtered = sales.filter((s) => {
    const d = new Date(s.createdAt).toISOString().slice(0, 10);
    if (d < from || d > to) return false;
    if (payment !== "All payment types" && s.payment !== payment) return false;
    return true;
  });

  const { sorted, headerProps } = useSortableRows(filtered, (row, key) => {
    switch (key) {
      case "receipt": return row.receiptNo;
      case "date": return row.createdAt;
      case "customer": return row.customer;
      case "amount": return row.amount;
      case "payment": return row.payment;
      default: return "";
    }
  });

  const gross = filtered.filter((s) => s.status !== "Refunded").reduce((s, x) => s + x.amount, 0);
  const refunds = filtered.filter((s) => s.status === "Refunded").reduce((s, x) => s + x.amount, 0);
  const periodExpenses = expenses
    .filter((e) => e.date >= from && e.date <= to)
    .reduce((s, x) => s + x.amount, 0);
  const netProfit = gross - refunds - periodExpenses;

  async function refund(saleId: string) {
    if (!salesPath) return;
    // eslint-disable-next-line react-hooks/purity -- Date.now() here runs inside an event handler, not render.
    await updateDoc(doc(db, salesPath, saleId), { status: "Refunded", updatedAt: Date.now() });
  }

  return (
    <div>
      <div className="toolbar">
        <input className="input" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        <span style={{ color: "var(--muted)", fontSize: 13 }}>to</span>
        <input className="input" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        <select className="input" value={payment} onChange={(e) => setPayment(e.target.value)}>
          <option>All payment types</option>
          <option>Cash</option>
          <option>Credit</option>
        </select>
        <button
          className="btn"
          style={{ marginLeft: "auto" }}
          onClick={() =>
            exportRowsToPdf(
              "Financial report",
              ["Receipt", "Date", "Customer", "Amount", "Payment"],
              sorted.map((s) => [s.receiptNo, new Date(s.createdAt).toLocaleDateString(), s.customer, money(s.amount), s.payment])
            )
          }
        >
          Export PDF
        </button>
      </div>
      <div className="grid g4" style={{ marginBottom: 14 }}>
        <div className="card kpi"><div className="label">Gross sales</div><div className="value">{money(gross)}</div></div>
        <div className="card kpi"><div className="label">Expenses</div><div className="value">{money(periodExpenses)}</div></div>
        <div className="card kpi"><div className="label">Refunds</div><div className="value">{money(refunds)}</div></div>
        <div className="card kpi"><div className="label">Net profit (P&amp;L)</div><div className="value">{money(netProfit)}</div></div>
      </div>
      <div className="card">
        {sorted.length === 0 ? (
          <p style={{ fontSize: 12, color: "var(--muted)" }}>No sales in this range.</p>
        ) : (
          <table>
            <tbody>
              <tr>
                <SortHeader label="Receipt #" sortKey="receipt" headerProps={headerProps} />
                <SortHeader label="Date" sortKey="date" headerProps={headerProps} />
                <SortHeader label="Customer" sortKey="customer" headerProps={headerProps} />
                <SortHeader label="Amount" sortKey="amount" headerProps={headerProps} num />
                <SortHeader label="Payment" sortKey="payment" headerProps={headerProps} />
                <th />
              </tr>
              {sorted.map((s) => (
                <tr key={s.id}>
                  <td>{s.receiptNo}</td>
                  <td>{new Date(s.createdAt).toLocaleDateString()}</td>
                  <td>{s.customer}</td>
                  <td className="num">{money(s.amount)}</td>
                  <td>{s.payment}</td>
                  <td>
                    {s.status !== "Refunded" ? (
                      <button className="btn" style={{ padding: "4px 10px", fontSize: 12 }} onClick={() => refund(s.id)}>
                        Refund
                      </button>
                    ) : (
                      <span className="pill warn">Refunded</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <div className="foot-note"><i /> Net profit deducts recorded expenses from gross margin. Click any column header to sort.</div>
      </div>
    </div>
  );
}

function InventoryTab() {
  const { data: products } = useShopCollection<Product>("products");
  const [category, setCategory] = useState("All categories");
  const [status, setStatus] = useState("All stock status");
  const categories = useMemo(() => ["All categories", ...new Set(products.map((p) => p.category))], [products]);

  function statusOf(p: Product) {
    if (p.stock <= 0) return "Out of stock";
    if (p.stock <= 5) return "Low stock";
    return "In stock";
  }

  const filtered = products.filter((p) => {
    if (category !== "All categories" && p.category !== category) return false;
    if (status !== "All stock status" && statusOf(p) !== status) return false;
    return true;
  });

  const { sorted, headerProps } = useSortableRows(filtered, (row, key) => {
    switch (key) {
      case "product": return row.name;
      case "sku": return row.sku;
      case "stock": return row.stock;
      case "cost": return row.avgCost;
      case "price": return row.price;
      case "value": return row.stock * row.avgCost;
      default: return "";
    }
  });

  return (
    <div>
      <div className="toolbar">
        <select className="input" value={category} onChange={(e) => setCategory(e.target.value)}>
          {categories.map((c) => <option key={c}>{c}</option>)}
        </select>
        <select className="input" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option>All stock status</option>
          <option>In stock</option>
          <option>Low stock</option>
          <option>Out of stock</option>
        </select>
        <button
          className="btn"
          style={{ marginLeft: "auto" }}
          onClick={() =>
            exportRowsToPdf(
              "Inventory report",
              ["Product", "SKU", "Stock", "Cost", "Price", "Value"],
              sorted.map((p) => [p.name, p.sku, p.stock, money(p.avgCost), money(p.price), money(p.stock * p.avgCost)])
            )
          }
        >
          Export PDF
        </button>
      </div>
      <div className="card">
        {sorted.length === 0 ? (
          <p style={{ fontSize: 12, color: "var(--muted)" }}>No products match this filter.</p>
        ) : (
          <table>
            <tbody>
              <tr>
                <SortHeader label="Product" sortKey="product" headerProps={headerProps} />
                <SortHeader label="SKU" sortKey="sku" headerProps={headerProps} />
                <SortHeader label="Stock" sortKey="stock" headerProps={headerProps} num />
                <SortHeader label="Cost (avg)" sortKey="cost" headerProps={headerProps} num />
                <SortHeader label="Price" sortKey="price" headerProps={headerProps} num />
                <SortHeader label="Value on hand" sortKey="value" headerProps={headerProps} num />
                <th>Status</th>
              </tr>
              {sorted.map((p) => (
                <tr key={p.id}>
                  <td>{p.name}</td>
                  <td>{p.sku}</td>
                  <td className="num">{p.stock}</td>
                  <td className="num">{money(p.avgCost)}</td>
                  <td className="num">{money(p.price)}</td>
                  <td className="num">{money(p.stock * p.avgCost)}</td>
                  <td>
                    <span className={"pill " + (p.stock <= 0 ? "bad" : p.stock <= 5 ? "warn" : "good")}>{statusOf(p)}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <div className="foot-note"><i /> Stock valuation report — value on hand uses weighted-average cost. Click a header to sort.</div>
      </div>
    </div>
  );
}

function PurchaseTab() {
  const { data: purchases } = useShopCollection<Purchase>("purchases", byCreatedDesc());
  const [from, setFrom] = useState(() => new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10));
  const [to, setTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [supplier, setSupplier] = useState("All suppliers");
  const suppliers = useMemo(() => ["All suppliers", ...new Set(purchases.map((p) => p.supplierName))], [purchases]);

  const filtered = purchases.filter((p) => {
    if (p.date < from || p.date > to) return false;
    if (supplier !== "All suppliers" && p.supplierName !== supplier) return false;
    return true;
  });

  const { sorted, headerProps } = useSortableRows(filtered, (row, key) => {
    switch (key) {
      case "date": return row.date;
      case "supplier": return row.supplierName;
      case "invoice": return row.invoiceNo;
      case "items": return row.items.reduce((s, l) => s + l.qty, 0);
      case "total": return row.total;
      default: return "";
    }
  });

  return (
    <div>
      <div className="toolbar">
        <input className="input" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        <span style={{ color: "var(--muted)", fontSize: 13 }}>to</span>
        <input className="input" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        <select className="input" value={supplier} onChange={(e) => setSupplier(e.target.value)}>
          {suppliers.map((s) => <option key={s}>{s}</option>)}
        </select>
        <button
          className="btn"
          style={{ marginLeft: "auto" }}
          onClick={() =>
            exportRowsToPdf(
              "Purchase report",
              ["Date", "Supplier", "Invoice", "Items", "Total"],
              sorted.map((p) => [p.date, p.supplierName, p.invoiceNo, p.items.reduce((s, l) => s + l.qty, 0), money(p.total)])
            )
          }
        >
          Export PDF
        </button>
      </div>
      <div className="card">
        {sorted.length === 0 ? (
          <p style={{ fontSize: 12, color: "var(--muted)" }}>No purchases in this range.</p>
        ) : (
          <table>
            <tbody>
              <tr>
                <SortHeader label="Date" sortKey="date" headerProps={headerProps} />
                <SortHeader label="Supplier" sortKey="supplier" headerProps={headerProps} />
                <SortHeader label="Invoice" sortKey="invoice" headerProps={headerProps} />
                <SortHeader label="Items" sortKey="items" headerProps={headerProps} num />
                <SortHeader label="Total" sortKey="total" headerProps={headerProps} num />
                <th>Status</th>
              </tr>
              {sorted.map((p) => (
                <tr key={p.id}>
                  <td>{p.date}</td>
                  <td>{p.supplierName}</td>
                  <td>{p.invoiceNo || "—"}</td>
                  <td className="num">{p.items.reduce((s, l) => s + l.qty, 0)}</td>
                  <td className="num">{money(p.total)}</td>
                  <td>
                    <span className={"pill " + (p.status === "Paid" ? "good" : p.status === "Partial" ? "warn" : "bad")}>
                      {p.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <div className="foot-note"><i /> Mirrors Master → Suppliers outstanding balances. Click a header to sort.</div>
      </div>
    </div>
  );
}

export default function ReportsScreen() {
  const [params, setParams] = useSearchParams();
  const sub = params.get("tab") || "financial";

  return (
    <div>
      <div className="tabs2">
        {(["financial", "inventory", "purchase"] as const).map((t) => (
          <button
            key={t}
            className={"tab2" + (sub === t ? " on" : "")}
            onClick={() => setParams({ tab: t })}
          >
            {t[0].toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>
      {sub === "financial" && <FinancialTab />}
      {sub === "inventory" && <InventoryTab />}
      {sub === "purchase" && <PurchaseTab />}
    </div>
  );
}

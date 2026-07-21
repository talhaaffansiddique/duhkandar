import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useCollection, byCreatedDesc } from "../lib/firestore";
import type { Sale, Product, Purchase } from "../types";
import ReceiptModal from "../components/ReceiptModal";

function money(n: number) {
  return "Rs " + Math.round(n).toLocaleString();
}
function isToday(ts: number) {
  const d = new Date(ts);
  const now = new Date();
  return d.toDateString() === now.toDateString();
}
function startOfWeek() {
  const d = new Date();
  const day = d.getDay();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - day);
  return d.getTime();
}

export default function DashboardScreen() {
  const navigate = useNavigate();
  const { data: sales } = useCollection<Sale>("sales", byCreatedDesc());
  const { data: products } = useCollection<Product>("products");
  const { data: purchases } = useCollection<Purchase>("purchases");
  const [openReceipt, setOpenReceipt] = useState<Sale | null>(null);

  const todaySales = useMemo(() => sales.filter((s) => isToday(s.createdAt) && s.status !== "Refunded"), [sales]);
  const todayTotal = useMemo(() => todaySales.reduce((sum, s) => sum + s.amount, 0), [todaySales]);
  const todayProfit = useMemo(() => {
    return todaySales.reduce((sum, s) => {
      const lineProfit = s.items.reduce((lp, it) => {
        const product = products.find((p) => p.id === it.productId);
        const cost = product?.avgCost ?? 0;
        return lp + (it.unitPrice - cost) * it.qty;
      }, 0);
      return sum + lineProfit;
    }, 0);
  }, [todaySales, products]);
  const lowStock = useMemo(() => products.filter((p) => p.stock > 0 && p.stock <= 5), [products]);
  const pendingDues = useMemo(() => purchases.filter((p) => p.status !== "Paid"), [purchases]);
  const pendingDuesTotal = useMemo(() => pendingDues.reduce((s, p) => s + p.total, 0), [pendingDues]);

  const weekTotals = useMemo(() => {
    const start = startOfWeek();
    const days = [0, 0, 0, 0, 0, 0, 0];
    sales.forEach((s) => {
      if (s.status === "Refunded" || s.createdAt < start) return;
      const dayIdx = new Date(s.createdAt).getDay();
      days[dayIdx] += s.amount;
    });
    return days;
  }, [sales]);
  const maxDay = Math.max(1, ...weekTotals);

  const categoryTotals = useMemo(() => {
    const totals: Record<string, number> = {};
    products.forEach((p) => {
      totals[p.category] = (totals[p.category] || 0) + p.stock * p.avgCost;
    });
    const entries = Object.entries(totals);
    const grand = entries.reduce((s, [, v]) => s + v, 0) || 1;
    return entries.map(([name, value]) => ({ name, pct: Math.round((value / grand) * 100) }));
  }, [products]);

  const recent = sales.slice(0, 5);
  const dayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const colors = ["var(--accent)", "var(--warm)", "var(--line)"];

  return (
    <div>
      <p style={{ fontSize: 12, color: "var(--muted)", margin: "-6px 0 14px" }}>
        Every number below is clickable — it opens the report or screen it was calculated from.
      </p>
      <div className="grid g4" style={{ marginBottom: 16 }}>
        <div className="card kpi clickable" onClick={() => navigate("/reports")}>
          <div className="label">Today's sales</div>
          <div className="value">{money(todayTotal)}</div>
          <div className="delta">{todaySales.length} transactions</div>
        </div>
        <div className="card kpi clickable" onClick={() => navigate("/reports")}>
          <div className="label">Today's profit</div>
          <div className="value">{money(todayProfit)}</div>
        </div>
        <div className="card kpi clickable" onClick={() => navigate("/inventory")}>
          <div className="label">Low stock items</div>
          <div className="value">{lowStock.length}</div>
          <div className="delta down">{lowStock.length > 0 ? "▼ needs reorder" : "all healthy"}</div>
        </div>
        <div className="card kpi clickable" onClick={() => navigate("/purchases")}>
          <div className="label">Pending dues</div>
          <div className="value">{money(pendingDuesTotal)}</div>
          <div className="delta">{pendingDues.length} invoices</div>
        </div>
      </div>

      <div className="grid g2">
        <div className="card clickable" onClick={() => navigate("/reports")}>
          <p className="sectitle">Weekly sales</p>
          <div className="bars">
            {weekTotals.map((v, i) => (
              <div key={i} className="bar" style={{ height: `${Math.max(4, (v / maxDay) * 100)}%` }}>
                <span>{dayLabels[i]}</span>
              </div>
            ))}
          </div>
          <p style={{ fontSize: 11, color: "var(--muted)", margin: "22px 0 0" }}>
            From the sales register — click to open Reports.
          </p>
        </div>
        <div className="card">
          <p className="sectitle">Category split (stock value)</p>
          {categoryTotals.length === 0 ? (
            <p style={{ fontSize: 12, color: "var(--muted)" }}>Add products in Inventory to see this chart.</p>
          ) : (
            <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
              <div
                className="pie"
                style={{
                  background: `conic-gradient(${categoryTotals
                    .map((c, i) => {
                      const startPct = categoryTotals.slice(0, i).reduce((s, x) => s + x.pct, 0);
                      return `${colors[i % colors.length]} ${startPct}% ${startPct + c.pct}%`;
                    })
                    .join(", ")})`,
                }}
              />
              <div className="legend clickable">
                {categoryTotals.map((c, i) => (
                  <div key={c.name} onClick={() => navigate(`/inventory?category=${encodeURIComponent(c.name)}`)}>
                    <span className="sw" style={{ background: colors[i % colors.length] }} />
                    {c.name} — {c.pct}%
                  </div>
                ))}
              </div>
            </div>
          )}
          <p style={{ fontSize: 11, color: "var(--muted)", margin: "12px 0 0" }}>
            From product categories in Inventory — click a slice to filter there.
          </p>
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <p className="sectitle">Recent transactions</p>
        {recent.length === 0 ? (
          <p style={{ fontSize: 12, color: "var(--muted)" }}>No sales recorded yet.</p>
        ) : (
          <table>
            <tbody>
              <tr>
                <th>Time</th>
                <th>Customer</th>
                <th>Items</th>
                <th className="num">Amount</th>
                <th>Status</th>
              </tr>
              {recent.map((s) => (
                <tr key={s.id} className="clickrow" onClick={() => setOpenReceipt(s)}>
                  <td>{new Date(s.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</td>
                  <td>{s.customer}</td>
                  <td>{s.items.reduce((n, it) => n + it.qty, 0)}</td>
                  <td className="num">{money(s.amount)}</td>
                  <td>
                    <span className={"pill " + (s.status === "Paid" ? "good" : "warn")}>{s.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <div className="foot-note">
          <i /> Click a row to open the original receipt. Every row stores a full created-at timestamp internally,
          even where the screen only shows the time.
        </div>
      </div>

      {openReceipt && <ReceiptModal sale={openReceipt} onClose={() => setOpenReceipt(null)} />}
    </div>
  );
}

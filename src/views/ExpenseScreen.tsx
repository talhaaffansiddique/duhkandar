import { useMemo, useState } from "react";
import { useCollection, useAuditedWrites, byCreatedDesc } from "../lib/firestore";
import { useAuth } from "../context/AuthContext";
import type { Expense } from "../types";

const CATEGORIES: Expense["category"][] = ["Rent", "Utilities", "Salaries", "Transport", "Miscellaneous"];
const COLORS: Record<string, string> = {
  Rent: "var(--accent)",
  Utilities: "var(--warm)",
  Salaries: "var(--good)",
  Transport: "var(--bad)",
  Miscellaneous: "var(--line)",
};

function money(n: number) {
  return "Rs " + Math.round(n).toLocaleString();
}

export default function ExpenseScreen() {
  const { profile } = useAuth();
  const { data: expenses, loading } = useCollection<Expense>("expenses", byCreatedDesc());
  const { create } = useAuditedWrites("expenses");

  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [category, setCategory] = useState<Expense["category"]>("Rent");
  const [amount, setAmount] = useState(0);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const thisMonth = useMemo(() => {
    const now = new Date();
    return expenses.filter((e) => {
      const d = new Date(e.createdAt);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    });
  }, [expenses]);
  const monthTotal = thisMonth.reduce((s, e) => s + e.amount, 0);
  const byCategory = useMemo(() => {
    const totals: Record<string, number> = {};
    thisMonth.forEach((e) => {
      totals[e.category] = (totals[e.category] || 0) + e.amount;
    });
    return Object.entries(totals).sort((a, b) => b[1] - a[1]);
  }, [thisMonth]);

  async function handleSave() {
    if (amount <= 0) {
      setErr("Enter an amount greater than zero.");
      return;
    }
    setSaving(true);
    setErr(null);
    try {
      await create({
        date,
        category,
        amount,
        note: note.trim(),
        addedByName: profile?.name || "Unknown",
      });
      setAmount(0);
      setNote("");
    } catch (e) {
      console.error(e);
      setErr("Could not save expense. Try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="grid g2">
        <div className="card">
          <p className="sectitle">Add expense</p>
          <div className="field">
            <label>Date</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="field">
            <label>Category</label>
            <select value={category} onChange={(e) => setCategory(e.target.value as Expense["category"])}>
              {CATEGORIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Amount (Rs)</label>
            <input type="number" value={amount || ""} onChange={(e) => setAmount(Number(e.target.value))} />
          </div>
          <div className="field">
            <label>Note</label>
            <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Electricity bill — July" />
          </div>
          {err && <p className="errortext">{err}</p>}
          <button className="btn primary" style={{ width: "100%" }} onClick={handleSave} disabled={saving}>
            {saving ? "Saving…" : "Save expense"}
          </button>
        </div>
        <div className="card">
          <p className="sectitle">This month</p>
          <div className="kpi">
            <div className="label">Total expenses</div>
            <div className="value">{money(monthTotal)}</div>
          </div>
          <div className="legend" style={{ marginTop: 14 }}>
            {byCategory.length === 0 ? (
              <p style={{ fontSize: 12, color: "var(--muted)" }}>No expenses logged this month.</p>
            ) : (
              byCategory.map(([cat, total]) => (
                <div key={cat}>
                  <span className="sw" style={{ background: COLORS[cat] }} />
                  {cat} — {money(total)}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
      <div className="card" style={{ marginTop: 16 }}>
        <p className="sectitle">Expense log</p>
        {loading ? (
          <p style={{ fontSize: 12, color: "var(--muted)" }}>Loading…</p>
        ) : expenses.length === 0 ? (
          <p style={{ fontSize: 12, color: "var(--muted)" }}>No expenses recorded yet.</p>
        ) : (
          <table>
            <tbody>
              <tr>
                <th>Date</th>
                <th>Category</th>
                <th>Note</th>
                <th className="num">Amount</th>
                <th>Added by</th>
              </tr>
              {expenses.map((e) => (
                <tr key={e.id}>
                  <td>{e.date}</td>
                  <td>{e.category}</td>
                  <td>{e.note || "—"}</td>
                  <td className="num">{money(e.amount)}</td>
                  <td>{e.addedByName}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <div className="foot-note">
          <i /> Feeds directly into the P&amp;L figure on the Reports screen.
        </div>
      </div>
    </div>
  );
}

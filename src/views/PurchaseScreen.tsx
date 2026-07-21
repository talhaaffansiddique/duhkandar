import { useState } from "react";
import { useShopCollection, byCreatedDesc } from "../lib/firestore";
import type { Purchase, Supplier } from "../types";
import RecordPurchaseModal from "../components/RecordPurchaseModal";

function money(n: number) {
  return Math.round(n).toLocaleString();
}

export default function PurchaseScreen() {
  const { data: purchases, loading } = useShopCollection<Purchase>("purchases", byCreatedDesc());
  const { data: suppliers } = useShopCollection<Supplier>("suppliers");
  const [supplierFilter, setSupplierFilter] = useState("All suppliers");
  const [modalOpen, setModalOpen] = useState(false);

  const filtered = purchases.filter((p) => supplierFilter === "All suppliers" || p.supplierName === supplierFilter);

  return (
    <div>
      <div className="toolbar">
        <button className="btn primary" onClick={() => setModalOpen(true)}>
          + Record purchase
        </button>
        <select className="input" value={supplierFilter} onChange={(e) => setSupplierFilter(e.target.value)}>
          <option>All suppliers</option>
          {suppliers.map((s) => (
            <option key={s.id}>{s.name}</option>
          ))}
        </select>
      </div>
      <div className="card">
        {loading ? (
          <p style={{ fontSize: 12, color: "var(--muted)" }}>Loading…</p>
        ) : filtered.length === 0 ? (
          <p style={{ fontSize: 12, color: "var(--muted)" }}>
            No purchases recorded yet. Add a supplier in Master, then click "+ Record purchase".
          </p>
        ) : (
          <table>
            <tbody>
              <tr>
                <th>Date</th>
                <th>Supplier</th>
                <th>Invoice</th>
                <th className="num">Items</th>
                <th className="num">Total</th>
                <th>Attachment</th>
                <th>Status</th>
              </tr>
              {filtered.map((p) => (
                <tr key={p.id}>
                  <td>{p.date}</td>
                  <td>{p.supplierName}</td>
                  <td>{p.invoiceNo || "—"}</td>
                  <td className="num">{p.items.reduce((s, l) => s + l.qty, 0)}</td>
                  <td className="num">{money(p.total)}</td>
                  <td>{p.attachmentUrl ? <a href={p.attachmentUrl} target="_blank" rel="noreferrer">📎 view</a> : "—"}</td>
                  <td>
                    <span
                      className={"pill " + (p.status === "Paid" ? "good" : p.status === "Partial" ? "warn" : "bad")}
                    >
                      {p.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <div className="foot-note">
          <i /> Suppliers here are pulled live from Master → Suppliers.
        </div>
      </div>
      {modalOpen && <RecordPurchaseModal onClose={() => setModalOpen(false)} />}
    </div>
  );
}

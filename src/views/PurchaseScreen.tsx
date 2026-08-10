import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useShopCollection, byCreatedDesc } from "../lib/firestore";
import { useSortableRows } from "../hooks/useSortableRows";
import SortHeader from "../components/SortHeader";
import type { Purchase, Supplier } from "../types";
import RecordPurchaseModal from "../components/RecordPurchaseModal";
import Modal from "../components/Modal";

function money(n: number) {
  return Math.round(n).toLocaleString();
}

function ItemsModal({ purchase, onClose }: { purchase: Purchase; onClose: () => void }) {
  return (
    <Modal title={`Items — ${purchase.supplierName}`} onClose={onClose} footer={<button className="btn" onClick={onClose}>Close</button>}>
      <div className="linerow" style={{ fontSize: 11, color: "var(--muted)" }}>
        <span>Product</span>
        <span>Qty</span>
        <span>Unit cost</span>
        <span>Subtotal</span>
      </div>
      {purchase.items.map((it, idx) => (
        <div className="linerow" key={idx} style={{ gridTemplateColumns: "2fr 1fr 1fr 1fr" }}>
          <span>{it.productName}</span>
          <span>{it.qty}</span>
          <span>Rs {money(it.unitCost)}</span>
          <span>Rs {money(it.qty * it.unitCost)}</span>
        </div>
      ))}
      <div className="postotal-line grand" style={{ marginTop: 10 }}>
        <span>Total</span>
        <span className="num">Rs {money(purchase.total)}</span>
      </div>
    </Modal>
  );
}

function InvoiceModal({
  purchase,
  onClose,
  onRecordPayment,
}: {
  purchase: Purchase;
  onClose: () => void;
  onRecordPayment: () => void;
}) {
  return (
    <Modal
      title={`Invoice — ${purchase.invoiceNo || purchase.supplierName}`}
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>
            Close
          </button>
          <button className="btn primary" onClick={onRecordPayment}>
            Record payment
          </button>
        </>
      }
    >
      <div className="field-row">
        <div className="field">
          <label>Supplier</label>
          <input value={purchase.supplierName} readOnly />
        </div>
        <div className="field">
          <label>Invoice #</label>
          <input value={purchase.invoiceNo || "—"} readOnly />
        </div>
        <div className="field">
          <label>Date</label>
          <input value={purchase.date} readOnly />
        </div>
      </div>

      <label style={{ fontSize: 12, color: "var(--muted)", display: "block", margin: "4px 0 6px" }}>Line items</label>
      <div className="linerow" style={{ fontSize: 11, color: "var(--muted)", gridTemplateColumns: "2fr 1fr 1fr 1fr" }}>
        <span>Product</span>
        <span>Qty</span>
        <span>Unit cost</span>
        <span>Subtotal</span>
      </div>
      {purchase.items.map((it, idx) => (
        <div className="linerow" key={idx} style={{ gridTemplateColumns: "2fr 1fr 1fr 1fr" }}>
          <span>{it.productName}</span>
          <span>{it.qty}</span>
          <span>Rs {money(it.unitCost)}</span>
          <span>Rs {money(it.qty * it.unitCost)}</span>
        </div>
      ))}

      <div className="postotal-line" style={{ marginTop: 10 }}>
        <span>Total</span>
        <span className="num">Rs {money(purchase.total)}</span>
      </div>
      <div className="postotal-line grand">
        <span>Status</span>
        <span className="num">
          {purchase.status}
          {purchase.dueDate && purchase.status !== "Paid"
            ? ` · Due ${new Date(purchase.dueDate + "T00:00:00").toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" })}`
            : ""}
        </span>
      </div>

      {purchase.attachmentUrl && (
        <p style={{ fontSize: 12, marginTop: 10 }}>
          <a href={purchase.attachmentUrl} target="_blank" rel="noreferrer">
            📎 View attached invoice file
          </a>
        </p>
      )}
    </Modal>
  );
}

export default function PurchaseScreen() {
  const { data: purchases, loading } = useShopCollection<Purchase>("purchases", byCreatedDesc());
  const { data: suppliers } = useShopCollection<Supplier>("suppliers");
  const [params, setParams] = useSearchParams();
  const [supplierFilter, setSupplierFilter] = useState("All suppliers");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Purchase | undefined>(undefined);
  const [itemsView, setItemsView] = useState<Purchase | null>(null);
  const [invoiceView, setInvoiceView] = useState<Purchase | null>(null);

  const statusFilter = params.get("status") || "All";

  const filtered = purchases.filter((p) => {
    const matchesSupplier = supplierFilter === "All suppliers" || p.supplierName === supplierFilter;
    const matchesStatus =
      statusFilter === "All" ? true : statusFilter === "Unpaid" ? p.status !== "Paid" : p.status === "Paid";
    return matchesSupplier && matchesStatus;
  });

  const { sorted, headerProps } = useSortableRows(filtered, (row, key) => {
    switch (key) {
      case "date": return row.date;
      case "supplier": return row.supplierName;
      case "invoice": return row.invoiceNo;
      case "items": return row.items.reduce((s, l) => s + l.qty, 0);
      case "total": return row.total;
      case "attachment": return row.attachmentUrl ? 1 : 0;
      case "status": return row.status;
      default: return "";
    }
  });

  return (
    <div>
      <div className="toolbar">
        <button
          className="btn primary"
          onClick={() => {
            setEditing(undefined);
            setModalOpen(true);
          }}
        >
          + Record purchase
        </button>
        <select className="input" value={supplierFilter} onChange={(e) => setSupplierFilter(e.target.value)}>
          <option>All suppliers</option>
          {suppliers.map((s) => (
            <option key={s.id}>{s.name}</option>
          ))}
        </select>
        <select className="input" value={statusFilter} onChange={(e) => setParams({ status: e.target.value })}>
          <option value="All">Paid and unpaid</option>
          <option value="Unpaid">Unpaid (incl. partial)</option>
          <option value="Paid">Paid</option>
        </select>
      </div>
      <div className="card">
        {loading ? (
          <p style={{ fontSize: 12, color: "var(--muted)" }}>Loading…</p>
        ) : filtered.length === 0 ? (
          <p style={{ fontSize: 12, color: "var(--muted)" }}>
            No purchases match. Add a supplier in Master, then click "+ Record purchase".
          </p>
        ) : (
          <table>
            <tbody>
              <tr>
                <SortHeader label="Date" sortKey="date" headerProps={headerProps} />
                <SortHeader label="Supplier" sortKey="supplier" headerProps={headerProps} />
                <SortHeader label="Invoice" sortKey="invoice" headerProps={headerProps} />
                <SortHeader label="Items" sortKey="items" headerProps={headerProps} num />
                <SortHeader label="Total" sortKey="total" headerProps={headerProps} num />
                <SortHeader label="Attachment" sortKey="attachment" headerProps={headerProps} />
                <SortHeader label="Status" sortKey="status" headerProps={headerProps} />
              </tr>
              {sorted.map((p) => (
                <tr key={p.id}>
                  <td>{p.date}</td>
                  <td>{p.supplierName}</td>
                  <td>
                    <button className="linklike" onClick={() => setInvoiceView(p)}>
                      {p.invoiceNo || "View invoice"}
                    </button>
                  </td>
                  <td className="num">
                    <button className="linklike" onClick={() => setItemsView(p)}>
                      {p.items.reduce((s, l) => s + l.qty, 0)}
                    </button>
                  </td>
                  <td className="num">{money(p.total)}</td>
                  <td>
                    {p.attachmentUrl ? (
                      <a href={p.attachmentUrl} target="_blank" rel="noreferrer">
                        📎 view
                      </a>
                    ) : (
                      "—"
                    )}
                  </td>
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
          <i /> Suppliers here are pulled live from Master → Suppliers. Click "Items" to see what was purchased,
          click "Invoice" to view the full read-only invoice and record a payment.
        </div>
      </div>
      {modalOpen && (
        <RecordPurchaseModal
          existing={editing}
          onClose={() => {
            setModalOpen(false);
            setEditing(undefined);
          }}
        />
      )}
      {itemsView && <ItemsModal purchase={itemsView} onClose={() => setItemsView(null)} />}
      {invoiceView && (
        <InvoiceModal
          purchase={invoiceView}
          onClose={() => setInvoiceView(null)}
          onRecordPayment={() => {
            setEditing(invoiceView);
            setInvoiceView(null);
            setModalOpen(true);
          }}
        />
      )}
    </div>
  );
}

import Modal from "./Modal";
import type { Sale } from "../types";

function money(n: number) {
  return "Rs " + Math.round(n).toLocaleString();
}

export default function ReceiptModal({ sale, onClose }: { sale: Sale; onClose: () => void }) {
  return (
    <Modal
      title={`Receipt ${sale.receiptNo}`}
      onClose={onClose}
      footer={
        <button className="btn primary" onClick={onClose}>
          Close
        </button>
      }
    >
      <p style={{ fontSize: 12, color: "var(--muted)", margin: "-8px 0 14px" }}>
        Sold {new Date(sale.createdAt).toLocaleString()} · Cashier: {sale.cashierName}
      </p>
      {sale.items.map((it, i) => (
        <div className="receipt-line" key={i}>
          <span>
            {it.productName} × {it.qty}
          </span>
          <span className="num">{money(it.unitPrice * it.qty)}</span>
        </div>
      ))}
      <div className="receipt-line" style={{ borderBottom: "none", fontWeight: 700, paddingTop: 8 }}>
        <span>Total</span>
        <span className="num">{money(sale.amount)}</span>
      </div>
      <div className="foot-note" style={{ marginTop: 12 }}>
        <i /> This is the exact source record backing the dashboard total — full audit trail stored with each line.
      </div>
    </Modal>
  );
}

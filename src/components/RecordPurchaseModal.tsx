import { useState } from "react";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "../firebase/config";
import { uploadToCloudinary } from "../lib/cloudinary";
import { useShopCollection, useShopAuditedWrites, useShopPath } from "../lib/firestore";
import { useAuth } from "../context/AuthContext";
import Modal from "./Modal";
import { purchasePaidTotal, purchaseStatus } from "../types";
import type { Product, Supplier, PurchaseLineItem, Purchase, PurchasePayment } from "../types";

interface DraftLine {
  productId: string;
  qty: number;
  unitCost: number;
}

function money(n: number) {
  return Math.round(n).toLocaleString();
}

export default function RecordPurchaseModal({ onClose, existing }: { onClose: () => void; existing?: Purchase }) {
  const { profile } = useAuth();
  const { data: suppliers } = useShopCollection<Supplier>("suppliers");
  const { data: products } = useShopCollection<Product>("products");
  const { create: createPurchase, update: updatePurchase } = useShopAuditedWrites("purchases");
  const productsPath = useShopPath("products");
  const isEditing = !!existing;

  const [supplierId, setSupplierId] = useState(existing?.supplierId ?? suppliers[0]?.id ?? "");
  const [invoiceNo, setInvoiceNo] = useState(existing?.invoiceNo ?? "");
  const [date, setDate] = useState(existing?.date ?? new Date().toISOString().slice(0, 10));
  const [lines, setLines] = useState<DraftLine[]>(
    existing ? existing.items.map((it) => ({ productId: it.productId, qty: it.qty, unitCost: it.unitCost })) : [{ productId: products[0]?.id ?? "", qty: 1, unitCost: 0 }]
  );
  const [attachMode, setAttachMode] = useState<"file" | "camera" | "url">("file");
  const [attachmentUrl, setAttachmentUrl] = useState(existing?.attachmentUrl ?? "");
  const [payments, setPayments] = useState<PurchasePayment[]>(existing?.payments ?? []);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const total = lines.reduce((s, l) => s + l.qty * l.unitCost, 0);
  const paidSoFar = purchasePaidTotal({ payments });
  const remaining = Math.max(0, total - paidSoFar);
  const derivedStatus = purchaseStatus({ payments, total });

  const [newPaymentAmount, setNewPaymentAmount] = useState(remaining);
  const [newPaymentDate, setNewPaymentDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [newPaymentNote, setNewPaymentNote] = useState("");

  function updateLine(idx: number, patch: Partial<DraftLine>) {
    setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
  }
  function addLine() {
    setLines((prev) => [...prev, { productId: products[0]?.id ?? "", qty: 1, unitCost: 0 }]);
  }
  function removeLine(idx: number) {
    setLines((prev) => prev.filter((_, i) => i !== idx));
  }

  function addPayment() {
    if (newPaymentAmount <= 0) {
      setErr("Enter a payment amount above zero.");
      return;
    }
    setErr(null);
    const paidAt = new Date(newPaymentDate + "T" + new Date().toTimeString().slice(0, 8)).getTime();
    const note = newPaymentNote.trim();
    setPayments((prev) => [
      ...prev,
      {
        amount: newPaymentAmount,
        paidAt,
        recordedBy: profile?.name || "Unknown",
        ...(note ? { note } : {}),
      },
    ]);
    setNewPaymentAmount(0);
    setNewPaymentNote("");
  }
  function removePayment(idx: number) {
    setPayments((prev) => prev.filter((_, i) => i !== idx));
  }

  async function handleFileAttach(file: File) {
    try {
      const url = await uploadToCloudinary(file);
      setAttachmentUrl(url);
    } catch (e) {
      console.error(e);
      setErr(e instanceof Error ? e.message : "Attachment upload failed.");
    }
  }

  async function handleSave() {
    const supplier = suppliers.find((s) => s.id === supplierId);
    if (!supplier) {
      setErr("Add a supplier in Master first.");
      return;
    }
    if (lines.some((l) => !l.productId || l.qty <= 0)) {
      setErr("Every line needs a product and a quantity above zero.");
      return;
    }
    setSaving(true);
    setErr(null);
    try {
      const items: PurchaseLineItem[] = lines.map((l) => {
        const p = products.find((pp) => pp.id === l.productId)!;
        return { productId: p.id, productName: p.name, qty: l.qty, unitCost: l.unitCost };
      });

      if (!isEditing) {
        // Weighted-average cost: fold each line into its product before writing the purchase record.
        if (!productsPath) throw new Error("No shop selected yet.");
        for (const line of lines) {
          const product = products.find((p) => p.id === line.productId);
          if (!product) continue;
          const newStock = product.stock + line.qty;
          const newAvgCost = (product.stock * product.avgCost + line.qty * line.unitCost) / newStock;
          await updateDoc(doc(db, productsPath, product.id), {
            stock: newStock,
            avgCost: newAvgCost,
            // eslint-disable-next-line react-hooks/purity -- Date.now() here runs inside an event handler, not render.
            updatedAt: Date.now(),
          });
        }
      }

      const payload = {
        supplierId,
        supplierName: supplier.name,
        invoiceNo,
        date,
        items,
        total,
        payments,
        status: derivedStatus,
        ...(attachmentUrl ? { attachmentUrl } : {}),
      };

      if (isEditing) {
        await updatePurchase(existing.id, payload);
      } else {
        await createPurchase(payload);
      }
      onClose();
    } catch (e) {
      console.error(e);
      setErr("Could not save purchase. Try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      title={isEditing ? `Purchase — ${existing.invoiceNo || existing.supplierName}` : "Record purchase"}
      onClose={onClose}
      footer={
        <>
          <span className="num" style={{ marginRight: "auto", fontWeight: 600 }}>
            Total: Rs {money(total)}
          </span>
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button className="btn primary" onClick={handleSave} disabled={saving}>
            {saving ? "Saving…" : isEditing ? "Save changes" : "Save purchase"}
          </button>
        </>
      }
    >
      <div className="field-row">
        <div className="field">
          <label>Supplier</label>
          <select value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
            {suppliers.length === 0 && <option value="">Add a supplier in Master first</option>}
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Invoice #</label>
          <input value={invoiceNo} onChange={(e) => setInvoiceNo(e.target.value)} placeholder="INV-7802" />
        </div>
        <div className="field">
          <label>Date</label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
      </div>

      <label style={{ fontSize: 12, color: "var(--muted)", display: "block", margin: "4px 0 6px" }}>Line items</label>
      <div className="linerow" style={{ fontSize: 11, color: "var(--muted)" }}>
        <span>Product</span>
        <span>Qty</span>
        <span>Unit cost</span>
        <span>Subtotal</span>
        <span />
      </div>
      {lines.map((l, idx) => (
        <div className="linerow" key={idx}>
          {isEditing ? (
            <input value={l.qty + " × " + (products.find((p) => p.id === l.productId)?.name ?? "")} readOnly />
          ) : (
            <select value={l.productId} onChange={(e) => updateLine(idx, { productId: e.target.value })}>
              {products.length === 0 && <option value="">Add products first</option>}
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          )}
          <input
            type="number"
            value={l.qty}
            readOnly={isEditing}
            onChange={(e) => updateLine(idx, { qty: Number(e.target.value) })}
          />
          <input
            type="number"
            value={l.unitCost}
            readOnly={isEditing}
            onChange={(e) => updateLine(idx, { unitCost: Number(e.target.value) })}
          />
          <input value={money(l.qty * l.unitCost)} readOnly />
          {!isEditing && (
            <button className="btn" style={{ padding: "4px 8px", fontSize: 12 }} onClick={() => removeLine(idx)}>
              ×
            </button>
          )}
        </div>
      ))}
      {!isEditing && (
        <button className="btn" style={{ margin: "4px 0 14px" }} onClick={addLine}>
          + Add line item
        </button>
      )}
      {isEditing && (
        <p style={{ fontSize: 11, color: "var(--muted)", margin: "0 0 14px" }}>
          Line items are locked once a purchase is recorded, to keep stock and cost accurate. Use Purchases to
          record a correction as a new entry if needed.
        </p>
      )}

      <label style={{ fontSize: 12, color: "var(--muted)", display: "block", margin: "4px 0 6px" }}>Payments</label>
      <div className="postotal-line">
        <span>Total</span>
        <span className="num">Rs {money(total)}</span>
      </div>
      <div className="postotal-line">
        <span>Paid so far</span>
        <span className="num">Rs {money(paidSoFar)}</span>
      </div>
      {remaining > 0 && (
        <div className="postotal-line grand">
          <span>Total remaining</span>
          <span className="num">Rs {money(remaining)}</span>
        </div>
      )}
      <div className="foot-note" style={{ margin: "6px 0 10px" }}>
        <i />
        Status: <strong style={{ marginLeft: 4 }}>{derivedStatus}</strong>
      </div>

      {payments.length > 0 && (
        <div style={{ marginBottom: 10 }}>
          {payments.map((p, idx) => (
            <div className="receipt-line" key={idx}>
              <span>
                {new Date(p.paidAt).toLocaleDateString()} {new Date(p.paidAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                {p.note ? ` — ${p.note}` : ""} · {p.recordedBy}
              </span>
              <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span className="num">Rs {money(p.amount)}</span>
                <button className="btn" style={{ padding: "2px 6px", fontSize: 11 }} onClick={() => removePayment(idx)}>
                  ×
                </button>
              </span>
            </div>
          ))}
        </div>
      )}

      {remaining > 0 && (
        <div className="field-row" style={{ alignItems: "flex-end" }}>
          <div className="field">
            <label>Payment amount</label>
            <input type="number" value={newPaymentAmount || ""} onChange={(e) => setNewPaymentAmount(Number(e.target.value))} />
          </div>
          <div className="field">
            <label>Date</label>
            <input type="date" value={newPaymentDate} onChange={(e) => setNewPaymentDate(e.target.value)} />
          </div>
          <div className="field">
            <label>Note (optional)</label>
            <input value={newPaymentNote} onChange={(e) => setNewPaymentNote(e.target.value)} placeholder="Cash to driver" />
          </div>
          <button className="btn" style={{ marginBottom: 12 }} onClick={addPayment}>
            + Add payment
          </button>
        </div>
      )}

      <label style={{ fontSize: 12, color: "var(--muted)", display: "block", margin: "10px 0 6px" }}>Attach invoice</label>
      <div className="attach-tabs" style={{ display: "flex", gap: 4, marginBottom: 10 }}>
        {(["file", "camera", "url"] as const).map((m) => (
          <button key={m} className={"tab2" + (attachMode === m ? " on" : "")} onClick={() => setAttachMode(m)}>
            {m === "file" ? "Upload file" : m === "camera" ? "Camera" : "Cloud URL"}
          </button>
        ))}
      </div>
      {attachMode === "url" ? (
        <input
          className="input"
          style={{ width: "100%" }}
          placeholder="https://..."
          value={attachmentUrl}
          onChange={(e) => setAttachmentUrl(e.target.value)}
        />
      ) : (
        <input
          className="input"
          style={{ width: "100%" }}
          type="file"
          accept="image/*,application/pdf"
          capture={attachMode === "camera" ? "environment" : undefined}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFileAttach(file);
          }}
        />
      )}
      {attachmentUrl && attachMode !== "url" && (
        <p style={{ fontSize: 11, color: "var(--good)", margin: "6px 0 0" }}>Attached.</p>
      )}
      {err && <p className="errortext">{err}</p>}
    </Modal>
  );
}

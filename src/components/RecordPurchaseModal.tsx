import { useState } from "react";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "../firebase/config";
import { uploadToCloudinary } from "../lib/cloudinary";
import { useCollection, useAuditedWrites } from "../lib/firestore";
import Modal from "./Modal";
import type { Product, Supplier, PurchaseLineItem } from "../types";

interface DraftLine {
  productId: string;
  qty: number;
  unitCost: number;
}

export default function RecordPurchaseModal({ onClose }: { onClose: () => void }) {
  const { data: suppliers } = useCollection<Supplier>("suppliers");
  const { data: products } = useCollection<Product>("products");
  const { create: createPurchase } = useAuditedWrites("purchases");

  const [supplierId, setSupplierId] = useState(suppliers[0]?.id ?? "");
  const [invoiceNo, setInvoiceNo] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [lines, setLines] = useState<DraftLine[]>([{ productId: products[0]?.id ?? "", qty: 1, unitCost: 0 }]);
  const [attachMode, setAttachMode] = useState<"file" | "camera" | "url">("file");
  const [attachmentUrl, setAttachmentUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const total = lines.reduce((s, l) => s + l.qty * l.unitCost, 0);

  function updateLine(idx: number, patch: Partial<DraftLine>) {
    setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
  }
  function addLine() {
    setLines((prev) => [...prev, { productId: products[0]?.id ?? "", qty: 1, unitCost: 0 }]);
  }
  function removeLine(idx: number) {
    setLines((prev) => prev.filter((_, i) => i !== idx));
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

      // Weighted-average cost: fold each line into its product before writing the purchase record.
      for (const line of lines) {
        const product = products.find((p) => p.id === line.productId);
        if (!product) continue;
        const newStock = product.stock + line.qty;
        const newAvgCost = (product.stock * product.avgCost + line.qty * line.unitCost) / newStock;
        await updateDoc(doc(db, "products", product.id), {
          stock: newStock,
          avgCost: newAvgCost,
          // eslint-disable-next-line react-hooks/purity -- Date.now() here runs inside an event handler, not render.
          updatedAt: Date.now(),
        });
      }

      await createPurchase({
        supplierId,
        supplierName: supplier.name,
        invoiceNo,
        date,
        items,
        total,
        attachmentUrl: attachmentUrl || undefined,
        status: "Unpaid",
      });
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
      title="Record purchase"
      onClose={onClose}
      footer={
        <>
          <span className="num" style={{ marginRight: "auto", fontWeight: 600 }}>
            Total: Rs {Math.round(total).toLocaleString()}
          </span>
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button className="btn primary" onClick={handleSave} disabled={saving}>
            {saving ? "Saving…" : "Save purchase"}
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
          <select value={l.productId} onChange={(e) => updateLine(idx, { productId: e.target.value })}>
            {products.length === 0 && <option value="">Add products first</option>}
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <input type="number" value={l.qty} onChange={(e) => updateLine(idx, { qty: Number(e.target.value) })} />
          <input
            type="number"
            value={l.unitCost}
            onChange={(e) => updateLine(idx, { unitCost: Number(e.target.value) })}
          />
          <input value={Math.round(l.qty * l.unitCost).toLocaleString()} readOnly />
          <button className="btn" style={{ padding: "4px 8px", fontSize: 12 }} onClick={() => removeLine(idx)}>
            ×
          </button>
        </div>
      ))}
      <button className="btn" style={{ margin: "4px 0 14px" }} onClick={addLine}>
        + Add line item
      </button>

      <label style={{ fontSize: 12, color: "var(--muted)", display: "block", marginBottom: 6 }}>Attach invoice</label>
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

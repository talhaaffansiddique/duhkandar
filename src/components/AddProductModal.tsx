import { useState } from "react";
import { uploadToCloudinary } from "../lib/cloudinary";
import { useShopAuditedWrites } from "../lib/firestore";
import Modal from "./Modal";
import type { Product, ProductVariant, WarrantyUnit } from "../types";

const CATEGORIES = ["Sanitary ware", "Fittings", "Other"];

export default function AddProductModal({
  onClose,
  existing,
}: {
  onClose: () => void;
  existing?: Product;
}) {
  const { create, update } = useShopAuditedWrites("products");
  const [name, setName] = useState(existing?.name ?? "");
  const [sku, setSku] = useState(existing?.sku ?? "");
  const [category, setCategory] = useState(existing?.category ?? CATEGORIES[0]);
  const [warrantyValue, setWarrantyValue] = useState(existing?.warrantyValue ?? 0);
  const [warrantyUnit, setWarrantyUnit] = useState<WarrantyUnit>(existing?.warrantyUnit ?? "Months");
  const [cost, setCost] = useState(existing?.avgCost ?? 0);
  const [price, setPrice] = useState(existing?.price ?? 0);
  const [stock, setStock] = useState(existing?.stock ?? 0);
  const [images, setImages] = useState<string[]>(existing?.images ?? []);
  const [variants, setVariants] = useState<ProductVariant[]>(existing?.variants ?? []);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  function addVariant() {
    setVariants((prev) => [...prev, { size: "", colour: "", stock: 0 }]);
  }
  function updateVariant(idx: number, patch: Partial<ProductVariant>) {
    setVariants((prev) => prev.map((v, i) => (i === idx ? { ...v, ...patch } : v)));
  }
  function removeVariant(idx: number) {
    setVariants((prev) => prev.filter((_, i) => i !== idx));
  }

  async function handleImagePick(idx: number, file: File) {
    setUploading(true);
    setErr(null);
    try {
      const url = await uploadToCloudinary(file);
      setImages((prev) => {
        const next = [...prev];
        next[idx] = url;
        return next;
      });
    } catch (e) {
      console.error(e);
      setErr(e instanceof Error ? e.message : "Image upload failed.");
    } finally {
      setUploading(false);
    }
  }

  async function handleSave() {
    if (!name.trim() || !sku.trim()) {
      setErr("Product name and SKU are required.");
      return;
    }
    setSaving(true);
    setErr(null);
    try {
      const cleanVariants = variants.filter((v) => v.size.trim() || v.colour.trim());
      const payload = {
        name: name.trim(),
        sku: sku.trim(),
        category,
        warrantyValue: Math.max(0, warrantyValue),
        warrantyUnit,
        avgCost: cost,
        price,
        stock,
        images,
        variants: cleanVariants,
      };
      if (existing) {
        await update(existing.id, payload);
      } else {
        await create(payload);
      }
      onClose();
    } catch (e) {
      console.error(e);
      setErr("Could not save product. Try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      title={existing ? "Edit product" : "Add product"}
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button className="btn primary" onClick={handleSave} disabled={saving || uploading}>
            {saving ? "Saving…" : "Save product"}
          </button>
        </>
      }
    >
      <div className="field-row">
        <div className="field">
          <label>Product name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Angle Valve — Brass" />
        </div>
        <div className="field">
          <label>SKU</label>
          <input value={sku} onChange={(e) => setSku(e.target.value)} placeholder="FIT-2311" />
        </div>
      </div>
      <div className="field-row">
        <div className="field">
          <label>Category</label>
          <select value={category} onChange={(e) => setCategory(e.target.value)}>
            {CATEGORIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Warranty</label>
          <div style={{ display: "flex", gap: 6 }}>
            <input
              type="number"
              min={0}
              value={warrantyValue || ""}
              onFocus={(e) => e.target.select()}
              onChange={(e) => setWarrantyValue(Math.max(0, Number(e.target.value)))}
              style={{ flex: 1 }}
            />
            <select value={warrantyUnit} onChange={(e) => setWarrantyUnit(e.target.value as WarrantyUnit)} style={{ flex: 1 }}>
              <option>Months</option>
              <option>Years</option>
            </select>
          </div>
        </div>
      </div>
      <div className="field-row">
        <div className="field">
          <label>Cost price</label>
          <input type="number" value={cost || ""} onFocus={(e) => e.target.select()} onChange={(e) => setCost(Number(e.target.value))} />
        </div>
        <div className="field">
          <label>Selling price</label>
          <input type="number" value={price || ""} onFocus={(e) => e.target.select()} onChange={(e) => setPrice(Number(e.target.value))} />
        </div>
        <div className="field">
          <label>{existing ? "Stock on hand" : "Opening stock"}</label>
          <input type="number" value={stock || ""} onFocus={(e) => e.target.select()} onChange={(e) => setStock(Number(e.target.value))} />
        </div>
      </div>

      <label style={{ fontSize: 12, color: "var(--muted)", display: "block", margin: "4px 0 6px" }}>
        Variants (size / colour) — optional
      </label>
      {variants.length > 0 && (
        <div className="variantrow" style={{ fontSize: 11, color: "var(--muted)" }}>
          <span>Size</span>
          <span>Colour</span>
          <span>Stock</span>
          <span />
        </div>
      )}
      {variants.map((v, idx) => (
        <div className="variantrow" key={idx}>
          <input value={v.size} onChange={(e) => updateVariant(idx, { size: e.target.value })} placeholder="600x600mm" />
          <input value={v.colour} onChange={(e) => updateVariant(idx, { colour: e.target.value })} placeholder="Beige" />
          <input
            type="number"
            value={v.stock || ""}
            onFocus={(e) => e.target.select()}
            onChange={(e) => updateVariant(idx, { stock: Math.max(0, Number(e.target.value)) })}
          />
          <button className="btn" style={{ padding: "4px 8px", fontSize: 12 }} onClick={() => removeVariant(idx)}>
            ×
          </button>
        </div>
      ))}
      <button className="btn" style={{ margin: "4px 0 14px" }} onClick={addVariant}>
        + Add variant
      </button>

      <label style={{ fontSize: 12, color: "var(--muted)", display: "block", marginBottom: 4 }}>
        Product images (up to 3)
      </label>
      <div className="imgrow">
        {[0, 1, 2].map((idx) => (
          <label className="imgslot" key={idx}>
            {images[idx] ? <img src={images[idx]} alt="" /> : `+ Photo ${idx + 1}`}
            <input
              type="file"
              accept="image/*"
              style={{ display: "none" }}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleImagePick(idx, file);
              }}
            />
          </label>
        ))}
      </div>
      {err && <p className="errortext">{err}</p>}
    </Modal>
  );
}

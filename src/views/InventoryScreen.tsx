import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useCollection, byCreatedDesc } from "../lib/firestore";
import type { Product } from "../types";
import AddProductModal from "../components/AddProductModal";

function money(n: number) {
  return Math.round(n).toLocaleString();
}
function stockStatus(p: Product): { label: string; cls: string } {
  if (p.stock <= 0) return { label: "Out of stock", cls: "bad" };
  if (p.stock <= 5) return { label: "Low stock", cls: "warn" };
  return { label: "In stock", cls: "good" };
}

export default function InventoryScreen() {
  const { data: products, loading } = useCollection<Product>("products", byCreatedDesc());
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Product | undefined>(undefined);

  const category = params.get("category") || "All categories";
  const categories = useMemo(() => ["All categories", ...new Set(products.map((p) => p.category))], [products]);

  const filtered = products.filter((p) => {
    const matchesCategory = category === "All categories" || p.category === category;
    const matchesSearch =
      !search || p.name.toLowerCase().includes(search.toLowerCase()) || p.sku.toLowerCase().includes(search.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <div>
      <div className="toolbar">
        <input
          className="input"
          style={{ flex: 1 }}
          placeholder="Search products or SKU"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className="input"
          value={category}
          onChange={(e) => {
            if (e.target.value === "All categories") setParams({});
            else setParams({ category: e.target.value });
          }}
        >
          {categories.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
        <button
          className="btn primary"
          onClick={() => {
            setEditing(undefined);
            setModalOpen(true);
          }}
        >
          + Add product
        </button>
      </div>
      <div className="card">
        {loading ? (
          <p style={{ fontSize: 12, color: "var(--muted)" }}>Loading…</p>
        ) : filtered.length === 0 ? (
          <p style={{ fontSize: 12, color: "var(--muted)" }}>
            No products yet. Click "+ Add product" to create your first item.
          </p>
        ) : (
          <table>
            <tbody>
              <tr>
                <th>Product</th>
                <th>SKU</th>
                <th className="num">Stock</th>
                <th className="num">Cost (avg)</th>
                <th className="num">Price</th>
                <th>Warranty</th>
                <th>Status</th>
              </tr>
              {filtered.map((p) => {
                const status = stockStatus(p);
                return (
                  <tr key={p.id} className="clickrow" onClick={() => { setEditing(p); setModalOpen(true); }}>
                    <td>
                      <span className="thumb">{p.images?.[0] ? <img src={p.images[0]} alt="" /> : "▦"}</span>
                      {p.name}
                    </td>
                    <td>{p.sku}</td>
                    <td className="num">{p.stock}</td>
                    <td className="num">{money(p.avgCost)}</td>
                    <td className="num">{money(p.price)}</td>
                    <td>{p.warrantyMonths > 0 ? `${p.warrantyMonths} mo` : "—"}</td>
                    <td>
                      <span className={"pill " + status.cls}>{status.label}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
        <div className="foot-note">
          <i /> Add/edit/delete on every product is logged with who and when for later audit export.
        </div>
      </div>
      {modalOpen && (
        <AddProductModal
          existing={editing}
          onClose={() => {
            setModalOpen(false);
            setEditing(undefined);
          }}
        />
      )}
    </div>
  );
}

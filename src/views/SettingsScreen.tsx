import { useEffect, useState } from "react";
import { doc, setDoc, onSnapshot, getDocs, deleteDoc, collection } from "firebase/firestore";
import { db, auth } from "../firebase/config";
import { useShopAuditedWrites } from "../lib/firestore";
import { useAuth } from "../context/AuthContext";
import { usePermissions } from "../lib/permissions";
import Modal from "../components/Modal";
import type { Shop } from "../types";

function Switch({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button className={"switch" + (on ? " on" : "")} onClick={onToggle} aria-label="Toggle">
      <i />
    </button>
  );
}

const SEED_COLLECTIONS = ["products", "purchases", "sales", "expenses", "suppliers"];

function buildSeedData() {
  const suppliers = Array.from({ length: 10 }, (_, i) => ({
    name: `Supplier ${i + 1} Traders`,
    contact: `03${(String(100000000 + i * 137)).slice(0, 9)}`,
    address: `Shop ${i + 1}, Sadar Market, Karachi`,
    outstanding: (i % 4) * 3500,
  }));
  const categories = ["Sanitary ware", "Fittings", "Other"];
  const products = Array.from({ length: 10 }, (_, i) => ({
    name: `Sample Product ${i + 1}`,
    sku: `SKU-${1000 + i}`,
    category: categories[i % categories.length],
    stock: 5 + i * 3,
    avgCost: 800 + i * 250,
    price: 1200 + i * 400,
    warrantyMonths: [0, 3, 6, 12][i % 4],
    images: [] as string[],
  }));
  return { suppliers, products };
}

export default function SettingsScreen() {
  const { isAdmin } = usePermissions();
  const { profile } = useAuth();

  const [shop, setShop] = useState<Shop | null>(null);
  const [shopLoading, setShopLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [seedMsg, setSeedMsg] = useState<string | null>(null);
  const [seeding, setSeeding] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [resetting, setResetting] = useState(false);

  const { create: seedProduct } = useShopAuditedWrites("products");
  const { create: seedSupplier } = useShopAuditedWrites("suppliers");
  const { create: seedPurchase } = useShopAuditedWrites("purchases");
  const { create: seedSale } = useShopAuditedWrites("sales");
  const { create: seedExpense } = useShopAuditedWrites("expenses");

  useEffect(() => {
    if (!profile?.shopId) return;
    const unsub = onSnapshot(doc(db, "shops", profile.shopId), (snap) => {
      if (snap.exists()) setShop({ id: snap.id, ...(snap.data() as Omit<Shop, "id">) });
      setShopLoading(false);
    });
    return unsub;
  }, [profile?.shopId]);

  async function save(patch: Partial<Shop>) {
    if (!profile?.shopId) return;
    const next = { ...shop, ...patch } as Shop;
    setShop(next);
    setSaving(true);
    try {
      await setDoc(doc(db, "shops", profile.shopId), patch, { merge: true });
    } finally {
      setSaving(false);
    }
  }

  async function seedSampleData() {
    if (!profile?.shopId || shop?.seeded) return;
    setSeeding(true);
    setSeedMsg("Seeding…");
    try {
      const { suppliers, products } = buildSeedData();
      const supplierRefs = [];
      for (const s of suppliers) supplierRefs.push(await seedSupplier(s));
      const productRefs = [];
      for (const p of products) productRefs.push(await seedProduct(p));

      for (let i = 0; i < 10; i++) {
        const product = products[i % products.length];
        const supplier = suppliers[i % suppliers.length];
        const qty = 3 + (i % 5);
        await seedPurchase({
          supplierId: supplierRefs[i % supplierRefs.length].id,
          supplierName: supplier.name,
          invoiceNo: `INV-${7000 + i}`,
          date: new Date(Date.now() - i * 86400000).toISOString().slice(0, 10),
          items: [{ productId: productRefs[i % productRefs.length].id, productName: product.name, qty, unitCost: product.avgCost }],
          total: qty * product.avgCost,
          status: (["Paid", "Partial", "Unpaid"] as const)[i % 3],
        });
      }

      for (let i = 0; i < 10; i++) {
        const product = products[(i + 2) % products.length];
        const qty = 1 + (i % 3);
        await seedSale({
          receiptNo: `RCP-${9000 + i}`,
          customer: i % 2 === 0 ? "Walk-in" : "Sample Hardware Co.",
          items: [{ productId: productRefs[(i + 2) % productRefs.length].id, productName: product.name, qty, unitPrice: product.price }],
          amount: qty * product.price,
          payment: i % 2 === 0 ? "Cash" : "Credit",
          status: i === 9 ? "Refunded" : "Paid",
          cashierName: profile.name,
        });
      }

      const expenseCategories = ["Rent", "Utilities", "Salaries", "Transport", "Miscellaneous"] as const;
      for (let i = 0; i < 10; i++) {
        await seedExpense({
          date: new Date(Date.now() - i * 86400000).toISOString().slice(0, 10),
          category: expenseCategories[i % expenseCategories.length],
          amount: 1500 + i * 400,
          note: `Sample expense ${i + 1}`,
          addedByName: profile.name,
        });
      }

      await save({ seeded: true });
      setSeedMsg("Added 10 sample records to Products, Purchases, Sales, Expenses, and Suppliers.");
    } catch (e) {
      console.error(e);
      setSeedMsg("Seeding failed — check console.");
    } finally {
      setSeeding(false);
    }
  }

  async function clearAllData() {
    if (!profile?.shopId) return;
    setResetting(true);
    try {
      for (const name of SEED_COLLECTIONS) {
        const path = `shops/${profile.shopId}/${name}`;
        const snap = await getDocs(collection(db, path));
        await Promise.all(snap.docs.map((d) => deleteDoc(doc(db, path, d.id))));
      }
      await save({ seeded: false });
      setSeedMsg("All shop data cleared.");
    } catch (e) {
      console.error(e);
      setSeedMsg("Reset failed — check console.");
    } finally {
      setResetting(false);
      setConfirmReset(false);
    }
  }

  return (
    <div className="settingswrap">
      <div className="card">
        <p className="sectitle">Company master</p>
        {shopLoading ? (
          <p style={{ fontSize: 12, color: "var(--muted)" }}>Loading…</p>
        ) : (
          <>
            <div className="field">
              <label>Business name</label>
              <input
                value={shop?.businessName ?? ""}
                onChange={(e) => setShop((s) => ({ ...(s as Shop), businessName: e.target.value }))}
                onBlur={() => save({ businessName: shop?.businessName ?? "" })}
                placeholder="Rafiq Sanitary Traders"
                disabled={!isAdmin}
              />
            </div>
            <div className="field">
              <label>Address</label>
              <input
                value={shop?.address ?? ""}
                onChange={(e) => setShop((s) => ({ ...(s as Shop), address: e.target.value }))}
                onBlur={() => save({ address: shop?.address ?? "" })}
                placeholder="Shop 14, Sadar Market, Karachi"
                disabled={!isAdmin}
              />
            </div>
            <div className="field">
              <label>Logo URL</label>
              <input
                value={shop?.logoUrl ?? ""}
                onChange={(e) => setShop((s) => ({ ...(s as Shop), logoUrl: e.target.value }))}
                onBlur={() => save({ logoUrl: shop?.logoUrl ?? "" })}
                placeholder="https://…"
                disabled={!isAdmin}
              />
            </div>
          </>
        )}
      </div>
      <div className="card">
        <p className="sectitle">App settings</p>
        <div className="rowline">
          Google Sign-In
          <span className="pill good">Enabled via Firebase</span>
        </div>
        <div className="rowline">
          Dark mode default
          <Switch on={!!shop?.darkModeDefault} onToggle={() => save({ darkModeDefault: !shop?.darkModeDefault })} />
        </div>
        <div className="rowline">
          Show subcategories
          <Switch
            on={shop?.showSubcategories ?? true}
            onToggle={() => save({ showSubcategories: !(shop?.showSubcategories ?? true) })}
          />
        </div>
        <div className="rowline">
          Print receipt after sale
          <Switch
            on={shop?.printReceiptAfterSale ?? true}
            onToggle={() => save({ printReceiptAfterSale: !(shop?.printReceiptAfterSale ?? true) })}
          />
        </div>
        <div className="field" style={{ marginTop: 12 }}>
          <label>Signed in as</label>
          <input value={profile?.email ?? auth.currentUser?.email ?? ""} readOnly />
        </div>
        {isAdmin && (
          <>
            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
              <button className="btn" onClick={seedSampleData} disabled={seeding || !!shop?.seeded}>
                {shop?.seeded ? "Sample data already seeded" : seeding ? "Seeding…" : "Seed sample data"}
              </button>
              <button className="btn danger" onClick={() => setConfirmReset(true)}>
                Clear all data
              </button>
            </div>
            {seedMsg && <p style={{ fontSize: 12, color: "var(--muted)", marginTop: 6 }}>{seedMsg}</p>}
          </>
        )}
        {saving && <p style={{ fontSize: 11, color: "var(--muted)", marginTop: 8 }}>Saving…</p>}
      </div>

      {confirmReset && (
        <Modal
          title="Clear all shop data?"
          onClose={() => setConfirmReset(false)}
          footer={
            <>
              <button className="btn" onClick={() => setConfirmReset(false)} disabled={resetting}>
                Cancel
              </button>
              <button className="btn danger" style={{ background: "var(--bad)", color: "#fff" }} onClick={clearAllData} disabled={resetting}>
                {resetting ? "Clearing…" : "Yes, delete everything"}
              </button>
            </>
          }
        >
          <p style={{ fontSize: 13, color: "var(--ink)" }}>
            This permanently deletes every <strong>product, purchase, sale, expense, and supplier</strong> for this
            shop. Users, roles, and settings are kept. This can't be undone.
          </p>
        </Modal>
      )}
    </div>
  );
}

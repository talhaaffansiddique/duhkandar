import { useEffect, useState } from "react";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db, auth } from "../firebase/config";
import { useAuditedWrites } from "../lib/firestore";
import { useAuth } from "../context/AuthContext";
import { usePermissions } from "../lib/permissions";

interface CompanySettings {
  businessName: string;
  address: string;
  logoUrl: string;
  darkModeDefault: boolean;
  showSubcategories: boolean;
  printReceiptAfterSale: boolean;
}

const DEFAULTS: CompanySettings = {
  businessName: "",
  address: "",
  logoUrl: "",
  darkModeDefault: false,
  showSubcategories: true,
  printReceiptAfterSale: true,
};

function Switch({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button className={"switch" + (on ? " on" : "")} onClick={onToggle} aria-label="Toggle">
      <i />
    </button>
  );
}

export default function SettingsScreen() {
  const { isAdmin } = usePermissions();
  const { profile } = useAuth();
  const [settings, setSettings] = useState<CompanySettings>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [seedMsg, setSeedMsg] = useState<string | null>(null);
  const { create: seedProduct } = useAuditedWrites("products");
  const { create: seedSupplier } = useAuditedWrites("suppliers");

  useEffect(() => {
    getDoc(doc(db, "settings", "company")).then((snap) => {
      if (snap.exists()) setSettings({ ...DEFAULTS, ...(snap.data() as CompanySettings) });
      setLoading(false);
    });
  }, []);

  async function save(patch: Partial<CompanySettings>) {
    const next = { ...settings, ...patch };
    setSettings(next);
    setSaving(true);
    try {
      await setDoc(doc(db, "settings", "company"), next, { merge: true });
    } finally {
      setSaving(false);
    }
  }

  async function seedSampleData() {
    setSeedMsg("Seeding…");
    try {
      const products = [
        { name: "Commode — Ivory 1pc", sku: "SAN-1042", category: "Sanitary ware", stock: 14, avgCost: 4200, price: 6500, warrantyMonths: 12, images: [] },
        { name: "Basin Mixer Tap", sku: "FIT-2210", category: "Fittings", stock: 3, avgCost: 1850, price: 2950, warrantyMonths: 6, images: [] },
        { name: "Shower Head — Rain", sku: "SAN-1180", category: "Sanitary ware", stock: 22, avgCost: 1100, price: 1800, warrantyMonths: 3, images: [] },
      ];
      for (const p of products) await seedProduct(p);
      const suppliers = [
        { name: "Rafiq Sanitary Supplies", contact: "0300-5551234", address: "Site Area, Karachi", outstanding: 18300 },
        { name: "Al-Karam Traders", contact: "0321-7789001", address: "Bolton Market, Karachi", outstanding: 4500 },
      ];
      for (const s of suppliers) await seedSupplier(s);
      setSeedMsg("Sample products and suppliers added.");
    } catch (e) {
      console.error(e);
      setSeedMsg("Seeding failed — check console.");
    }
  }

  return (
    <div className="settingswrap">
      <div className="card">
        <p className="sectitle">Company master</p>
        {loading ? (
          <p style={{ fontSize: 12, color: "var(--muted)" }}>Loading…</p>
        ) : (
          <>
            <div className="field">
              <label>Business name</label>
              <input
                value={settings.businessName}
                onChange={(e) => setSettings((s) => ({ ...s, businessName: e.target.value }))}
                onBlur={() => save({ businessName: settings.businessName })}
                placeholder="Rafiq Sanitary Traders"
                disabled={!isAdmin}
              />
            </div>
            <div className="field">
              <label>Address</label>
              <input
                value={settings.address}
                onChange={(e) => setSettings((s) => ({ ...s, address: e.target.value }))}
                onBlur={() => save({ address: settings.address })}
                placeholder="Shop 14, Sadar Market, Karachi"
                disabled={!isAdmin}
              />
            </div>
            <div className="field">
              <label>Logo URL</label>
              <input
                value={settings.logoUrl}
                onChange={(e) => setSettings((s) => ({ ...s, logoUrl: e.target.value }))}
                onBlur={() => save({ logoUrl: settings.logoUrl })}
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
          <Switch on={settings.darkModeDefault} onToggle={() => save({ darkModeDefault: !settings.darkModeDefault })} />
        </div>
        <div className="rowline">
          Show subcategories
          <Switch on={settings.showSubcategories} onToggle={() => save({ showSubcategories: !settings.showSubcategories })} />
        </div>
        <div className="rowline">
          Print receipt after sale
          <Switch
            on={settings.printReceiptAfterSale}
            onToggle={() => save({ printReceiptAfterSale: !settings.printReceiptAfterSale })}
          />
        </div>
        <div className="field" style={{ marginTop: 12 }}>
          <label>Signed in as</label>
          <input value={profile?.email ?? auth.currentUser?.email ?? ""} readOnly />
        </div>
        {isAdmin && (
          <>
            <button className="btn" style={{ marginTop: 8 }} onClick={seedSampleData}>
              Seed sample data
            </button>
            {seedMsg && <p style={{ fontSize: 12, color: "var(--muted)", marginTop: 6 }}>{seedMsg}</p>}
          </>
        )}
        {saving && <p style={{ fontSize: 11, color: "var(--muted)", marginTop: 8 }}>Saving…</p>}
      </div>
    </div>
  );
}

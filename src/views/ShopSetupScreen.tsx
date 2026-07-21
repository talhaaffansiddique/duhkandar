import { useState, type FormEvent } from "react";
import { useAuth } from "../context/AuthContext";

export default function ShopSetupScreen() {
  const { completeShopSetup, error, firebaseUser } = useAuth();
  const [shopName, setShopName] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await completeShopSetup(shopName);
    } catch {
      // error is already surfaced via context
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="authwrap">
      <div className="authcard">
        <h2>Name your shop</h2>
        <p className="sub">
          {firebaseUser?.email} is new here — set up a shop and you'll be its Admin, with your own separate
          products, sales, and reports.
        </p>
        <form onSubmit={handleSubmit}>
          <div className="field">
            <label>Shop name</label>
            <input
              value={shopName}
              onChange={(e) => setShopName(e.target.value)}
              placeholder="Rafiq Sanitary Traders"
              required
              autoFocus
            />
          </div>
          {error && <p className="errortext">{error}</p>}
          <button className="btn primary" type="submit" style={{ width: "100%", padding: "10px" }} disabled={busy}>
            {busy ? "Creating shop…" : "Create shop"}
          </button>
        </form>
      </div>
    </div>
  );
}

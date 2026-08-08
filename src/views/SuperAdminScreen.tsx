import { useMemo, useState } from "react";
import { sendPasswordResetEmail } from "firebase/auth";
import { auth } from "../firebase/config";
import { useAuth } from "../context/AuthContext";
import { useIsSuperAdmin, useAllShops, useAllUsers } from "../lib/superAdmin";

function StoresTab({ onViewUsers }: { onViewUsers: (storeName: string) => void }) {
  const { shops, loading } = useAllShops();
  const { users } = useAllUsers();

  const userCountByShop = useMemo(() => {
    const counts: Record<string, number> = {};
    users.forEach((u) => {
      counts[u.shopId] = (counts[u.shopId] || 0) + 1;
    });
    return counts;
  }, [users]);

  return (
    <div className="card">
      {loading ? (
        <p style={{ fontSize: 12, color: "var(--muted)" }}>Loading…</p>
      ) : shops.length === 0 ? (
        <p style={{ fontSize: 12, color: "var(--muted)" }}>No shops created yet.</p>
      ) : (
        <table>
          <tbody>
            <tr>
              <th>Store</th>
              <th>Owner (uid)</th>
              <th className="num">Users</th>
              <th>Created</th>
            </tr>
            {shops.map((s) => (
              <tr key={s.id} className="clickrow" onClick={() => onViewUsers(s.businessName || s.name)}>
                <td>{s.businessName || s.name}</td>
                <td>{s.ownerUid}</td>
                <td className="num">{userCountByShop[s.id] || 0}</td>
                <td>{new Date(s.createdAt).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <div className="foot-note">
        <i /> Click a store to filter its users below.
      </div>
    </div>
  );
}

function UsersTab({ storeFilter, setStoreFilter }: { storeFilter: string; setStoreFilter: (v: string) => void }) {
  const { users, loading } = useAllUsers();
  const { shops } = useAllShops();
  const [resetTarget, setResetTarget] = useState<{ email: string; storeName: string } | null>(null);
  const [resetMsg, setResetMsg] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const shopNameById = useMemo(() => {
    const map: Record<string, string> = {};
    shops.forEach((s) => (map[s.id] = s.businessName || s.name));
    return map;
  }, [shops]);

  const filtered = users.filter((u) => storeFilter === "All stores" || shopNameById[u.shopId] === storeFilter);

  async function sendReset() {
    if (!resetTarget) return;
    setSending(true);
    setResetMsg(null);
    try {
      await sendPasswordResetEmail(auth, resetTarget.email);
      setResetMsg(`Password reset email sent to ${resetTarget.email}.`);
    } catch (e) {
      console.error(e);
      setResetMsg("Could not send reset email. Check the address and try again.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div>
      <div className="toolbar">
        <select className="input" value={storeFilter} onChange={(e) => setStoreFilter(e.target.value)}>
          <option>All stores</option>
          {shops.map((s) => (
            <option key={s.id}>{s.businessName || s.name}</option>
          ))}
        </select>
      </div>
      <div className="card">
        {loading ? (
          <p style={{ fontSize: 12, color: "var(--muted)" }}>Loading…</p>
        ) : filtered.length === 0 ? (
          <p style={{ fontSize: 12, color: "var(--muted)" }}>No users match.</p>
        ) : (
          <table>
            <tbody>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Store</th>
                <th>Access</th>
                <th>Status</th>
                <th></th>
              </tr>
              {filtered.map((u) => (
                <tr key={u.id}>
                  <td>{u.name}</td>
                  <td>{u.email}</td>
                  <td>{shopNameById[u.shopId] || "—"}</td>
                  <td>
                    <span className={"pill " + (u.access === "Admin" ? "good" : "neutral")}>{u.access}</span>
                  </td>
                  <td>
                    <span className={"pill " + (u.status === "Active" ? "good" : "warn")}>{u.status}</span>
                  </td>
                  <td>
                    <button
                      className="btn"
                      style={{ padding: "4px 10px", fontSize: 12 }}
                      onClick={() => {
                        setResetTarget({ email: u.email, storeName: shopNameById[u.shopId] || "" });
                        setResetMsg(null);
                      }}
                    >
                      Reset password
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <div className="foot-note">
          <i /> Sends the user a real Firebase password-reset email — no plaintext passwords ever touch this screen.
        </div>
      </div>

      {resetTarget && (
        <div className="overlay open">
          <div className="modal">
            <div className="modal-head">
              <h3>Reset password</h3>
              <button className="modal-close" onClick={() => setResetTarget(null)}>
                &times;
              </button>
            </div>
            <p style={{ fontSize: 13, color: "var(--muted)", margin: "-6px 0 14px" }}>
              {resetTarget.email} · {resetTarget.storeName}
            </p>
            <p style={{ fontSize: 13 }}>This sends a password-reset link to the user's email address.</p>
            {resetMsg && <p style={{ fontSize: 12, color: "var(--good)" }}>{resetMsg}</p>}
            <div className="modal-foot">
              <button className="btn" onClick={() => setResetTarget(null)}>
                Close
              </button>
              <button className="btn primary" onClick={sendReset} disabled={sending}>
                {sending ? "Sending…" : "Send password reset email"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Maintained by hand, one entry per shipped release — append a new entry
// here (newest first) every time a change goes out, so the app's full
// history stays visible to the app owner without digging through git.
const CHANGELOG: { date: string; title: string; points: string[] }[] = [
  {
    date: "7 Aug 2026",
    title: "Activity Tracker + this Changelog screen",
    points: [
      "New Master → Activity tab (per shop, Admin-only): every sign-in, sign-out, and screen visit, filterable by one or more users and one or more screens.",
      "New Super Admin → Changelog tab (this one) so every future update is recorded in one place, visible only here.",
    ],
  },
  {
    date: "7 Aug 2026",
    title: "Column sorting everywhere, POS grid/list toggle",
    points: [
      "POS → Sell: list-view alternative to the product grid with a toggle, every column sortable.",
      "Inventory and Purchases: every column sortable. Expense log: only Date. Master → Users: only Name and Email. Master → Suppliers: only Supplier and Outstanding.",
    ],
  },
  {
    date: "7 Aug 2026",
    title: "Sidebar polish + real supplier balances",
    points: [
      "Dukandar logo links back to Dashboard (or the user's first available screen).",
      "Sidebar shows the signed-in user's name above their email.",
      "Master → Suppliers “Outstanding” is now computed live from real purchases and payments instead of static seed data.",
    ],
  },
  {
    date: "7 Aug 2026",
    title: "Settings permission + access-control gap closed",
    points: [
      "Added a seventh permission — Settings — to Roles & permissions, so it's gated like every other module.",
      "Fixed Dashboard, POS, Inventory, Expense, and Reports being reachable by every signed-in user regardless of role — only Purchases and Master were actually enforcing permissions before this.",
    ],
  },
  {
    date: "7 Aug 2026",
    title: "Master → Users: Active/Inactive/Delete, POS transactions, Purchases fixes",
    points: [
      "Admin-only edit, deactivate, and soft-delete per user row; deleted/inactive users keep all history, tagged “(ex)” / “(inactive)”.",
      "New POS → Transactions tab: every sale, filterable, Admin-only edit. Checkout preview redesigned into a proper invoice.",
      "Purchases: fixed a payment-amount overflow bug; split into read-only Items/Invoice popups; fixed two hidden bugs where a form field could silently save empty if opened before its data finished loading.",
    ],
  },
  {
    date: "6 Aug 2026",
    title: "Dashboard drill-downs, Receivable/Payable reporting, purchase ledger",
    points: [
      "Dashboard KPI cards became real links into filtered Reports/Purchases views.",
      "Purchases gained a full payment ledger — total, paid so far, remaining, a log of who paid what and when.",
    ],
  },
  {
    date: "28 Jul 2026",
    title: "v2 feature set — POS, product variants, Super Admin, mobile layout",
    points: [
      "New POS screen with cart, receipt numbering, and atomic stock decrement.",
      "Inventory: warranty value + unit, product size/colour variants.",
      "This Super Admin panel introduced; mobile-responsive layout across the app.",
    ],
  },
  {
    date: "21 Jul 2026",
    title: "Multi-tenant shop isolation",
    points: ["Every shop's data fully separated under shops/{shopId}/…; guarded sample-data seeding and reset."],
  },
  {
    date: "21 Jul 2026",
    title: "Initial rebuild",
    points: ["Dukandar rebuilt as a real app: Firebase auth, Firestore, role-based security rules, Cloudinary photo uploads."],
  },
];

function ChangelogTab() {
  return (
    <div>
      <p style={{ color: "#8FA69B", fontSize: 12, margin: "0 0 18px" }}>
        Every update shipped to Dukandar, newest first. Visible only here — shop owners and their staff never see
        this screen.
      </p>
      {CHANGELOG.map((entry, i) => (
        <div
          key={i}
          style={{
            borderLeft: "2px solid #24312B",
            paddingLeft: 16,
            marginBottom: 22,
            position: "relative",
          }}
        >
          <div
            style={{
              position: "absolute",
              left: -5,
              top: 4,
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: "var(--accent)",
            }}
          />
          <p style={{ color: "#8FA69B", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.04em", margin: "0 0 4px" }}>
            {entry.date}
          </p>
          <p style={{ fontFamily: "var(--serif)", fontSize: 16, margin: "0 0 8px", color: "#fff" }}>{entry.title}</p>
          <ul style={{ margin: 0, paddingLeft: 18, color: "#C7D6CD", fontSize: 13, lineHeight: 1.6 }}>
            {entry.points.map((p, j) => (
              <li key={j}>{p}</li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

function OverviewTab() {
  const { shops, loading: shopsLoading } = useAllShops();
  const { users, loading: usersLoading } = useAllUsers();
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const newThisMonth = shops.filter((s) => {
    const d = new Date(s.createdAt);
    const now = new Date();
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).length;

  return (
    <div>
      <div className="grid g3" style={{ marginBottom: 16 }}>
        <div className="card kpi">
          <div className="label">Total stores</div>
          <div className="value">{shopsLoading ? "…" : shops.length}</div>
          <div className="delta up">▲ {newThisMonth} this month</div>
        </div>
        <div className="card kpi">
          <div className="label">Total users</div>
          <div className="value">{usersLoading ? "…" : users.length}</div>
          <div className="delta">across all stores</div>
        </div>
        <div className="card kpi">
          <div className="label">Active users</div>
          <div className="value">{usersLoading ? "…" : users.filter((u) => u.status === "Active").length}</div>
        </div>
      </div>
    </div>
  );
}

export default function SuperAdminScreen() {
  const { profile, signOut } = useAuth();
  const isSuperAdmin = useIsSuperAdmin();
  const [tab, setTab] = useState<"overview" | "stores" | "users" | "changelog">("overview");
  const [storeFilter, setStoreFilter] = useState("All stores");

  if (isSuperAdmin === null) {
    return <div className="center-fill">Checking access…</div>;
  }
  if (!isSuperAdmin) {
    return (
      <div className="center-fill" style={{ flexDirection: "column", gap: 10 }}>
        <p>This area is restricted to the app owner.</p>
        <button className="btn" onClick={() => signOut()}>
          Sign out
        </button>
      </div>
    );
  }

  return (
    <div style={{ background: "#0F1613", minHeight: "100vh", color: "#EAF1EC" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "16px 26px",
          borderBottom: "1px solid #24312B",
          flexWrap: "wrap",
          gap: 10,
        }}
      >
        <div>
          <span style={{ fontFamily: "var(--serif)", fontSize: 19, fontWeight: 700 }}>
            Dukandar
            <span
              style={{
                background: "var(--bad)",
                color: "#fff",
                fontSize: 10,
                padding: "2px 7px",
                borderRadius: 5,
                marginLeft: 8,
              }}
            >
              SUPER ADMIN
            </span>
          </span>
          <p style={{ color: "#8FA69B", fontSize: 12, margin: "2px 0 0" }}>Signed in as {profile?.email}</p>
        </div>
        <button className="btn" onClick={() => signOut()}>
          Sign out
        </button>
      </div>
      <div style={{ display: "flex", gap: 4, padding: "0 26px", borderBottom: "1px solid #24312B" }}>
        {(["overview", "stores", "users", "changelog"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              border: "none",
              background: "transparent",
              color: tab === t ? "#fff" : "#8FA69B",
              padding: "12px 14px",
              fontSize: 13,
              cursor: "pointer",
              borderBottom: tab === t ? "2px solid var(--accent)" : "2px solid transparent",
            }}
          >
            {t[0].toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>
      <div style={{ padding: "20px 26px 50px" }}>
        {tab === "overview" && <OverviewTab />}
        {tab === "stores" && (
          <StoresTab
            onViewUsers={(name) => {
              setStoreFilter(name);
              setTab("users");
            }}
          />
        )}
        {tab === "users" && <UsersTab storeFilter={storeFilter} setStoreFilter={setStoreFilter} />}
        {tab === "changelog" && <ChangelogTab />}
      </div>
    </div>
  );
}

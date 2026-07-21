import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { doc, setDoc } from "firebase/firestore";
import { db } from "../firebase/config";
import { useShopCollection, useShopAuditedWrites, useShopUsers, byCreatedDesc } from "../lib/firestore";
import { useAuth } from "../context/AuthContext";
import { NO_PERMISSIONS, ALL_PERMISSIONS_ON } from "../lib/permissions";
import { PERMISSION_KEYS } from "../types";
import type { UserProfile, Supplier, Role, PermissionSet } from "../types";

const PERMISSION_LABELS: Record<string, string> = {
  viewDashboard: "View dashboard",
  recordSales: "Record sales",
  manageInventory: "Manage inventory",
  recordPurchases: "Record purchases",
  viewReports: "View reports",
  addExpenses: "Add expenses",
};

function money(n: number) {
  return "Rs " + Math.round(n).toLocaleString();
}

function UsersTab() {
  const { data: users, loading } = useShopUsers();
  const { data: roles } = useShopCollection<Role>("roles");
  const { profile } = useAuth();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [access, setAccess] = useState<"Employee" | "Admin">("Employee");
  const [roleId, setRoleId] = useState(roles[0]?.id ?? "");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function handleCreate() {
    if (!name.trim() || !email.trim()) {
      setErr("Name and email are required.");
      return;
    }
    if (!profile?.shopId) {
      setErr("No shop selected yet.");
      return;
    }
    setSaving(true);
    setErr(null);
    try {
      const key = email.trim().toLowerCase();
      await setDoc(doc(db, "users", key), {
        name: name.trim(),
        email: key,
        access,
        roleId: access === "Employee" ? roleId : null,
        status: "Invited",
        shopId: profile.shopId,
        createdAt: Date.now(),
        createdBy: profile?.name || "Admin",
      });
      setName("");
      setEmail("");
    } catch (e) {
      console.error(e);
      setErr("Could not create user. Try again.");
    } finally {
      setSaving(false);
    }
  }

  function roleName(u: UserProfile) {
    if (u.access === "Admin") return "Full rights";
    return roles.find((r) => r.id === u.roleId)?.name ?? "No profile assigned";
  }

  return (
    <div>
      <div className="card">
        {loading ? (
          <p style={{ fontSize: 12, color: "var(--muted)" }}>Loading…</p>
        ) : users.length === 0 ? (
          <p style={{ fontSize: 12, color: "var(--muted)" }}>No users yet.</p>
        ) : (
          <table>
            <tbody>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Access</th>
                <th>Profile</th>
                <th>Status</th>
                <th>Added</th>
              </tr>
              {users.map((u) => (
                <tr key={u.id}>
                  <td>{u.name}</td>
                  <td>{u.email}</td>
                  <td>
                    <span className={"pill " + (u.access === "Admin" ? "good" : "neutral")}>{u.access}</span>
                  </td>
                  <td>{roleName(u)}</td>
                  <td>
                    <span className={"pill " + (u.status === "Active" ? "good" : u.status === "Invited" ? "warn" : "neutral")}>
                      {u.status}
                    </span>
                  </td>
                  <td>{new Date(u.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <div className="foot-note">
          <i /> Admin always has complete rights; every other user must carry a profile from Roles &amp; permissions.
        </div>
      </div>
      <div className="card" style={{ marginTop: 14 }}>
        <p className="sectitle">New user</p>
        <div className="field-row">
          <div className="field">
            <label>Full name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Bilal Sheikh" />
          </div>
          <div className="field">
            <label>Email</label>
            <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="bilal@yourshop.pk" />
          </div>
        </div>
        <div className="field-row">
          <div className="field">
            <label>Access level</label>
            <select value={access} onChange={(e) => setAccess(e.target.value as "Employee" | "Admin")}>
              <option>Employee</option>
              <option>Admin</option>
            </select>
          </div>
          <div className="field">
            <label>Profile (employee only)</label>
            <select value={roleId} onChange={(e) => setRoleId(e.target.value)} disabled={access === "Admin"}>
              {roles.length === 0 && <option value="">Create a role first</option>}
              {roles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        {err && <p className="errortext">{err}</p>}
        <button className="btn primary" onClick={handleCreate} disabled={saving}>
          {saving ? "Creating…" : "Create user"}
        </button>
        <p style={{ fontSize: 11, color: "var(--muted)", marginTop: 10 }}>
          The user signs in themselves (email/password or Google) using this exact email — their account is
          automatically matched to this profile on first login.
        </p>
      </div>
    </div>
  );
}

function SuppliersTab() {
  const { data: suppliers, loading } = useShopCollection<Supplier>("suppliers", byCreatedDesc());
  const { create } = useShopAuditedWrites("suppliers");
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [address, setAddress] = useState("");
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);

  async function handleCreate() {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await create({ name: name.trim(), contact: contact.trim(), address: address.trim(), outstanding: 0 });
      setName("");
      setContact("");
      setAddress("");
      setShowForm(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="toolbar">
        <button className="btn primary" onClick={() => setShowForm((v) => !v)}>
          + Add supplier
        </button>
      </div>
      {showForm && (
        <div className="card" style={{ marginBottom: 14 }}>
          <div className="field-row">
            <div className="field">
              <label>Supplier name</label>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Rafiq Sanitary Supplies" />
            </div>
            <div className="field">
              <label>Contact</label>
              <input value={contact} onChange={(e) => setContact(e.target.value)} placeholder="0300-5551234" />
            </div>
          </div>
          <div className="field">
            <label>Address</label>
            <input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Site Area, Karachi" />
          </div>
          <button className="btn primary" onClick={handleCreate} disabled={saving}>
            {saving ? "Saving…" : "Save supplier"}
          </button>
        </div>
      )}
      <div className="card">
        {loading ? (
          <p style={{ fontSize: 12, color: "var(--muted)" }}>Loading…</p>
        ) : suppliers.length === 0 ? (
          <p style={{ fontSize: 12, color: "var(--muted)" }}>No suppliers yet.</p>
        ) : (
          <table>
            <tbody>
              <tr>
                <th>Supplier</th>
                <th>Contact</th>
                <th>Address</th>
                <th className="num">Outstanding</th>
                <th>Added</th>
              </tr>
              {suppliers.map((s) => (
                <tr key={s.id}>
                  <td>{s.name}</td>
                  <td>{s.contact || "—"}</td>
                  <td>{s.address || "—"}</td>
                  <td className="num">{money(s.outstanding)}</td>
                  <td>{new Date(s.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <div className="foot-note">
          <i /> Suppliers added here appear immediately in the Purchases screen.
        </div>
      </div>
    </div>
  );
}

function RolesTab() {
  const { data: roles, loading } = useShopCollection<Role>("roles", byCreatedDesc());
  const { create, update } = useShopAuditedWrites("roles");
  const [showForm, setShowForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPerms, setNewPerms] = useState<PermissionSet>({ ...NO_PERMISSIONS });
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editPerms, setEditPerms] = useState<PermissionSet>({ ...NO_PERMISSIONS });

  async function handleCreate() {
    if (!newName.trim()) return;
    setSaving(true);
    try {
      await create({ name: newName.trim(), permissions: newPerms });
      setNewName("");
      setNewPerms({ ...NO_PERMISSIONS });
      setShowForm(false);
    } finally {
      setSaving(false);
    }
  }

  function startEdit(role: Role) {
    setEditingId(role.id);
    setEditPerms(role.permissions);
  }
  async function saveEdit(roleId: string) {
    await update(roleId, { permissions: editPerms });
    setEditingId(null);
  }

  return (
    <div>
      <div className="toolbar">
        <button className="btn primary" onClick={() => setShowForm((v) => !v)}>
          + New role
        </button>
      </div>
      {showForm && (
        <div className="card" style={{ marginBottom: 12 }}>
          <div className="field">
            <label>Profile name</label>
            <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Cashier" />
          </div>
          <div className="perm">
            {PERMISSION_KEYS.map((k) => (
              <label key={k}>
                <input
                  type="checkbox"
                  checked={newPerms[k]}
                  onChange={(e) => setNewPerms((p) => ({ ...p, [k]: e.target.checked }))}
                />
                {PERMISSION_LABELS[k]}
              </label>
            ))}
          </div>
          <button className="btn primary" style={{ marginTop: 12 }} onClick={handleCreate} disabled={saving}>
            {saving ? "Saving…" : "Save role"}
          </button>
        </div>
      )}

      <div className="card" style={{ marginBottom: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <strong>Admin</strong>
          <span className="pill good">Fixed — full access</span>
        </div>
        <p style={{ color: "var(--muted)", fontSize: 12, margin: "6px 0 0" }}>
          Cannot be edited. Every module, every action, always.
        </p>
        <div className="perm">
          {PERMISSION_KEYS.map((k) => (
            <label key={k}>
              <input type="checkbox" checked={ALL_PERMISSIONS_ON[k]} disabled />
              {PERMISSION_LABELS[k]}
            </label>
          ))}
        </div>
      </div>

      {loading ? (
        <p style={{ fontSize: 12, color: "var(--muted)" }}>Loading…</p>
      ) : (
        roles.map((role) => (
          <div className="card" style={{ marginBottom: 12 }} key={role.id}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <strong>{role.name}</strong>
              {editingId === role.id ? (
                <button className="btn primary" style={{ padding: "4px 10px", fontSize: 12 }} onClick={() => saveEdit(role.id)}>
                  Save
                </button>
              ) : (
                <button className="btn" style={{ padding: "4px 10px", fontSize: 12 }} onClick={() => startEdit(role)}>
                  Edit
                </button>
              )}
            </div>
            <div className="perm">
              {PERMISSION_KEYS.map((k) => (
                <label key={k}>
                  <input
                    type="checkbox"
                    checked={editingId === role.id ? editPerms[k] : role.permissions[k]}
                    disabled={editingId !== role.id}
                    onChange={(e) => setEditPerms((p) => ({ ...p, [k]: e.target.checked }))}
                  />
                  {PERMISSION_LABELS[k]}
                </label>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}

export default function MasterScreen() {
  const [params, setParams] = useSearchParams();
  const sub = params.get("sub") || "users";

  return (
    <div>
      <div className="tabs2">
        {(["users", "suppliers", "roles"] as const).map((t) => (
          <button key={t} className={"tab2" + (sub === t ? " on" : "")} onClick={() => setParams({ sub: t })}>
            {t === "users" ? "Users" : t === "suppliers" ? "Suppliers" : "Roles & permissions"}
          </button>
        ))}
      </div>
      {sub === "users" && <UsersTab />}
      {sub === "suppliers" && <SuppliersTab />}
      {sub === "roles" && <RolesTab />}
    </div>
  );
}

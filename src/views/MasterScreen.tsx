import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { doc, setDoc, updateDoc } from "firebase/firestore";
import { sendPasswordResetEmail } from "firebase/auth";
import { db, auth } from "../firebase/config";
import { useShopCollection, useShopAuditedWrites, useShopUsers, useShopActivityLog, byCreatedDesc } from "../lib/firestore";
import { useAuth } from "../context/AuthContext";
import { usePermissions, NO_PERMISSIONS, ALL_PERMISSIONS_ON } from "../lib/permissions";
import { createEmployeeAuthAccount, generatePassword, likelyHasGoogleAccount } from "../lib/adminCreateUser";
import { useSortableRows } from "../hooks/useSortableRows";
import SortHeader from "../components/SortHeader";
import { logActivity } from "../lib/activityLog";
import { PERMISSION_KEYS } from "../types";
import type { UserProfile, Supplier, Role, PermissionSet, Purchase, ActivityLogEntry } from "../types";
import { nameWithStatus, purchasePaidTotal } from "../types";
import Modal from "../components/Modal";

const PERMISSION_LABELS: Record<string, string> = {
  viewDashboard: "View dashboard",
  recordSales: "Record sales",
  manageInventory: "Manage inventory",
  recordPurchases: "Record purchases",
  viewReports: "View reports",
  addExpenses: "Add expenses",
  manageSettings: "Settings",
};

const ACTIVITY_MODULES = ["POS", "Inventory", "Purchases", "Expense", "Master"];

function activityDescription(e: ActivityLogEntry): string {
  if (e.type === "login") return "Signed in";
  if (e.type === "logout") return "Signed out";
  return e.description || "—";
}

function money(n: number) {
  return "Rs " + Math.round(n).toLocaleString();
}

function UsersTab() {
  const { data: users, loading } = useShopUsers();
  const { data: roles } = useShopCollection<Role>("roles");
  const { profile } = useAuth();
  const { isAdmin } = usePermissions();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState(() => generatePassword());
  const [showPassword, setShowPassword] = useState(false);
  const [access, setAccess] = useState<"Employee" | "Admin">("Employee");
  const [roleId, setRoleId] = useState(roles[0]?.id ?? "");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [resetMsg, setResetMsg] = useState<string | null>(null);

  // Roles may still be loading from Firestore when this component first
  // mounts, so the initial useState default above can land on "" — backfill
  // it once the list actually arrives instead of leaving roleId stuck empty.
  useEffect(() => {
    if (!roleId && roles[0]) setRoleId(roles[0].id);
  }, [roleId, roles]);

  const [editUser, setEditUser] = useState<UserProfile | null>(null);
  const [editEmail, setEditEmail] = useState("");
  const [editAccess, setEditAccess] = useState<"Employee" | "Admin">("Employee");
  const [editRoleId, setEditRoleId] = useState("");
  const [editStatus, setEditStatus] = useState<"Active" | "Inactive">("Active");
  const [editCreatedAt, setEditCreatedAt] = useState("");
  const [editSaving, setEditSaving] = useState(false);
  const [editErr, setEditErr] = useState<string | null>(null);
  const [deleteUser, setDeleteUser] = useState<UserProfile | null>(null);
  const [deleting, setDeleting] = useState(false);

  function openEdit(u: UserProfile) {
    setEditUser(u);
    setEditEmail(u.email);
    setEditAccess(u.access === "Admin" ? "Admin" : "Employee");
    setEditRoleId(u.roleId ?? "");
    setEditStatus(u.status === "Inactive" ? "Inactive" : "Active");
    setEditCreatedAt(new Date(u.createdAt).toISOString().slice(0, 10));
    setEditErr(null);
  }

  async function saveEdit() {
    if (!editUser || !profile) return;
    const trimmedEmail = editEmail.trim().toLowerCase();
    if (!trimmedEmail) {
      setEditErr("Email is required.");
      return;
    }
    setEditSaving(true);
    setEditErr(null);
    try {
      const createdAtMs = new Date(editCreatedAt + "T00:00:00").getTime();
      await updateDoc(doc(db, "users", editUser.id), {
        email: trimmedEmail,
        access: editAccess,
        roleId: editAccess === "Employee" ? editRoleId || null : null,
        status: editStatus,
        createdAt: Number.isNaN(createdAtMs) ? editUser.createdAt : createdAtMs,
        updatedAt: Date.now(),
        updatedBy: profile.name || "Admin",
      });
      logActivity(profile.shopId, {
        userId: profile.id,
        userName: profile.name,
        type: "action",
        module: "Master",
        description: `Edited user ${editUser.name}`,
      });
      setEditUser(null);
    } catch (e) {
      console.error(e);
      setEditErr("Could not save changes. Try again.");
    } finally {
      setEditSaving(false);
    }
  }

  async function toggleActive(u: UserProfile) {
    if (!profile) return;
    const nextStatus = u.status === "Active" ? "Inactive" : "Active";
    await updateDoc(doc(db, "users", u.id), {
      status: nextStatus,
      updatedAt: Date.now(),
      updatedBy: profile.name || "Admin",
    });
    logActivity(profile.shopId, {
      userId: profile.id,
      userName: profile.name,
      type: "action",
      module: "Master",
      description: `Set ${u.name} ${nextStatus.toLowerCase()}`,
    });
  }

  async function confirmDelete() {
    if (!deleteUser || !profile) return;
    setDeleting(true);
    try {
      await updateDoc(doc(db, "users", deleteUser.id), {
        status: "Deleted",
        updatedAt: Date.now(),
        updatedBy: profile.name || "Admin",
      });
      logActivity(profile.shopId, {
        userId: profile.id,
        userName: profile.name,
        type: "action",
        module: "Master",
        description: `Deleted user ${deleteUser.name}`,
      });
      setDeleteUser(null);
    } finally {
      setDeleting(false);
    }
  }

  async function handleCreate() {
    const trimmedEmail = email.trim().toLowerCase();
    if (!name.trim() || !trimmedEmail) {
      setErr("Name and email are required.");
      return;
    }
    if (password.length < 6) {
      setErr("Password must be at least 6 characters.");
      return;
    }
    if (!profile?.shopId) {
      setErr("No shop selected yet.");
      return;
    }
    setSaving(true);
    setErr(null);
    try {
      const uid = await createEmployeeAuthAccount(trimmedEmail, password);
      await setDoc(doc(db, "users", uid), {
        name: name.trim(),
        email: trimmedEmail,
        access,
        roleId: access === "Employee" ? roleId : null,
        status: "Active",
        shopId: profile.shopId,
        createdAt: Date.now(),
        createdBy: profile?.name || "Admin",
      });
      logActivity(profile.shopId, {
        userId: profile.id,
        userName: profile.name,
        type: "action",
        module: "Master",
        description: `Created user ${name.trim()}`,
      });
      setName("");
      setEmail("");
      setPassword(generatePassword());
    } catch (e) {
      console.error(e);
      const code = (e as { code?: string })?.code || "";
      if (code.includes("email-already-in-use")) setErr("An account with that email already exists.");
      else setErr("Could not create user. Try again.");
    } finally {
      setSaving(false);
    }
  }

  async function handleResetPassword(userEmail: string) {
    setResetMsg(null);
    try {
      await sendPasswordResetEmail(auth, userEmail);
      setResetMsg(`Password reset email sent to ${userEmail}.`);
    } catch (e) {
      console.error(e);
      setResetMsg("Could not send reset email. Try again.");
    }
  }

  function roleName(u: UserProfile) {
    if (u.access === "Admin") return "Full rights";
    return roles.find((r) => r.id === u.roleId)?.name ?? "No profile assigned";
  }

  const { sorted: sortedUsers, headerProps: userHeaderProps } = useSortableRows(users, (row, key) => {
    switch (key) {
      case "name": return row.name;
      case "email": return row.email;
      default: return "";
    }
  });

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
                <SortHeader label="Name" sortKey="name" headerProps={userHeaderProps} />
                <SortHeader label="Email" sortKey="email" headerProps={userHeaderProps} />
                <th>Access</th>
                <th>Profile</th>
                <th>Login method</th>
                <th>Status</th>
                <th>Added</th>
                {isAdmin && <th />}
              </tr>
              {sortedUsers.map((u) => (
                <tr key={u.id}>
                  <td>{nameWithStatus(u.name, users)}</td>
                  <td>{u.email}</td>
                  <td>
                    <span className={"pill " + (u.access === "Admin" ? "good" : "neutral")}>{u.access}</span>
                  </td>
                  <td>{roleName(u)}</td>
                  <td>
                    <span className="pill neutral">
                      {likelyHasGoogleAccount(u.email) ? "Local + Google" : "Local only"}
                    </span>
                  </td>
                  <td>
                    <span
                      className={
                        "pill " +
                        (u.status === "Active"
                          ? "good"
                          : u.status === "Invited"
                          ? "warn"
                          : u.status === "Inactive"
                          ? "warn"
                          : "bad")
                      }
                    >
                      {u.status}
                    </span>
                  </td>
                  <td>{new Date(u.createdAt).toLocaleDateString()}</td>
                  {isAdmin && (
                    <td>
                      {u.status === "Deleted" ? (
                        <span style={{ fontSize: 11, color: "var(--muted)" }}>Deleted — record kept for history</span>
                      ) : (
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                          <button
                            className="btn"
                            style={{ padding: "4px 10px", fontSize: 12 }}
                            onClick={() => handleResetPassword(u.email)}
                          >
                            Reset password
                          </button>
                          <button className="btn" style={{ padding: "4px 10px", fontSize: 12 }} onClick={() => openEdit(u)}>
                            Edit
                          </button>
                          {u.id !== profile?.id && (
                            <>
                              <button
                                className="btn"
                                style={{ padding: "4px 10px", fontSize: 12 }}
                                onClick={() => toggleActive(u)}
                              >
                                {u.status === "Active" ? "Set inactive" : "Set active"}
                              </button>
                              <button
                                className="btn danger"
                                style={{ padding: "4px 10px", fontSize: 12 }}
                                onClick={() => setDeleteUser(u)}
                              >
                                Delete
                              </button>
                            </>
                          )}
                        </div>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {resetMsg && <p style={{ fontSize: 12, color: "var(--good)", marginTop: 8 }}>{resetMsg}</p>}
        <div className="foot-note">
          <i /> Admin always has complete rights; every other user must carry a profile from Roles &amp; permissions.
          "Reset password" sends a password-reset email — Admin never sees or sets a live password after creation.
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
            <label>Local password</label>
            <div style={{ display: "flex", gap: 6 }}>
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={{ flex: 1 }}
              />
              <button className="btn" type="button" onClick={() => setShowPassword((v) => !v)} title="Show password">
                👁
              </button>
              <button className="btn" type="button" onClick={() => setPassword(generatePassword())} title="Generate a random password">
                Generate
              </button>
            </div>
          </div>
          <div className="field">
            <label>Access level</label>
            <select value={access} onChange={(e) => setAccess(e.target.value as "Employee" | "Admin")}>
              <option>Employee</option>
              <option>Admin</option>
            </select>
          </div>
        </div>
        <div className="field-row">
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
          They can sign in with this email and password right away. If their email is a Google account, "Continue
          with Google" works too — nothing extra to set up.
        </p>
      </div>

      {editUser && (
        <Modal
          title={`Edit user — ${editUser.name}`}
          onClose={() => setEditUser(null)}
          footer={
            <>
              <button className="btn" onClick={() => setEditUser(null)}>
                Cancel
              </button>
              <button className="btn primary" onClick={saveEdit} disabled={editSaving}>
                {editSaving ? "Saving…" : "Save changes"}
              </button>
            </>
          }
        >
          <div className="field-row">
            <div className="field">
              <label>Email</label>
              <input value={editEmail} onChange={(e) => setEditEmail(e.target.value)} />
            </div>
            <div className="field">
              <label>Access level</label>
              <select value={editAccess} onChange={(e) => setEditAccess(e.target.value as "Employee" | "Admin")}>
                <option>Employee</option>
                <option>Admin</option>
              </select>
            </div>
          </div>
          <div className="field-row">
            <div className="field">
              <label>Profile (employee only)</label>
              <select value={editRoleId} onChange={(e) => setEditRoleId(e.target.value)} disabled={editAccess === "Admin"}>
                <option value="">No profile assigned</option>
                {roles.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Status</label>
              <select value={editStatus} onChange={(e) => setEditStatus(e.target.value as "Active" | "Inactive")}>
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
              </select>
            </div>
          </div>
          <div className="field-row">
            <div className="field">
              <label>Date created</label>
              <input type="date" value={editCreatedAt} onChange={(e) => setEditCreatedAt(e.target.value)} />
            </div>
            <div className="field">
              <label>Date modified</label>
              <input
                value={editUser.updatedAt ? new Date(editUser.updatedAt).toLocaleString() : "Never modified"}
                disabled
              />
            </div>
          </div>
          {editErr && <p className="errortext">{editErr}</p>}
          <p style={{ fontSize: 11, color: "var(--muted)", marginTop: 4 }}>
            Editing email here only updates their profile record — it does not change their actual sign-in email
            with Firebase, which can't be changed by another user.
          </p>
        </Modal>
      )}

      {deleteUser && (
        <Modal
          title="Delete user"
          onClose={() => setDeleteUser(null)}
          footer={
            <>
              <button className="btn" onClick={() => setDeleteUser(null)}>
                Cancel
              </button>
              <button className="btn danger" onClick={confirmDelete} disabled={deleting}>
                {deleting ? "Deleting…" : "Delete user"}
              </button>
            </>
          }
        >
          <p style={{ fontSize: 13 }}>
            Delete <strong>{deleteUser.name}</strong>? They will no longer be able to sign in, but every past record
            that carries their name (sales, purchases, expenses) is kept and will show as{" "}
            <strong>{deleteUser.name} (ex)</strong> so your history stays intact.
          </p>
        </Modal>
      )}
    </div>
  );
}

function SuppliersTab() {
  const { profile } = useAuth();
  const { data: suppliers, loading } = useShopCollection<Supplier>("suppliers", byCreatedDesc());
  const { data: purchases } = useShopCollection<Purchase>("purchases");
  const { create } = useShopAuditedWrites("suppliers");
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [address, setAddress] = useState("");
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);

  function outstandingFor(supplierId: string) {
    return purchases
      .filter((p) => p.supplierId === supplierId)
      .reduce((sum, p) => sum + Math.max(0, p.total - purchasePaidTotal(p)), 0);
  }

  const { sorted: sortedSuppliers, headerProps: supplierHeaderProps } = useSortableRows(suppliers, (row, key) => {
    switch (key) {
      case "supplier": return row.name;
      case "outstanding": return outstandingFor(row.id);
      default: return "";
    }
  });

  async function handleCreate() {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await create({ name: name.trim(), contact: contact.trim(), address: address.trim() });
      if (profile) {
        logActivity(profile.shopId, {
          userId: profile.id,
          userName: profile.name,
          type: "action",
          module: "Master",
          description: `Added supplier ${name.trim()}`,
        });
      }
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
                <SortHeader label="Supplier" sortKey="supplier" headerProps={supplierHeaderProps} />
                <th>Contact</th>
                <th>Address</th>
                <SortHeader label="Outstanding" sortKey="outstanding" headerProps={supplierHeaderProps} num />
                <th>Added</th>
              </tr>
              {sortedSuppliers.map((s) => (
                <tr key={s.id}>
                  <td>{s.name}</td>
                  <td>{s.contact || "—"}</td>
                  <td>{s.address || "—"}</td>
                  <td className="num">{money(outstandingFor(s.id))}</td>
                  <td>{new Date(s.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <div className="foot-note">
          <i /> Suppliers added here appear immediately in the Purchases screen. Outstanding is what you still owe
          this supplier — the unpaid balance across all their purchases.
        </div>
      </div>
    </div>
  );
}

function RolesTab() {
  const { profile } = useAuth();
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
      if (profile) {
        logActivity(profile.shopId, {
          userId: profile.id,
          userName: profile.name,
          type: "action",
          module: "Master",
          description: `Created role ${newName.trim()}`,
        });
      }
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
    if (profile) {
      const roleName = roles.find((r) => r.id === roleId)?.name ?? "role";
      logActivity(profile.shopId, {
        userId: profile.id,
        userName: profile.name,
        type: "action",
        module: "Master",
        description: `Edited ${roleName}'s permissions`,
      });
    }
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

function ActivityTab() {
  const { data: entries, loading } = useShopActivityLog();
  const { data: users } = useShopUsers();
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  const [selectedModules, setSelectedModules] = useState<Set<string>>(new Set());

  function toggleUser(userId: string) {
    setSelectedUsers((prev) => {
      const next = new Set(prev);
      next.has(userId) ? next.delete(userId) : next.add(userId);
      return next;
    });
  }
  function toggleModule(module: string) {
    setSelectedModules((prev) => {
      const next = new Set(prev);
      next.has(module) ? next.delete(module) : next.add(module);
      return next;
    });
  }

  const filtered = entries.filter((e) => {
    if (selectedUsers.size > 0 && !selectedUsers.has(e.userId)) return false;
    if (selectedModules.size > 0 && (e.type !== "action" || !selectedModules.has(e.module || ""))) return false;
    return true;
  });

  return (
    <div>
      <p style={{ fontSize: 12, color: "var(--muted)", margin: "0 0 8px" }}>Filter by user — pick one, a few, or leave all unselected to show everyone</p>
      <div className="userchips">
        {users.map((u) => (
          <button
            key={u.id}
            className={"chip" + (selectedUsers.has(u.id) ? " on" : "")}
            onClick={() => toggleUser(u.id)}
            type="button"
          >
            {nameWithStatus(u.name, users)}
          </button>
        ))}
      </div>
      <p style={{ fontSize: 12, color: "var(--muted)", margin: "14px 0 8px" }}>Filter by screen</p>
      <div className="userchips">
        {ACTIVITY_MODULES.map((m) => (
          <button
            key={m}
            className={"chip" + (selectedModules.has(m) ? " on" : "")}
            onClick={() => toggleModule(m)}
            type="button"
          >
            {m}
          </button>
        ))}
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        {loading ? (
          <p style={{ fontSize: 12, color: "var(--muted)" }}>Loading…</p>
        ) : filtered.length === 0 ? (
          <p style={{ fontSize: 12, color: "var(--muted)" }}>No activity matches these filters.</p>
        ) : (
          <div className="table-wrap scroll5">
            <table>
              <tbody>
                <tr>
                  <th>Time</th>
                  <th>User</th>
                  <th>Screen</th>
                  <th>Activity</th>
                </tr>
                {filtered.map((e) => (
                  <tr key={e.id}>
                    <td>
                      {new Date(e.at).toLocaleDateString()}{" "}
                      {new Date(e.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </td>
                    <td>{nameWithStatus(e.userName, users)}</td>
                    <td>{e.module || "—"}</td>
                    <td>{activityDescription(e)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="foot-note">
          <i /> Every sign-in, sign-out, and completed entry in this shop, newest first — capped to the most recent
          500 entries.
        </div>
      </div>
    </div>
  );
}

export default function MasterScreen() {
  const [params, setParams] = useSearchParams();
  const sub = params.get("sub") || "users";

  return (
    <div>
      <div className="tabs2">
        {(["users", "suppliers", "roles", "activity"] as const).map((t) => (
          <button key={t} className={"tab2" + (sub === t ? " on" : "")} onClick={() => setParams({ sub: t })}>
            {t === "users" ? "Users" : t === "suppliers" ? "Suppliers" : t === "roles" ? "Roles & permissions" : "Activity"}
          </button>
        ))}
      </div>
      {sub === "users" && <UsersTab />}
      {sub === "suppliers" && <SuppliersTab />}
      {sub === "roles" && <RolesTab />}
      {sub === "activity" && <ActivityTab />}
    </div>
  );
}

import { useEffect, useState } from "react";
import {
  collection,
  onSnapshot,
  orderBy,
  query,
  where,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp,
  type QueryConstraint,
} from "firebase/firestore";
import { db } from "../firebase/config";
import { useAuth } from "../context/AuthContext";
import type { UserProfile } from "../types";

/**
 * Live-subscribes to a collection. Every write helper below stamps
 * createdAt/createdBy (and updatedAt/updatedBy on edits) so records stay
 * auditable even for fields the UI never renders.
 *
 * `path` may be null while the caller doesn't know it yet (e.g. shop-scoped
 * paths before the user's shopId has loaded) — subscription is skipped and
 * loading stays true until a real path shows up.
 */
export function useCollection<T>(path: string | null, constraints: QueryConstraint[] = []) {
  const [data, setData] = useState<(T & { id: string })[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!path) return;
    const q = query(collection(db, path), ...constraints);
    const unsub = onSnapshot(
      q,
      (snap) => {
        setData(snap.docs.map((d) => ({ id: d.id, ...(d.data() as T) })));
        setLoading(false);
      },
      (err) => {
        console.error(`Failed to load ${path}`, err);
        setLoading(false);
      }
    );
    return unsub;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, JSON.stringify(constraints.map((c) => c.type))]);

  return { data, loading };
}

export function useAuditedWrites(path: string | null) {
  const { firebaseUser, profile } = useAuth();

  async function create(data: Record<string, unknown>) {
    if (!path) throw new Error("No shop selected yet.");
    const now = Date.now();
    return addDoc(collection(db, path), {
      ...data,
      createdAt: now,
      createdBy: profile?.name || firebaseUser?.email || "unknown",
      createdAtServer: serverTimestamp(),
    });
  }

  async function update(id: string, data: Record<string, unknown>) {
    if (!path) throw new Error("No shop selected yet.");
    return updateDoc(doc(db, path, id), {
      ...data,
      updatedAt: Date.now(),
      updatedBy: profile?.name || firebaseUser?.email || "unknown",
      updatedAtServer: serverTimestamp(),
    });
  }

  async function remove(id: string) {
    if (!path) throw new Error("No shop selected yet.");
    return deleteDoc(doc(db, path, id));
  }

  return { create, update, remove };
}

export function byCreatedDesc(): QueryConstraint[] {
  return [orderBy("createdAt", "desc")];
}

/** Path to the current user's shop-scoped subcollection, or null until shopId has loaded. */
export function useShopPath(name: string): string | null {
  const { profile } = useAuth();
  return profile?.shopId ? `shops/${profile.shopId}/${name}` : null;
}

export function useShopCollection<T>(name: string, constraints: QueryConstraint[] = []) {
  const path = useShopPath(name);
  return useCollection<T>(path, constraints);
}

export function useShopAuditedWrites(name: string) {
  const path = useShopPath(name);
  return useAuditedWrites(path);
}

/**
 * users/{docId} stays a flat top-level collection (it must be queryable by
 * uid or by email before we know a shopId), so membership in a shop is a
 * `shopId` field rather than a subcollection path. This includes both
 * claimed (uid-keyed) and pending-invite (email-keyed) docs for the shop.
 */
export function useShopUsers() {
  const { profile } = useAuth();
  const shopId = profile?.shopId;
  const [data, setData] = useState<(UserProfile & { id: string })[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!shopId) return;
    const q = query(collection(db, "users"), where("shopId", "==", shopId));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const rows = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<UserProfile, "id">) }));
        rows.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
        setData(rows);
        setLoading(false);
      },
      (err) => {
        console.error("Failed to load users", err);
        setLoading(false);
      }
    );
    return unsub;
  }, [shopId]);

  return { data, loading };
}

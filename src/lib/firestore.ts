import { useEffect, useState } from "react";
import {
  collection,
  onSnapshot,
  orderBy,
  query,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp,
  type QueryConstraint,
} from "firebase/firestore";
import { db } from "../firebase/config";
import { useAuth } from "../context/AuthContext";

/**
 * Live-subscribes to a collection. Every write helper below stamps
 * createdAt/createdBy (and updatedAt/updatedBy on edits) so records stay
 * auditable even for fields the UI never renders.
 */
export function useCollection<T>(path: string, constraints: QueryConstraint[] = []) {
  const [data, setData] = useState<(T & { id: string })[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
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

export function useAuditedWrites(path: string) {
  const { firebaseUser, profile } = useAuth();

  async function create(data: Record<string, unknown>) {
    const now = Date.now();
    return addDoc(collection(db, path), {
      ...data,
      createdAt: now,
      createdBy: profile?.name || firebaseUser?.email || "unknown",
      createdAtServer: serverTimestamp(),
    });
  }

  async function update(id: string, data: Record<string, unknown>) {
    return updateDoc(doc(db, path, id), {
      ...data,
      updatedAt: Date.now(),
      updatedBy: profile?.name || firebaseUser?.email || "unknown",
      updatedAtServer: serverTimestamp(),
    });
  }

  async function remove(id: string) {
    return deleteDoc(doc(db, path, id));
  }

  return { create, update, remove };
}

export function byCreatedDesc(): QueryConstraint[] {
  return [orderBy("createdAt", "desc")];
}

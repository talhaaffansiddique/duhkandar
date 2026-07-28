import { useEffect, useState } from "react";
import { collection, doc, getDoc, onSnapshot } from "firebase/firestore";
import { db } from "../firebase/config";
import { useAuth } from "../context/AuthContext";
import type { Shop, UserProfile } from "../types";

export function useIsSuperAdmin() {
  const { firebaseUser } = useAuth();
  const [isSuperAdmin, setIsSuperAdmin] = useState<boolean | null>(null);

  useEffect(() => {
    if (!firebaseUser) return;
    getDoc(doc(db, "superAdmins", firebaseUser.uid))
      .then((snap) => setIsSuperAdmin(snap.exists()))
      .catch(() => setIsSuperAdmin(false));
  }, [firebaseUser]);

  return isSuperAdmin;
}

export function useAllShops() {
  const [shops, setShops] = useState<(Shop & { id: string })[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, "shops"),
      (snap) => {
        setShops(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Shop, "id">) })));
        setLoading(false);
      },
      (err) => {
        console.error("Failed to load shops", err);
        setLoading(false);
      }
    );
    return unsub;
  }, []);

  return { shops, loading };
}

export function useAllUsers() {
  const [users, setUsers] = useState<(UserProfile & { id: string })[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, "users"),
      (snap) => {
        setUsers(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<UserProfile, "id">) })));
        setLoading(false);
      },
      (err) => {
        console.error("Failed to load users", err);
        setLoading(false);
      }
    );
    return unsub;
  }, []);

  return { users, loading };
}

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  signOut as firebaseSignOut,
  type User,
} from "firebase/auth";
import { doc, getDoc, setDoc, deleteDoc, addDoc, collection, serverTimestamp } from "firebase/firestore";
import { auth, db, googleProvider } from "../firebase/config";
import type { UserProfile } from "../types";

interface AuthContextValue {
  firebaseUser: User | null;
  profile: UserProfile | null;
  loading: boolean;
  needsShopSetup: boolean;
  error: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  registerOwner: (name: string, email: string, password: string, shopName: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  completeShopSetup: (shopName: string) => Promise<void>;
  signOut: () => Promise<void>;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

async function createShopAndProfile(user: User, name: string, shopName: string): Promise<UserProfile> {
  const shopRef = await addDoc(collection(db, "shops"), {
    name: shopName.trim(),
    ownerUid: user.uid,
    createdAt: Date.now(),
  });
  const profileData = {
    name,
    email: (user.email || "").toLowerCase(),
    access: "Admin" as const,
    status: "Active" as const,
    shopId: shopRef.id,
    createdAt: Date.now(),
    createdBy: user.uid,
  };
  await setDoc(doc(db, "users", user.uid), { ...profileData, createdAtServer: serverTimestamp() });
  return { id: user.uid, ...profileData };
}

/**
 * Loads the signed-in user's profile. Handles two paths besides the normal
 * "already has a uid-keyed doc" case: claiming a pending invite (an Admin
 * created a users/{email} placeholder with a shopId already on it), or —
 * if neither exists — signalling that this is a brand-new person who needs
 * to name a shop before they can do anything (needsSetup).
 */
async function loadProfile(user: User): Promise<{ profile: UserProfile | null; needsSetup: boolean }> {
  const ref = doc(db, "users", user.uid);
  const snap = await getDoc(ref);
  if (snap.exists()) {
    return { profile: { id: snap.id, ...(snap.data() as Omit<UserProfile, "id">) }, needsSetup: false };
  }

  if (user.email) {
    const inviteRef = doc(db, "users", user.email.toLowerCase());
    const inviteSnap = await getDoc(inviteRef);
    if (inviteSnap.exists()) {
      const invite = inviteSnap.data() as Omit<UserProfile, "id">;
      const claimed = { ...invite, status: "Active" as const };
      await setDoc(ref, claimed);
      await deleteDoc(inviteRef);
      return { profile: { id: user.uid, ...claimed }, needsSetup: false };
    }
  }

  return { profile: null, needsSetup: true };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [needsShopSetup, setNeedsShopSetup] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      if (user) {
        try {
          const { profile: p, needsSetup } = await loadProfile(user);
          setProfile(p);
          setNeedsShopSetup(needsSetup);
        } catch (e) {
          console.error("Failed to load user profile", e);
          setProfile(null);
          setNeedsShopSetup(false);
        }
      } else {
        setProfile(null);
        setNeedsShopSetup(false);
      }
      setLoading(false);
    });
    return unsub;
  }, []);

  function friendlyError(e: unknown): string {
    const code = (e as { code?: string })?.code || "";
    if (code.includes("wrong-password") || code.includes("invalid-credential")) return "That email or password isn't right.";
    if (code.includes("user-not-found")) return "No account found with that email.";
    if (code.includes("email-already-in-use")) return "An account with that email already exists.";
    if (code.includes("weak-password")) return "Choose a password with at least 6 characters.";
    if (code.includes("popup-closed-by-user")) return "Google sign-in was cancelled.";
    if (code.includes("unauthorized-domain")) {
      return "This website isn't authorized for Google sign-in yet — add it under Firebase console → Authentication → Settings → Authorized domains.";
    }
    if (code.includes("popup-blocked")) return "Your browser blocked the Google sign-in popup. Allow popups for this site and try again.";
    if (code.includes("operation-not-allowed")) return "Google sign-in isn't enabled yet — enable it under Firebase console → Authentication → Sign-in method.";
    console.error("Unrecognized auth error", code, e);
    return `Something went wrong (${code || "unknown error"}). Try again.`;
  }

  async function signIn(email: string, password: string) {
    setError(null);
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (e) {
      setError(friendlyError(e));
      throw e;
    }
  }

  async function registerOwner(name: string, email: string, password: string, shopName: string) {
    setError(null);
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      const p = await createShopAndProfile(cred.user, name, shopName);
      setProfile(p);
      setNeedsShopSetup(false);
    } catch (e) {
      setError(friendlyError(e));
      throw e;
    }
  }

  async function signInWithGoogle() {
    setError(null);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (e) {
      setError(friendlyError(e));
      throw e;
    }
  }

  async function completeShopSetup(shopName: string) {
    if (!firebaseUser) return;
    setError(null);
    try {
      const p = await createShopAndProfile(
        firebaseUser,
        firebaseUser.displayName || firebaseUser.email?.split("@")[0] || "Owner",
        shopName
      );
      setProfile(p);
      setNeedsShopSetup(false);
    } catch (e) {
      setError(friendlyError(e));
      throw e;
    }
  }

  async function signOut() {
    await firebaseSignOut(auth);
  }

  return (
    <AuthContext.Provider
      value={{
        firebaseUser,
        profile,
        loading,
        needsShopSetup,
        error,
        signIn,
        registerOwner,
        signInWithGoogle,
        completeShopSetup,
        signOut,
        clearError: () => setError(null),
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components -- hook is tightly coupled to AuthProvider's context.
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

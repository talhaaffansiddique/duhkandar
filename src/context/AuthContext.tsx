import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  signOut as firebaseSignOut,
  type User,
} from "firebase/auth";
import { doc, getDoc, setDoc, deleteDoc, serverTimestamp } from "firebase/firestore";
import { auth, db, googleProvider } from "../firebase/config";
import type { UserProfile } from "../types";

interface AuthContextValue {
  firebaseUser: User | null;
  profile: UserProfile | null;
  loading: boolean;
  error: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  registerOwner: (name: string, email: string, password: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

async function loadOrCreateProfile(user: User): Promise<UserProfile> {
  const ref = doc(db, "users", user.uid);
  const snap = await getDoc(ref);
  if (snap.exists()) {
    return { id: snap.id, ...(snap.data() as Omit<UserProfile, "id">) };
  }

  // Check for a pending invite created by an Admin in Master -> Users (doc keyed by email).
  if (user.email) {
    const inviteRef = doc(db, "users", user.email.toLowerCase());
    const inviteSnap = await getDoc(inviteRef);
    if (inviteSnap.exists()) {
      const invite = inviteSnap.data() as Omit<UserProfile, "id">;
      const claimed = { ...invite, status: "Active" as const };
      await setDoc(ref, claimed);
      await deleteDoc(inviteRef);
      return { id: user.uid, ...claimed };
    }
  }

  // No account and no invite: first person in ever becomes the shop owner/Admin.
  const newProfile = {
    name: user.displayName || user.email?.split("@")[0] || "New user",
    email: user.email || "",
    access: "Admin" as const,
    status: "Active" as const,
    createdAt: Date.now(),
    createdBy: user.uid,
  };
  await setDoc(ref, { ...newProfile, createdAtServer: serverTimestamp() });
  return { id: user.uid, ...newProfile };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      if (user) {
        try {
          const p = await loadOrCreateProfile(user);
          setProfile(p);
        } catch (e) {
          console.error("Failed to load user profile", e);
          setProfile(null);
        }
      } else {
        setProfile(null);
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
    return "Something went wrong. Try again.";
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

  async function registerOwner(name: string, email: string, password: string) {
    setError(null);
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      const ref = doc(db, "users", cred.user.uid);
      await setDoc(ref, {
        name,
        email,
        access: "Admin",
        status: "Active",
        createdAt: Date.now(),
        createdBy: cred.user.uid,
        createdAtServer: serverTimestamp(),
      });
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

  async function signOut() {
    await firebaseSignOut(auth);
  }

  return (
    <AuthContext.Provider
      value={{
        firebaseUser,
        profile,
        loading,
        error,
        signIn,
        registerOwner,
        signInWithGoogle,
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

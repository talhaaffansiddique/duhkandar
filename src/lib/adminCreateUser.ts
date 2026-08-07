import { initializeApp, deleteApp } from "firebase/app";
import { getAuth, createUserWithEmailAndPassword, signOut } from "firebase/auth";
import { app } from "../firebase/config";

/**
 * Creates a brand-new Firebase Auth account (email + password) without
 * disturbing the Admin's own signed-in session. createUserWithEmailAndPassword
 * always signs in as the newly-created user on whichever Auth instance calls
 * it, so this runs it against a throwaway secondary Firebase App instance
 * (same project config, different app name) and tears that instance down
 * immediately after — the Admin's primary session in `auth` never moves.
 */
export async function createEmployeeAuthAccount(email: string, password: string): Promise<string> {
  const secondaryApp = initializeApp(app.options, `admin-create-${Date.now()}`);
  const secondaryAuth = getAuth(secondaryApp);
  try {
    const cred = await createUserWithEmailAndPassword(secondaryAuth, email, password);
    const uid = cred.user.uid;
    await signOut(secondaryAuth);
    return uid;
  } finally {
    await deleteApp(secondaryApp);
  }
}

export function generatePassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  let out = "";
  for (let i = 0; i < 10; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

export function likelyHasGoogleAccount(email: string): boolean {
  const domain = email.split("@")[1]?.toLowerCase() ?? "";
  return domain === "gmail.com" || domain === "googlemail.com";
}

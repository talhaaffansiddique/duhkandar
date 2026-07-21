import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

export const isFirebaseConfigured = Boolean(firebaseConfig.apiKey && firebaseConfig.projectId);

// initializeApp/getAuth throw synchronously on a missing/malformed key, which would
// otherwise crash the whole module graph to a blank page before React ever mounts.
// Guard so the app can render a setup screen instead when .env hasn't been filled in.
// Typed as non-optional: every consumer only mounts once App confirms
// isFirebaseConfigured, so these are guaranteed set by the time they're used.
let _app: ReturnType<typeof initializeApp>;
let _auth: ReturnType<typeof getAuth>;
let _db: ReturnType<typeof getFirestore>;
let _googleProvider: GoogleAuthProvider;

if (isFirebaseConfigured) {
  _app = initializeApp(firebaseConfig);
  _auth = getAuth(_app);
  _db = getFirestore(_app);
  _googleProvider = new GoogleAuthProvider();
}

export const app = _app!;
export const auth = _auth!;
export const db = _db!;
export const googleProvider = _googleProvider!;

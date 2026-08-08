import { addDoc, collection } from "firebase/firestore";
import { db } from "../firebase/config";
import type { ActivityLogEntry } from "../types";

/**
 * Fire-and-forget write to a shop's Activity Tracker log. Never awaited by
 * callers and never throws into the UI — losing one audit entry shouldn't
 * block a sign-in, sign-out, or screen navigation. Kept in its own module
 * (rather than lib/firestore.ts) so AuthContext can log a sign-in/sign-out
 * without an import cycle back through firestore.ts's useAuth() import.
 */
export function logActivity(shopId: string, entry: Omit<ActivityLogEntry, "id" | "at">) {
  addDoc(collection(db, `shops/${shopId}/activityLog`), { ...entry, at: Date.now() }).catch((e) =>
    console.error("Failed to write activity log entry", e)
  );
}

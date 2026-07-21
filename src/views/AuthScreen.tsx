import { useState, type FormEvent } from "react";
import { useAuth } from "../context/AuthContext";

export default function AuthScreen() {
  const { signIn, registerOwner, signInWithGoogle, error, clearError } = useAuth();
  const [mode, setMode] = useState<"signin" | "register">("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signin") {
        await signIn(email, password);
      } else {
        await registerOwner(name, email, password);
      }
    } catch {
      // error is already surfaced via context
    } finally {
      setBusy(false);
    }
  }

  async function handleGoogle() {
    setBusy(true);
    try {
      await signInWithGoogle();
    } catch {
      // error is already surfaced via context
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="authwrap">
      <div className="authcard">
        <h2>{mode === "signin" ? "Welcome back" : "Create your shop"}</h2>
        <p className="sub">
          {mode === "signin" ? "Sign in to your Dukandar account" : "Set up Dukandar for your shop"}
        </p>
        <form onSubmit={handleSubmit}>
          {mode === "register" && (
            <div className="field">
              <label>Your name</label>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Waseem Akhtar" required />
            </div>
          )}
          <div className="field">
            <label>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="owner@yourshop.pk"
              required
            />
          </div>
          <div className="field">
            <label>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 6 characters"
              minLength={6}
              required
            />
          </div>
          {error && <p className="errortext">{error}</p>}
          <button className="btn primary" type="submit" style={{ width: "100%", padding: "10px" }} disabled={busy}>
            {mode === "signin" ? "Sign in" : "Create account"}
          </button>
        </form>
        <div className="divider">or</div>
        <button className="googlebtn" onClick={handleGoogle} disabled={busy}>
          <span className="gicon" /> Continue with Google
        </button>
        <button
          className="togglebtn"
          onClick={() => {
            clearError();
            setMode(mode === "signin" ? "register" : "signin");
          }}
        >
          {mode === "signin" ? "Don't have an account? Create one" : "Already have an account? Sign in"}
        </button>
      </div>
    </div>
  );
}

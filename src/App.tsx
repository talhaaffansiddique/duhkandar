import { useState } from "react";
import { BrowserRouter, Routes, Route, Navigate, NavLink, useLocation } from "react-router-dom";
import { isFirebaseConfigured } from "./firebase/config";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { usePermissions } from "./lib/permissions";
import AuthScreen from "./views/AuthScreen";
import DashboardScreen from "./views/DashboardScreen";
import InventoryScreen from "./views/InventoryScreen";
import PurchaseScreen from "./views/PurchaseScreen";
import ExpenseScreen from "./views/ExpenseScreen";
import ReportsScreen from "./views/ReportsScreen";
import MasterScreen from "./views/MasterScreen";
import SettingsScreen from "./views/SettingsScreen";

const TITLES: Record<string, string> = {
  "/": "Dashboard",
  "/inventory": "Inventory",
  "/purchases": "Purchases",
  "/expense": "Expense",
  "/reports": "Reports",
  "/master": "Master",
  "/settings": "Settings",
};

function Shell() {
  const { profile, signOut } = useAuth();
  const { permissions, isAdmin } = usePermissions();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark" | null>(null);

  const title = TITLES[location.pathname] || "Dukandar";
  const canSeePurchases = isAdmin || permissions.recordPurchases;
  const canSeeMaster = isAdmin;

  function toggleTheme() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
  }

  return (
    <div className="shell">
      <div className="rail">
        <div className="brand">
          Dukandar
          <span>Shop &amp; inventory</span>
        </div>
        <NavLink to="/" end className={({ isActive }) => "navbtn" + (isActive ? " active" : "")}>
          <span className="dot" />Dashboard
        </NavLink>
        <NavLink to="/inventory" className={({ isActive }) => "navbtn" + (isActive ? " active" : "")}>
          <span className="dot" />Inventory
        </NavLink>
        {canSeePurchases && (
          <NavLink to="/purchases" className={({ isActive }) => "navbtn" + (isActive ? " active" : "")}>
            <span className="dot" />Purchases
          </NavLink>
        )}
        <NavLink to="/expense" className={({ isActive }) => "navbtn" + (isActive ? " active" : "")}>
          <span className="dot" />Expense
        </NavLink>
        <NavLink to="/reports" className={({ isActive }) => "navbtn" + (isActive ? " active" : "")}>
          <span className="dot" />Reports
        </NavLink>
        {canSeeMaster && (
          <NavLink to="/master" className={({ isActive }) => "navbtn" + (isActive ? " active" : "")}>
            <span className="dot" />Master
          </NavLink>
        )}
        <NavLink to="/settings" className={({ isActive }) => "navbtn" + (isActive ? " active" : "")}>
          <span className="dot" />Settings
        </NavLink>
        <div className="railfoot">
          Cloud-first · Firebase
          <br />
          {profile?.email}
        </div>
      </div>
      <div className="main">
        <div className="topbar">
          <h1>{title}</h1>
          <div style={{ display: "flex", gap: 10, alignItems: "center", position: "relative" }}>
            <span className="pill neutral">{profile?.access === "Admin" ? "Admin" : profile?.access}</span>
            <button className="iconbtn" onClick={() => setMenuOpen((v) => !v)} aria-label="More">
              &#9776;
            </button>
            <div className={"dropdown" + (menuOpen ? " open" : "")}>
              <button
                onClick={async () => {
                  setMenuOpen(false);
                  await signOut();
                }}
              >
                &#8618; Sign out
              </button>
            </div>
            <button className="themebtn" onClick={toggleTheme}>
              Toggle theme
            </button>
          </div>
        </div>

        <Routes>
          <Route path="/" element={<DashboardScreen />} />
          <Route path="/inventory" element={<InventoryScreen />} />
          <Route path="/purchases" element={canSeePurchases ? <PurchaseScreen /> : <Navigate to="/" replace />} />
          <Route path="/expense" element={<ExpenseScreen />} />
          <Route path="/reports" element={<ReportsScreen />} />
          <Route path="/master" element={canSeeMaster ? <MasterScreen /> : <Navigate to="/" replace />} />
          <Route path="/settings" element={<SettingsScreen />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </div>
  );
}

function AppInner() {
  const { firebaseUser, loading } = useAuth();

  if (loading) {
    return (
      <div className="shell loggedout">
        <div className="main">
          <div className="center-fill">Loading Dukandar…</div>
        </div>
      </div>
    );
  }

  if (!firebaseUser) {
    return (
      <div className="shell loggedout">
        <div className="main">
          <AuthScreen />
        </div>
      </div>
    );
  }

  return <Shell />;
}

function FirebaseSetupNeeded() {
  return (
    <div className="shell loggedout">
      <div className="main">
        <div className="authwrap">
          <div className="authcard" style={{ width: 440 }}>
            <h2>Connect Firebase</h2>
            <p className="sub">Dukandar needs a Firebase project before it can run.</p>
            <ol style={{ fontSize: 13, color: "var(--muted)", paddingLeft: 18, lineHeight: 1.7 }}>
              <li>Create a project at console.firebase.google.com</li>
              <li>Enable Authentication (Email/Password and Google) and Firestore Database</li>
              <li>
                Copy your web app config into a <code>.env.local</code> file, plus a free{" "}
                <a href="https://cloudinary.com" target="_blank" rel="noreferrer">Cloudinary</a> cloud name and
                upload preset for photos (see <code>.env.example</code>)
              </li>
              <li>Restart the dev server</li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  if (!isFirebaseConfigured) {
    return <FirebaseSetupNeeded />;
  }
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppInner />
      </AuthProvider>
    </BrowserRouter>
  );
}

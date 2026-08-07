import { useState } from "react";
import { BrowserRouter, Routes, Route, Navigate, NavLink, useLocation } from "react-router-dom";
import { isFirebaseConfigured } from "./firebase/config";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { usePermissions } from "./lib/permissions";
import { useShopDoc } from "./lib/firestore";
import AuthScreen from "./views/AuthScreen";
import ShopSetupScreen from "./views/ShopSetupScreen";
import DashboardScreen from "./views/DashboardScreen";
import PosScreen from "./views/PosScreen";
import InventoryScreen from "./views/InventoryScreen";
import PurchaseScreen from "./views/PurchaseScreen";
import ExpenseScreen from "./views/ExpenseScreen";
import ReportsScreen from "./views/ReportsScreen";
import MasterScreen from "./views/MasterScreen";
import SettingsScreen from "./views/SettingsScreen";
import SuperAdminScreen from "./views/SuperAdminScreen";

const TITLES: Record<string, string> = {
  "/": "Dashboard",
  "/pos": "POS",
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
  const { shop } = useShopDoc();
  const location = useLocation();
  const [theme, setTheme] = useState<"light" | "dark" | null>(null);

  const title = TITLES[location.pathname] || "Dukandar";
  const canSeeDashboard = isAdmin || permissions.viewDashboard;
  const canSeePos = isAdmin || permissions.recordSales;
  const canSeeInventory = isAdmin || permissions.manageInventory;
  const canSeePurchases = isAdmin || permissions.recordPurchases;
  const canSeeExpense = isAdmin || permissions.addExpenses;
  const canSeeReports = isAdmin || permissions.viewReports;
  const canSeeMaster = isAdmin;

  // Every profile can always reach Settings (to see their own account) and
  // whichever screens their permission set unlocks. This is also the
  // fallback landing route so nobody with a narrow role gets stuck on a
  // screen they can't see.
  const firstAllowedPath = canSeeDashboard
    ? "/"
    : canSeePos
    ? "/pos"
    : canSeeInventory
    ? "/inventory"
    : canSeePurchases
    ? "/purchases"
    : canSeeExpense
    ? "/expense"
    : canSeeReports
    ? "/reports"
    : "/settings";

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
          <span className="shopname">{shop?.businessName || "Your shop"}</span>
        </div>
        {canSeeDashboard && (
          <NavLink to="/" end className={({ isActive }) => "navbtn" + (isActive ? " active" : "")}>
            <span className="dot" />Dashboard
          </NavLink>
        )}
        {canSeePos && (
          <NavLink to="/pos" className={({ isActive }) => "navbtn" + (isActive ? " active" : "")}>
            <span className="dot" />POS
          </NavLink>
        )}
        {canSeeInventory && (
          <NavLink to="/inventory" className={({ isActive }) => "navbtn" + (isActive ? " active" : "")}>
            <span className="dot" />Inventory
          </NavLink>
        )}
        {canSeePurchases && (
          <NavLink to="/purchases" className={({ isActive }) => "navbtn" + (isActive ? " active" : "")}>
            <span className="dot" />Purchases
          </NavLink>
        )}
        {canSeeExpense && (
          <NavLink to="/expense" className={({ isActive }) => "navbtn" + (isActive ? " active" : "")}>
            <span className="dot" />Expense
          </NavLink>
        )}
        {canSeeReports && (
          <NavLink to="/reports" className={({ isActive }) => "navbtn" + (isActive ? " active" : "")}>
            <span className="dot" />Reports
          </NavLink>
        )}
        {canSeeMaster && (
          <NavLink to="/master" className={({ isActive }) => "navbtn" + (isActive ? " active" : "")}>
            <span className="dot" />Master
          </NavLink>
        )}
        <NavLink to="/settings" className={({ isActive }) => "navbtn" + (isActive ? " active" : "")}>
          <span className="dot" />Settings
        </NavLink>
        <div className="railfoot">
          <span>{profile?.email}</span>
          <button className="btn signoutbtn" onClick={() => signOut()}>
            &#8618; Sign out
          </button>
        </div>
      </div>
      <div className="main">
        <div className="topbar">
          <h1>{title}</h1>
          <div style={{ display: "flex", gap: 10, alignItems: "center", position: "relative" }}>
            <span className="pill neutral">{profile?.access === "Admin" ? "Admin" : profile?.access}</span>
            <button className="themebtn" onClick={toggleTheme}>
              Toggle theme
            </button>
          </div>
        </div>

        <Routes>
          <Route path="/" element={canSeeDashboard ? <DashboardScreen /> : <Navigate to={firstAllowedPath} replace />} />
          <Route path="/pos" element={canSeePos ? <PosScreen /> : <Navigate to={firstAllowedPath} replace />} />
          <Route path="/inventory" element={canSeeInventory ? <InventoryScreen /> : <Navigate to={firstAllowedPath} replace />} />
          <Route path="/purchases" element={canSeePurchases ? <PurchaseScreen /> : <Navigate to={firstAllowedPath} replace />} />
          <Route path="/expense" element={canSeeExpense ? <ExpenseScreen /> : <Navigate to={firstAllowedPath} replace />} />
          <Route path="/reports" element={canSeeReports ? <ReportsScreen /> : <Navigate to={firstAllowedPath} replace />} />
          <Route path="/master" element={canSeeMaster ? <MasterScreen /> : <Navigate to={firstAllowedPath} replace />} />
          <Route path="/settings" element={<SettingsScreen />} />
          <Route path="*" element={<Navigate to={firstAllowedPath} replace />} />
        </Routes>
      </div>
    </div>
  );
}

function AppInner() {
  const { firebaseUser, loading, needsShopSetup } = useAuth();
  const location = useLocation();

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

  if (location.pathname.startsWith("/superadmin")) {
    return <SuperAdminScreen />;
  }

  if (needsShopSetup) {
    return (
      <div className="shell loggedout">
        <div className="main">
          <ShopSetupScreen />
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

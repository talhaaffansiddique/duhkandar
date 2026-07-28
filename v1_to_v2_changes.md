# Dukandar — v1 → v2 changes

This document tracks what's different between the version already built and deployed (v1, live at [dukhandar.netlify.app](https://dukhandar.netlify.app)) and the new mockup (v2, `dukandar_mockup_v2.html`). **v2 is mockup-only right now** — nothing below is live yet. Once the mockup is approved, development happens in a second phase.

## New: Super Admin panel

Not present in v1 at all. New in v2:

- A completely separate panel (mocked here as a "Switch to Super Admin view" toggle, since it's one HTML file) intended to run on its own subdomain — e.g. `admin.dukandar.app` — so shop owners/employees never see or reach it.
- **Overview**: total stores created, total users across all stores, stores active today.
- **Stores**: every store on the platform, its owner, user count, creation date; click a store to jump to its users.
- **Users**: every user across every store, with a **Reset password** action — either set a temporary password directly or send the user a password-reset email. This is the only place any password can be reset by someone other than the user themselves.

**Open question for development phase**: this needs its own authentication separate from shop owner/employee logins (a Super Admin can't just be "an Admin of a shop" — it's a platform-level role tied only to you). We'll need a dedicated Super Admin account, likely managed directly in Firebase rather than through the regular sign-up flow.

## New: POS (Point of Sale) screen

v1 had no dedicated selling screen — sales existed only as data shown in Reports/Dashboard. v2 adds:

- A product catalog (search + click-to-add) and a live cart.
- **Selling price is pulled from Inventory by default but is editable per line** in the cart, exactly as requested — a cashier can discount or adjust a price at the point of sale without changing the master Inventory price.
- **Customer name** field defaults to showing "Walk-in Customer" as placeholder text (native input behavior: it visually disappears the instant you click in and type, and reverts if you leave it blank) — no name is required, and the receipt always shows "Walk-in Customer" when it's left empty.
- **Payment methods**: Cash, Online, and Card. Card only appears if the store has "Accept card payments" turned on in Settings — some shops won't have card machines.
- **Checkout behavior**: the receipt preview (with a Print button) only appears *after* clicking Checkout — not before. The sale is recorded at that same moment, not when the receipt is closed or printed.

## Changed: Inventory warranty field

- v1: warranty was a single "months" number field, hard-capped at 12.
- v2: warranty is now a number **plus a unit selector (Months / Years)**, and the cap is removed entirely — a water heater with a 5-year warranty can now actually be entered as "5 Years" instead of being forced into months.

## New: Product variants

- v1 had no concept of variants — one row per product, one price, one stock count.
- v2 adds optional **Size** and **Colour** variants on the Add Product modal, each with its own stock count (e.g. a floor tile in three sizes and four colours becomes multiple variant rows under one product listing, rather than a dozen near-duplicate products).

## Changed: Sidebar / navigation chrome

- **Shop name now appears under "Dukandar"** in the sidebar, replacing the static "Shop & inventory" tagline — every shop sees its own name there, and it updates live if the business name is changed in Settings.
- **"Cloud-first · Firebase" removed** from the sidebar footer — that was an internal/dev detail that had no business being shown to shop staff.
- **Sign out moved out of the hamburger menu** and now sits directly below the signed-in email at the bottom of the sidebar, always visible.
- **Hamburger button removed entirely** from the top bar — it only ever held the Sign out action, which no longer needs a menu now that it's always visible.

## New: full mobile responsiveness

- v1's mockups and the deployed app were desktop-oriented; narrow screens just clipped the sidebar-based layout.
- v2 mockup adds a responsive layout: on narrow screens the left sidebar collapses into a bottom icon bar (matching the original "mobile bottombar" concept from the original migration spec), grids stack to a single column, and wide tables scroll horizontally inside their own card instead of blowing out the page.
- The mockup includes a **Desktop / Mobile preview toggle** (top strip) so this can be checked without resizing the browser window.

## Unchanged from v1

Dashboard drill-downs, Inventory table/Add-Product modal core fields, Purchases + weighted-average cost flow, Expense tracking, Reports (Financial/Inventory/Purchase tabs with sorting), Master (Users/Suppliers/Roles & permissions), Settings company/app toggles, dark/light theme, and the underlying Firebase + Cloudinary architecture all carry over unchanged into v2 — this is additive on top of what's already built and deployed.

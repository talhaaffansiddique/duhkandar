# MIGRATION & SYSTEM BOOTSTRAP PROMPT

Copy and paste the entire block below into the first prompt of your new AI assistant session to restore complete context.

```markdown
# Context Bootstrap: Dukandar Web & Mobile (v1.10)

You are Antigravity, an expert agentic coding assistant. We are developing "Dukandar", a responsive web and hybrid mobile retail POS & inventory management system. This session is a direct continuation of previous development.

---

## 1. Project Purpose & Tech Stack
* **Goal**: A lightweight, offline-first Point of Sale (POS) and inventory management tool for shop owners. It supports barcode/SKU scanning, tax/discount adjustments, supplier batches, weighted average cost accounting, user roles (Owner, Employee), local database caching, background cloud auto-syncing, receipt templates, and real Google OAuth.
* **Stack**:
  * **Frontend Core**: React 18, Vite, TypeScript, Lucide React icons.
  * **Styling**: Vanilla CSS with curated theme variables (light and dark mode).
  * **Database**: Dexie.js (wrapper for IndexedDB) providing transaction-safe offline storage.
  * **Mobile Wrapper**: Capacitor JS (generating native Android wrappers for building APKs).
  * **Hosting Target**: Netlify (supporting Single Page App routing).

---

## 2. Codebase Folder Structure & Architecture
The project structure is organized as follows:
```
dukandar-web-v1.10/
├── public/
│   ├── google-login.html          # Local fallback chooser with dynamic account history
│   └── google-oauth-callback.html # Official Google OAuth redirect callback page
├── src/
│   ├── assets/                    # Static branding icons & logos
│   ├── components/
│   │   └── CustomNumberInput.tsx  # Styled POS item increment/decrement controls
│   ├── db/
│   │   └── database.ts            # Schema definitions, Dexie setup, backup serializations, and Seeding Utilities
│   ├── hooks/
│   │   └── useTableSort.ts        # Client-side table column sorting hook
│   ├── styles/                    # Core themes, variables, components global CSS
│   ├── utils/
│   │   └── fileLogger.ts          # Startup registry printing file logs to console
│   ├── views/
│   │   ├── AuthScreen.tsx         # Login, registration, and Google Sign-In triggers
│   │   ├── DashboardScreen.tsx    # Sales/profit KPIs with charts (bar, column, pie)
│   │   ├── InventoryScreen.tsx    # Stock management, warranty rules, image galleries
│   │   ├── OfficeScreen.tsx       # Employee accounts and supplier registries
│   │   ├── PurchaseScreen.tsx     # Supplier invoice bookings, camera snapshots, image loads
│   │   ├── ReportsScreen.tsx      # Sales registers, refunds, PDF checkout confirmation
│   │   ├── SettingsScreen.tsx     # Subcategorized config, Google Client ID config, and Seed dummy triggers
│   │   └── SyncScreen.tsx         # Simulated Cloud backups and Google Drive synchronization
│   ├── App.tsx                    # Main navigation router (desktop sidebar / mobile bottombar)
│   └── main.tsx                   # React app bootstrap entry point
├── netlify.toml                   # SPA redirect rules for Netlify hosting
├── package.json                   # Dependency definitions
└── capacitor.config.json          # Capacitor JS mobile build configs
```

---

## 3. Knowledge Base: Key Files & Specific Roles

### Database Layer
* **[database.ts](file:///c:/Antigravity/Waseem%20shop/dukandar-web-v1.10/src/db/database.ts)**: Configures IndexedDB stores: `products`, `purchases`, `sales`, `expenses`, `users`, `suppliers`, `employees`, and `salaries`. Handles weighted average costs of goods dynamically when purchases are registered or deleted. Contains the `seedSanitaryDummyData` utility to populate exactly 10 sanitary items, 10 purchases, and 10 sales records.

### Application Layout & Navigation
* **[App.tsx](file:///c:/Antigravity/Waseem%20shop/dukandar-web-v1.10/src/App.tsx)**: Coordinates navigation views. Features a responsive desktop sidebar and a bottom navigation bar for mobile widths (APK WebView). Restricts visibility of **Purchases** and **Office Admin** screens to user roles `OWNER` or `ADMIN`. Sets up 4-hour interval loops for background cloud auto-syncs.

### Views & User Interfaces
* **[AuthScreen.tsx](file:///c:/Antigravity/Waseem%20shop/dukandar-web-v1.10/src/views/AuthScreen.tsx)**: Standard credential logins and Google Sign-In button. If a Google Client ID is configured in settings, opens the authentic Google OAuth dialog; otherwise launches a simulated selector that reads and populates historical logged-in accounts dynamically.
* **[SettingsScreen.tsx](file:///c:/Antigravity/Waseem%20shop/dukandar-web-v1.10/src/views/SettingsScreen.tsx)**: Restructured settings page. Left column: **Company Master** (branding name, addresses, base64 logo upload). Right column: **App Setting** (Receipt layouts, POS defaults, Google OAuth Client ID config, Version Feature checklist, and **Seed Sanitary Dummy Data** developer tools card). Shows a visual scrollable list of system file logs when file tracking is toggled active.
* **[InventoryScreen.tsx](file:///c:/Antigravity/Waseem%20shop/dukandar-web-v1.10/src/views/InventoryScreen.tsx)**: Stock details manager. Restricts warranty months inputs to a maximum of 12. Implements a 3-image product gallery upload system with click-to-enlarge lightboxes and a 5-second automatic slideshow cycle.
* **[PurchaseScreen.tsx](file:///c:/Antigravity/Waseem%20shop/dukandar-web-v1.10/src/views/PurchaseScreen.tsx)**: Records supplier batches and average unit prices. Attaches invoices via local file loaders, cloud URLs (Dropbox/Photos), or direct HTML5 camera capture (fallback when served via APK WebView).
* **[ReportsScreen.tsx](file:///c:/Antigravity/Waseem%20shop/dukandar-web-v1.10/src/views/ReportsScreen.tsx)**: Hosts POS sales histories. Intercepts checkout confirmation: pops up a checkout PDF preview container for printing. Only processes database sale registration upon user print confirmation; cancels transaction if they abort print.

### Utility & HTML entry points
* **[fileLogger.ts](file:///c:/Antigravity/Waseem%20shop/dukandar-web-v1.10/src/utils/fileLogger.ts)**: Stores file creation log registry which formats and logs system modifications to console.
* **[google-oauth-callback.html](file:///c:/Antigravity/Waseem%20shop/dukandar-web-v1.10/public/google-oauth-callback.html)**: Google redirect target. Fetches profile pictures and email details from Google Userinfo API (`oauth2/v3/userinfo`) using the URL hash access token.
* **[google-login.html](file:///c:/Antigravity/Waseem%20shop/dukandar-web-v1.10/public/google-login.html)**: Stored accounts dynamic selection template page.

---

## 4. Current Work In Progress (v1.10)
* **Goal**: Enable hosting on app.netlify.com and publish the website.
* **Status**: 
  * The web assets compile cleanly using Vite (`npm run build`).
  * `netlify.toml` has been configured at the root to route all requests to `/index.html` to prevent route errors on page reloads.
  * The native mobile APK wrapper has been successfully generated and compiled targeting Java 17: outputs to root as [dukandar_v1.10_mobile.apk](file:///c:/Antigravity/Waseem%20shop/dukandar_v1.10_mobile.apk).
* **Next Immediate Task**: Log in to Netlify CLI (`npx -y netlify-cli login`) or run production publish (`npx -y netlify-cli deploy --dir=dist --prod`) using a Personal Access Token or authorized session, and establish hosting for the live web POS client.

---

## 5. Coding Guidelines & AI Communication Rules
* **No Placeholders**: Write fully functional source codes. Do not write summary comments (e.g. `// ... rest of code unchanged`). Write complete files or exact contiguous replacements.
* **Role-Based Checking**: Keep core administrative controls (Purchases, Office settings) secured behind user roles (`isAdminOrOwner`).
* **Feature Reversibility**: Maintain the Settings checklist toggles. When an option is unchecked, the code must dynamically fall back to its legacy style/rules (e.g., hiding subcategory headings if `toggle_v108_settings_subcategories` is false).
* **Communication Style**: First state the plan of action, highlight file pathways using absolute markdown links, explain the rationale, and seek confirmations for major changes. Once approved, execute and compile to verify type safety.
```

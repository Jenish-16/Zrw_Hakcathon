# AssetFlow — Enterprise Asset & Resource Management System

A centralized ERP platform to **track, allocate, and maintain** an organization's physical assets and shared resources. Built for the Odoo Hackathon.

Any organization with equipment, furniture, vehicles, or shared spaces (offices, schools, hospitals, factories, agencies) can use AssetFlow to replace spreadsheets and paper logs with structured asset lifecycles, conflict-free resource booking, maintenance approval workflows, and audit cycles.

---

## ✨ Features (all fully working)

| # | Module | Highlights |
|---|--------|-----------|
| 1 | **Login / Signup** | Signup creates an *Employee* only — no self-elevation. Admin promotes roles. Forgot/Change password. |
| 2 | **Dashboard** | Real-time KPI cards, asset-status donut, overdue vs. upcoming returns, quick actions, recent activity. |
| 3 | **Organization Setup** (Admin) | 3 tabs — Departments (with hierarchy & heads), Asset Categories (custom fields), Employee Directory (the only place roles are assigned). |
| 4 | **Asset Registration & Directory** | Auto Asset Tags (`AF-0001`), search/filter, lifecycle states, per-asset allocation + maintenance history. |
| 5 | **Allocation & Transfer** | Double-allocation blocked with a "held by X → raise transfer" flow. Transfer approval re-allocates automatically. Returns with condition check-in. Overdue auto-flagging. |
| 6 | **Resource Booking** | Time-slot booking with strict overlap validation. Upcoming/Ongoing/Completed/Cancelled. Reschedule & cancel. |
| 7 | **Maintenance** | Approval workflow: Pending → Approved/Rejected → Technician Assigned → In Progress → Resolved. Asset status auto-syncs. |
| 8 | **Asset Audit** | Audit cycles (scope + auditors), Verified/Missing/Damaged marking, auto discrepancy report, cycle close updates asset statuses. |
| 9 | **Reports & Analytics** | Utilization, most-used vs idle, maintenance by category, nearing-retirement, department allocation, booking heatmap, CSV export. |
| 10 | **Activity Logs & Notifications** | Full audit trail + in-app notification bell (asset assigned, approvals, reminders, overdue, discrepancies). |

**Roles:** Admin · Asset Manager · Department Head · Employee — each with scoped, secure workflows.

---

## 🧱 Tech Stack

- **Frontend:** React 18 + TypeScript + Vite + Tailwind CSS + Recharts + lucide-react
- **Backend:** Node.js + Express + TypeScript + `@supabase/supabase-js`
- **Database:** Supabase (PostgreSQL)
- **Auth:** JWT + bcrypt, role-based access control

---

## 🚀 Getting Started

### 1. Prerequisites
- Node.js 18+ and npm
- A Supabase project (free tier is fine)

### 2. Install dependencies (from the project root)
```bash
npm install
```

### 3. Connect Supabase
Open **`server/.env`** and paste your Supabase project API credentials:

- Supabase → **Project Settings → API**
- `SUPABASE_URL` = your Project URL
- `SUPABASE_ANON_KEY` = the `anon` `public` key
- `SUPABASE_SERVICE_ROLE_KEY` = the `service_role` secret key (server only)

```env
SUPABASE_URL="https://your-project-ref.supabase.co"
SUPABASE_ANON_KEY="your-anon-public-key"
SUPABASE_SERVICE_ROLE_KEY="your-service-role-secret-key"
```
> The backend uses the **service role** key and is the only trusted client.

### 4. Create tables
Open Supabase → **SQL Editor** and run the contents of
**`server/supabase/schema.sql`** once. This creates all tables, enums,
triggers and the asset-tag function (replacing what Prisma migrations used to
do).

### 5. Seed demo data
```bash
npm run setup
```
This seeds a full demo organization via `@supabase/supabase-js`.

### 6. Run the app
```bash
npm run dev
```
- Frontend → http://localhost:5173
- API → http://localhost:4000

---

## 🔑 Demo Accounts

| Role | Email | Password |
|------|-------|----------|
| Admin | `admin@assetflow.com` | `Admin@123` |
| Asset Manager | `manager@assetflow.com` | `Password@123` |
| Department Head | `ithead@assetflow.com` | `Password@123` |
| Employee | `vikram@assetflow.com` | `Password@123` |

(The login screen has one-click buttons to fill these in.)

---

## 📜 Useful scripts (root)

| Command | Description |
|---------|-------------|
| `npm run dev` | Run API + client together |
| `npm run setup` | Seed demo data (run `server/supabase/schema.sql` first) |
| `npm run db:seed` | Re-seed demo data |
| `npm run build` | Production build of both apps |

---

## 🗂 Project structure
```
AssetFlow/
├── server/            # Express + supabase-js API
│   ├── supabase/      # schema.sql (run once in Supabase SQL Editor)
│   ├── seed.ts        # demo-data seed script
│   └── src/
│       ├── routes/    # one module per feature
│       ├── middleware/# auth + errors
│       ├── services/  # notifications, activity log, asset tags
│       └── lib/       # supabase client, env, shared enum types
└── client/            # React + Vite + Tailwind
    └── src/
        ├── pages/     # the 10 feature screens
        ├── components/# design system + layout
        ├── context/   # auth
        └── lib/       # api client, types, helpers
```

> **Note:** The backend talks to Supabase through the REST/`supabase-js` API
> using your `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`. Multi-step operations
> (allocation, return, transfer approval, maintenance transitions) run as
> sequential calls rather than a single database transaction.

# FPAMAS — React dashboard

A React + TypeScript rewrite of the FPAMAS dashboard (`fpam-real/dashboard`). It talks to the
same backend (`assetspatial-backend`) and runs alongside the existing site.

## Run it

```bash
npm install
npm run dev          # http://localhost:5173
```

By default it uses the live API at `https://fpambacend.onrender.com/api`. To point at a local
backend, copy `.env.example` to `.env.local` and set `VITE_API_BASE`
(e.g. `http://localhost:5000/api`). The backend already allows any `localhost` origin.

```bash
npm run build        # type-check + production build into dist/
npm run lint
```

## Serving it inside the public site (fpam-real)

The public pages (`index.html`, `login.html`, …) stay vanilla; after login they redirect to this
dashboard at **`/app/`** on the same domain. Same domain matters: the session lives in
`localStorage` (`as_token` / `as_user`), which browsers only share within one origin.

```bash
npm run build:embed      # builds into ../fpam-real/app with base /app/ and .env.embed
```

Then commit and push `fpam-real` (the `app/` folder is the built dashboard). In embedded mode:
- `login.html` redirects to `/app/dashboard` (MDA Agents to `/app/portal`)
- signed-out visits and **Log out** go to `/login.html` (`VITE_LOGIN_URL` in `.env.embed`)
- `fpam-real/vercel.json` rewrites `/app/*` to `/app/index.html` so deep links survive a refresh
- the old vanilla dashboard is untouched at `/dashboard/` as a fallback

Re-run `npm run build:embed` and commit `fpam-real/app` whenever this app changes. If the site
isn't on Vercel, add the equivalent rewrite (e.g. nginx `try_files $uri /app/index.html;` under
`/app/`). Running `npx vite build --base=/app/` directly from Git Bash mangles the path — use the
npm script.

## Revenue Management System — phase one (local prototype)

A working prototype of the RMS core revenue chain from the architecture documents, **stored only
in the browser's localStorage** — no backend calls, nothing shared between browsers. Run
`npm run dev` and open:

- **Staff:** sign in, then the sidebar's *Revenue (demo)* section (`/revenue`). Use **Acting as**
  at the top to switch between Revenue Officer, Valuer, two Committee members, Finance and Auditor.
- **Public:** `/properties` (no staff login). Demo customers: `amaka@example.com`,
  `sahel@example.com`, `ibrahim@example.com`, password `demo1234` — or register a new one.

The chain: revenue status on assets → valuation (committee-approved, immutable) → listing
(sale / lease / sealed-bid auction, price ≥ valuation) → public registration and application with
a Remita-RRR fee bill → close and open bids → evaluate and recommend → committee award (offer
letter) → customer accepts → demand notice → simulated Remita payment → receipt → ownership-transfer
or lease record and asset marked sold / leased.

Built in: money in integer kobo; double-entry, append-only, hash-chained ledger with a verifier
and trial balance; idempotent, signature-checked Remita callback handler (Billing → Payments has
Replay / Tamper buttons to show it); segregation of duties (no self-approved valuations, valuer
and evaluator can't approve the award); versioned fee schedules; audit trail. The seeded Kano
auction is past its closing date, so the evaluation → award → payment path can be walked
immediately. *Reset demo data* restores the seed.

Phase two (not built): instalments, recurring lease billing and escalation, penalties,
reconciliation against Remita settlement data, revenue dashboards, a real backend.

The code lives in `src/rms/` (data model, rules, store), `src/pages/revenue/` (staff) and
`src/pages/rms-public/` (customer portal). Routes come from `@rms-routes`. The embedded build
includes the RMS (`VITE_RMS=on` in `.env.embed`): staff at `/app/revenue`, public at
`/app/properties`. Set `VITE_RMS=off` to build without it — `vite.config.ts` then resolves
`@rms-routes` to `routes.off.tsx` and no RMS code ships. Even on the live site the data stays
in each visitor's own browser.

## What's ported

| Area | Status |
|---|---|
| Login, logout, session expiry → back to login | Done |
| Passwords — forgot-password email link (`/forgot-password`, `/reset-password`), change own password (key icon in the sidebar / portal header), admin reset with generated or chosen password and optional email, welcome email on create | Done (emails need SMTP set on the backend) |
| Sidebar layout, role-based nav, permission checks (`can('canEdit')` …) | Done |
| **Asset Registry** — search, all filters (kept in the URL), sorting, stats bar, pagination, row selection | Done |
| Registry actions — edit, delete, bulk delete, set condition, Excel/CSV bulk update, completeness report, deferred maintenance report | Done |
| Exports — filtered CSV/XLSX/GeoJSON/PDF, selected rows, percentage export | Done |
| **Asset View** — overview, photos (upload/delete), map, maintenance log, documents, valuation, condition history | Done |
| Asset View — components (link/unlink), lifecycle stages, inventory (inline edit, import, export), M&E reports, change log | Done |
| **M&E reports** — per-asset monthly progress reports (secretariat/NHP/custom tasks), ratings, CRA sign-off, report photos, clearance certificate (print) | Done (M&E division, Supervisors, System Admins) |
| **MDA portal** — separate screen for MDA Agents: submit the 17 compliance forms with attachments, drafts, FPAM remarks, certificate download | Done (MDA Agents are routed here automatically) |
| **Dashboard** — KPIs from the verified registry, pending-approval and inspection alerts, recent captures, activity feed, condition/type/30-day charts (each with a table view) | Done |
| **Live Map** — canvas markers coloured by condition, type/condition filters, legend, road/satellite, locate me, fit all, search, asset panel | Done (no 3D view yet) |
| **Approvals** — pending/approved/rejected queue, approve, reject with reason, re-approve rejected, no self-review, sidebar badge | Done |
| **Inspections** — open/overdue/awaiting-review/due views, schedule (also from Asset View), start, submit report, approve/reject, report & history view, assets due by schedule | Done |
| **Field Capture** — all fields incl. assessed/sector/area/next inspection, type-specific fields, GPS or click-the-map location, photos/documents/spreadsheets, inline validation | Done |
| **Users & roles** — list/search/filter, add, edit (all six roles), per-user allow/deny/default overrides, deactivate/reactivate, password reset, role-default matrix | Done (System Admin only) |
| **Audit log** — server-side paging, action/record type/ID/date filters, CSV export | Done |
| **Analytics** — page-wide filters (period, state, type, MDA), KPIs, data-driven findings, trend/condition/type/state/MDA/geometry charts with table views, spend and value tables, print | Done |
| **Form requests** — all 17 form types from shared definitions, review (under review/defer/reject/approve with remarks), attachments, certificate issue with the number on the PDF, download, physical-copy tracking, new request for an MDA | Done |
| **OCR** — scan, poll, extracted text, suggested fields, hand-off to Field Capture | Done |
| **Excel import** — column auto-matching, defaults, per-row validation, bulk asset creation with progress and CSV report; attach a sheet to an asset | Done |
| **File database** — every photo/document/spreadsheet across assets, filter, search, open, download, delete, photo grid | Done |
| **Settings** — platform settings and feature toggles; MDA list with add/edit/deactivate/reactivate/CSV import | Done (System Admin to edit) |
| **Guidelines** — legacy content and PDFs | Done |

## Layout

```
src/
  api/          client.ts (fetch wrapper, auth header, errors), assets.ts (endpoints)
  auth/         AuthContext (user, login/logout, can()), permissions.ts (role defaults)
  components/   Layout/sidebar, Modal, Toast, Tags, AuthedImage
  lib/assets.ts enums mirrored from the backend schema, risk score, completeness, formatting
  pages/
    registry/   RegistryPage + modals, URL-backed filters (useRegistryFilters)
    asset-view/ AssetViewPage + tabs
```

Notes:
- Photos and documents are behind Bearer auth, so they're fetched as blobs (`AuthedImage`).
- Permission checks in the UI only hide controls; the backend is what actually enforces them.
- Enum lists in `lib/assets.ts` must stay in sync with `assetspatial-backend/src/models/Asset.js`.
- Phone layout: page-level grids use `minmax(0,1fr)` so wide content can't push the page sideways;
  keep that pattern when adding grids.
- Relies on the backend fixes now on `main` (approval rules, inspection scheduling, permission
  guards, capture fields, M&E photo links). Deploy the backend before this app.

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

## What's ported

| Area | Status |
|---|---|
| Login, logout, session expiry → back to login | Done |
| Sidebar layout, role-based nav, permission checks (`can('canEdit')` …) | Done |
| **Asset Registry** — search, all filters (kept in the URL), sorting, stats bar, pagination, row selection | Done |
| Registry actions — edit, delete, bulk delete, set condition, Excel/CSV bulk update, completeness report, deferred maintenance report | Done |
| Exports — filtered CSV/XLSX/GeoJSON/PDF, selected rows, percentage export | Done |
| **Asset View** — overview, photos (upload/delete), map, maintenance log, documents, valuation, condition history | Done |
| Asset View — relationships, lifecycle, audit, inventory, M&E tabs | Not yet |
| **Dashboard** — KPIs from the verified registry, pending-approval and inspection alerts, recent captures, activity feed, condition/type/30-day charts (each with a table view) | Done |
| **Live Map** — canvas markers coloured by condition, type/condition filters, legend, road/satellite, locate me, fit all, search, asset panel | Done (no 3D view yet) |
| **Approvals** — pending/approved/rejected queue, approve, reject with reason, re-approve rejected, no self-review, sidebar badge | Done |
| Capture, Inspections, Analytics, Users, Form Requests, OCR, Excel Import, File DB, Audit, Settings, Guidelines | Placeholder pages linking to the legacy dashboard |

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
- The new export endpoints (filtered export, `POST /assets/export/bulk`) need the backend branch
  `fix/asset-registry-audit` deployed.

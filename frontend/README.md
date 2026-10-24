# VanaDrishti AI — Forest Loss Monitoring & Early Warning

A responsive, frontend-only demonstration of a forest-loss monitoring and early-warning workspace. VanaDrishti AI shows how study-area setup, a simulated Sentinel-2 analysis workflow, result review, reporting, team administration and preferences can fit into one interface.

> **Demo notice:** every run, detection, boundary, report, notification, team member and email in this application is illustrative sample data. The app does **not** download Sentinel-2 imagery, run a detection model, authenticate users, send invitations or persist anything to a server. Nothing shown here is a real satellite-analysis result.

## Stack

- React 18 + Vite 6, JavaScript (no TypeScript)
- React Router DOM for the seven workspace routes
- Context API + `localStorage` for the demo data layer
- Leaflet / React-Leaflet with Esri World Imagery and OpenStreetMap tiles
- Recharts for trend and distribution charts
- Lucide React icons, date-fns date formatting
- jsPDF for client-side PDF generation
- Custom CSS design system (no UI framework)

## Getting started

Requires Node.js 18+ (developed with Node 24).

```bash
npm install
npm run dev       # http://localhost:5173
```

Production build and local preview:

```bash
npm run build
npm run preview
```

## Routes

| Route | Purpose |
| --- | --- |
| `/dashboard` | Workspace overview with filters, illustrative study-area map, layer toggles, before/after views, vegetation indices, classification summary and loss trend |
| `/study-area` | Dependent state → district → region selection, boundary preview, saved areas and boundary export |
| `/analysis` | Analysis parameters and a simulated seven-stage workflow that creates locally generated demo findings |
| `/results` | Filterable, searchable, sortable and paginated findings; result detail map; CSV and GeoJSON exports |
| `/reports` | Report filters, local report generation and preview, client-side jsPDF downloads, download statistics and Recharts analytics |
| `/settings` | Account demo, notification toggles, map preferences, data/integration reference and system actions |
| `/team` | Fictional team directory with add/edit/remove flows, search, role filter, pagination, project overview and local activity |
| `*` | Accessible 404 page with a return path |

`/` redirects to `/dashboard`.

## Feature notes

- **Simulated analysis:** starting a run advances through cloud masking, temporal compositing, seasonal baseline, model detection, post-processing, validation and reporting stages. Results are generated locally from transparent rules and are labelled as illustrative demo output.
- **Intended data source:** optical Sentinel-2 Level-2A surface-reflectance imagery (no Sentinel-1 radar data is used anywhere in the app).
- **Exports:** CSV exports use an Excel-friendly UTF-8 BOM; GeoJSON exports contain clearly marked demonstration geometry; PDF reports are generated entirely in the browser; Settings provides a JSON backup and user-data export.
- **Team records:** all names and email addresses are fictional. Adding or editing a member only changes this browser — no invitation, account or permission is created.
- **Password form:** input validation is demonstrated only; no password is stored or changed.
- **Delete account:** shows an explicit confirmation modal explaining that no server account exists and no local data is removed. It is intentionally a no-op beyond the modal.
- **Reset demo data:** Settings → System can clear saved areas, generated runs/results, report and team changes and restore the seed dataset.
- **External imagery:** basemap tiles are loaded from Esri and OpenStreetMap. If tiles are unavailable, the rest of the interface and all demo interactions still work.

## Local data

Demo state is stored in `localStorage` with the prefix `vanadrishti.`:

`profile`, `preferences`, `notificationPrefs`, `savedAreas`, `analysisRuns`, `generatedResults`, `reports`, `teamMembers`, `activities`, `notifications`.

Clearing browser storage or using **Reset Demo Data** restores the seed values. There is no server-side persistence, authentication or multi-user synchronization.

## Project structure

```text
public/assets/             Logo, favicon, sample imagery
src/components/            Layout, common UI kit, charts, forms and maps
src/context/AppContext.jsx State container over the demo services
src/data/                  Seed areas, runs, results, reports, team, notifications
src/pages/                 Seven route pages plus NotFound
src/services/              Demo data services and the backend API contract helper
src/styles/                global.css, layout.css, components.css, pages.css
src/utils/                 Storage, formatting, CSV/GeoJSON/PDF and download helpers
```

## Preparing for a Flask / FastAPI backend

The interface runs entirely on local demo services today. `src/services/api.js` provides the integration seam:

- `VITE_API_BASE_URL` — base URL of the future backend (set at build time in `.env`)
- `API_ENDPOINTS` — shared endpoint paths
- `apiRequest()` — JSON fetch wrapper with timeout and error handling
- `checkApiHealth()` — used by Settings → Data & Integration → Test Backend Connection

Example `.env`:

```dotenv
VITE_API_BASE_URL=http://localhost:8000
```

Contract exposed in Settings:

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/health` | Service health check |
| `GET` | `/api/study-areas` | Study-area catalogue and boundaries |
| `POST` | `/api/analysis/run` | Queue an analysis run |
| `GET` | `/api/analysis/runs` | List analysis runs and statuses |
| `GET` | `/api/results` | Fetch findings for a run |
| `GET` | `/api/reports` | List generated reports |
| `POST` | `/api/reports/generate` | Request a server-rendered report |

The frontend currently performs no satellite processing. A backend implementation would own imagery access, cloud masking, compositing, model inference, storage, authentication and report generation. Once endpoints exist, replace the demo service functions (or add a configured API branch) rather than calling `fetch` directly from components. Enable CORS for the frontend origin and keep credentials/secrets out of the browser bundle.

## Accessibility and responsiveness

- Landmark regions, labelled controls, ARIA tabs, live-region toasts and a skip link are included.
- Tables, filters, the off-canvas sidebar and tabs adapt across desktop, tablet and mobile widths.
- Wide result tables scroll inside their cards instead of overflowing the page.
- Keyboard activation is supported for sortable columns and interactive table rows.

## Limitations

This is a demonstration frontend, not an operational monitoring system. It does not include real authentication, backend persistence, imagery acquisition, geospatial accuracy guarantees, model validation or email/notification delivery. All map polygons, classifications, confidence values, dates and metrics are illustrative.

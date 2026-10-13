# Med Match Client Dashboards

Healthcare workforce dashboards for credentialing, licence expirations, recruiting and onboarding. Every number on screen is calculated from the data, never hard-coded.

Each client has two data sources, switched in the sidebar (or Settings):

- **Demo data (default).** A fully editable workspace: edit any cell, add and delete rows, complete credentialing steps, change the target days. Everything updates instantly and is saved **in your browser only**, so it is safe to show to anyone. Needs no setup.
- **Google Sheet (live).** The app reads the client's sheet directly through the Google Sheets API (no CSV export, no import step), read-only. Needs the setup below.

Also included: global provider search (press `/`), provider profile drawer, credentialing board, notifications panel, search / filter / sort / pagination / CSV export on every table, undo for edits, and a Settings page.

**Stack:** Next.js (App Router, Cache Components) · TypeScript · Tailwind CSS 4 · Recharts · Google Sheets API via a read-only service account. Deploys to Netlify.

> All data in the sample sheet is invented. There is no real provider or patient data in this project.

## Connect a new client sheet (under 5 minutes)

You only need to do **1** once per Google Cloud project; after that, every new client is steps 2 to 4.

1. **One-time: create the service account**
   - In [Google Cloud Console](https://console.cloud.google.com/) create or pick a project and enable the **Google Sheets API**.
   - *IAM & Admin → Service accounts → Create*. Then *Keys → Add key → JSON* and download the file.
   - Put two values from that file into your environment (`.env.local` locally, Netlify env vars when deployed):
     - `GOOGLE_SERVICE_ACCOUNT_EMAIL` = `client_email`
     - `GOOGLE_PRIVATE_KEY` = `private_key` (keep the `\n` sequences; wrap in quotes)
2. **Share the client's sheet** with the service account email as **Viewer**. (Viewer is enough: the app only ever asks for the read-only scope.)
3. **Copy the sheet ID**: the long string in the URL, `docs.google.com/spreadsheets/d/`**`THIS_PART`**`/edit`.
4. **Add it to `CLIENTS`**:
   ```
   CLIENTS=[{"name":"Riverbend Medical Group","sheetId":"1AbC..."},{"name":"Lakeview Surgery Center","sheetId":"1XyZ..."}]
   ```
   Each entry appears in the sidebar client switcher. The URL slug is made from the name (`/riverbend-medical-group`); add `"id":"riverbend"` to an entry to choose your own. Redeploy (or restart) after changing environment variables.

The sheet needs these six tabs with exactly these names, and column headers in row 1 (order doesn't matter, header case doesn't matter). If anything is wrong the dashboard tells you which tab or column, and which service account to share with.

| Tab | Columns |
| --- | --- |
| **Providers** | `id`, `name`, `credential` (MD/RN/CRNA/NP), `specialty`, `location`, `status` (Ready / In credentialing / Onboarding) |
| **Credentialing** | `provider_id`, `step` (1-4: Application, Verification, Payer enrollment, Privileges), `started_date`, `completed_date`, `waiting_on`, `waiting_on_provider` (yes/no) |
| **Expirations** | `provider_id`, `item` (licence, DEA, board cert, malpractice, BLS/ACLS), `expiry_date` |
| **Roles** | `title`, `location`, `specialty` (optional), `opened_date`, `applied`, `screened`, `submitted`, `interview`, `offer` |
| **Onboarding** | `provider_id`, `start_date`, `steps_done`, `steps_total`, `next_step` |
| **Config** | `client_name`, `target_days_to_credential` (row 1 headers, row 2 values) |

Two columns go beyond the brief, on purpose:

- **`completed_date`** (Credentialing, blank while a step is open). Credentialing has one row per provider per step. Without a completion date there is no way to calculate "finished within target", "avg days to credential" or "where the days go" from the sheet. A provider is *finished* when all four steps have a completed date.
- **`specialty`** (Roles, optional). Lets the specialty filter apply to recruiting. Leave it blank for roles that apply to everyone (e.g. front desk).

Dates can be real date cells or `YYYY-MM-DD` text. Rows that can't be read (unknown `provider_id`, bad date, unknown status) are skipped and listed under "sheet notes" in the Data source card instead of silently disappearing.

## Run it locally

```bash
npm install
npm run dev        # http://localhost:3000, opens straight into the demo workspace
```

No environment variables are needed for the demo. For realistic speed use `npm run build && npm start`; `npm run dev` is noticeably slower.

To enable the live source, copy `.env.example` to `.env.local`, fill in the credentials and `CLIENTS`, restart, and choose **Google Sheet** in the sidebar.

### Build the sample "Riverbend tracker" sheet

```bash
npm run seed -- --dry-run      # preview the data, no Google calls
SEED_SHARE_WITH=you@example.com npm run seed
```

This creates a new sheet (24 providers across North Clinic, Downtown ASC and Lakeside Practice) as the service account and shares it with you, then prints the `CLIENTS` line to use. Dates are generated relative to today, so re-run it to get a fresh sheet. (The built-in demo workspace is generated the same way, and **Reset demo data** rebuilds it.) If your Google Workspace blocks service accounts from creating files, create an empty sheet yourself, share it with the service account as **Editor**, and run with `SEED_SPREADSHEET_ID=<id>` instead. The seed script writes with the service account's full Sheets/Drive scopes; the running app never does.

## How live data works

- The sheet is fetched **server-side on every page load**.
- The browser then re-reads it **every 5 minutes** (and when a tab returns to the foreground after longer than that), and the **Refresh now** button forces an immediate re-read.
- Server-side reads are cached for **at most 60 seconds** (`lib/get-sheet-data.ts`: fresh for 30s, then served while a background refresh runs, never older than 60s). *Refresh now* expires that cache first. In serverless hosting the in-memory cache may not be shared between instances, so reads are often even fresher; the 60s ceiling still holds.
- The sidebar shows `Connected · synced X min ago`, an `Open the sheet` link, and a visible notice if a refresh fails (the last good data stays on screen).
- Only sheet IDs listed in `CLIENTS` can be read. The browser never supplies a sheet ID.

## What the numbers mean

All calculations are in `lib/metrics.ts` and use only sheet data, today's date, and `target_days_to_credential`.

| Card | Calculation |
| --- | --- |
| Ready to work X of Y | Providers with status *Ready* out of all providers in the current filter |
| In credentialing | Providers with status *In credentialing*; "past target" = days since their first step started > target |
| Finished within target | Of files whose 4th step finished in the last 90 days, the share that took ≤ target days (first step start to last step finish) |
| Avg days to credential | Average of that same group; the note shows the previous 90 days for comparison |
| Expiring in 60 days | Expiration items due in ≤ 60 days, **including any already expired** |
| Waiting on provider | In-credentialing providers whose open step has `waiting_on_provider = yes` |
| Where the days go | Average length of every finished step, per step (all history in the filter) |
| Needs attention | Rules: item expired / due ≤ 30 days · file open > target days · providers waiting on documents · role open > 60 days |

The Licences & expirations badge counts items due within 30 days, including expired ones. Location and specialty filters apply to every card, chart, table and badge. Roles have no provider, so they follow the location filter and the optional `specialty` column.

## Deploy to Netlify

1. Push the repo and import it in Netlify. `netlify.toml` already sets the build command and Node 22; Netlify's Next.js runtime is added automatically.
2. Add `GOOGLE_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_PRIVATE_KEY` and `CLIENTS` under *Site configuration → Environment variables*. Mark the key as a secret. Never commit it: `.env*` is git-ignored.
3. For a shareable demo with no Google setup, deploy with no environment variables at all.
4. Optional: `SAMPLE_DATA_BADGE=false` hides the "Sample data" badge for real client data.

Environment variables are read on the server only; none are exposed to the browser.

## Project layout

```
app/[client]/…        one route per nav page; layout reads the sheet and wraps everything in the provider
app/actions.ts        server actions for the 5-minute poll and "Refresh now"
lib/google-sheets.ts  Sheets API client (service account, read-only scope)
lib/parse-sheet.ts    rows -> typed data, with warnings for bad rows
lib/metrics.ts        every dashboard number
lib/seed-data.ts      fake data used by `npm run seed` and the local sample
components/…          shell (sidebar / mobile menu), overview, charts (Recharts), table pages
```

Built with Next.js 16 and Cache Components; see `AGENTS.md` for the note about this version's differences.

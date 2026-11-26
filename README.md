# Cendol Satay

Melaka news, business directory and civic reports. One Laravel API serves the public site, the admin panel and (later) the mobile app.

| Folder | What it is | Local address |
| --- | --- | --- |
| `backend/` | Laravel 13 API (`/api/v1`), MySQL/MariaDB | http://localhost:8000 |
| `web/` | Public site, Next.js 16 + Tailwind | http://localhost:3000 |
| `admin/` | Admin panel, Next.js 16 + Tailwind + shadcn/ui | http://localhost:3001 |
| `packages/ui/` | Design tokens (colours, fonts) shared by both front ends | |
| `packages/api-client/` | Typed API client shared by web, admin and later mobile | |
| `brand/` | Logo files and their source (`logo-source.html`) | |
| `docs/` | Product blueprint | |

## First-time setup (Windows + XAMPP)

Needs PHP 8.3+, Composer, Node 22+, and XAMPP's MySQL/MariaDB running.

```powershell
# 1. API
cd backend
composer install
copy .env.example .env
php artisan key:generate
```

Create a database called `cendol_satay` (phpMyAdmin or `mysql -uroot -e "CREATE DATABASE cendol_satay CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"`), then in `backend/.env` set the `DB_*` values and the first super admin:

```
SEED_ADMIN_EMAIL=you@example.com
SEED_ADMIN_PASSWORD=choose-a-long-password
```

```powershell
php artisan migrate --seed
cd ..

# 2. Front ends (one install for both, from the repo root)
npm install
copy web\.env.example web\.env.local
copy admin\.env.example admin\.env.local
```

## Running it

Three terminals, from the repo root:

```powershell
npm run dev:api
npm run dev:admin
npm run dev:web
```

Sign in at http://localhost:3001 with the `SEED_ADMIN_*` account. Super admins must turn on two-step sign-in first (any authenticator app).

Locally, emails (sign-up codes, password resets) are written to `backend/storage/logs/laravel.log` instead of being sent. Set `MAIL_*` in `backend/.env` to send real email.

## Checks

```powershell
npm run test:api
npm run typecheck
npm run lint
```

## Conventions

- **Class names:** every block gets a readable, hyphenated name before its Tailwind classes, e.g. `class="news-card is-breaking flex flex-col gap-3"`. States use `is-` / `has-`. No inline `style`, no CSS Modules (they hash class names), no `next/font` (same reason; fonts come from `@fontsource` via `packages/ui`).
- **Messages:** the API answers every error as `{ message, code }`. `message` is written for people and goes straight into a toast; `code` is for the front end to react to.
- **Pages over popups:** create/edit forms are full pages. Popups are only for confirmations.
- **Every tab is a route:** `/users/{id}/security`, `/settings/audit`, `/account/security`.
- **Listings:** use `admin/src/components/data-listing/data-listing.tsx`. It gives search, filters, sorting, bulk actions, per-page and pagination, all kept in the address bar.

## News

- **Newsroom** (admin › Newsroom): journalists write drafts, a verifier fact-checks (never their own story), an editor publishes or schedules. Breaking news can go live first as "Developing". Changes to a live story need a note; ticking "This corrects a fact" shows the note under the story.
- **Roles:** Journalist (`news.write`), Verifier (`news.verify`), Editor (`news.edit_any`, `news.publish`, `news.delete`, `news.categories`).
- **Pictures** are saved as three WebP sizes in `backend/public/media/` (back it up with the database).
- **Public site caching:** pages are cached for a minute. After a story changes, the API asks the site to refresh straight away. Set the same secret in `web/.env.local` (`REVALIDATE_SECRET`) and `backend/.env` (`WEB_REVALIDATE_SECRET`), and point `WEB_REVALIDATE_URL` at the site's `/api/revalidate`.
- **Sample stories for local testing** (never in production):

```powershell
php artisan db:seed --class=DemoNewsSeeder
```

## Places (Peta Melaka)

- **Public site:** `/places` (list beside a map, filters, open now, near me), `/places/{sector}/{name}`, `/map`. Signed-in readers write reviews, claim a place or suggest one; owners manage their listing under `/business`.
- **Admin › Places:** places, sectors (each with its own detail fields), ownership claims, and review queues (to check, reported). Settings › Places sets the check-in distance, reviews per day and blocked words.
- **Roles:** Moderator (`directory.manage`, `directory.claims`, `reviews.moderate`). Owners get the Business owner role when their claim is approved.
- **Reviews need proof of a visit:** a check-in within 150 m shows at once; a receipt photo waits for a moderator. Receipts and claim documents are private (`backend/storage/app/private/directory/`); receipts are deleted 90 days after the check by the daily schedule.
- **Maps:** Leaflet with OpenStreetMap tiles, all in `packages/map` (`MapView`). Set `NEXT_PUBLIC_MAP_TILE_URL` to use another tile provider; the address search for staff is `backend/app/Services/Directory/Geocoder.php`. OpenStreetMap's free tiles are fine for testing and light use; move to a paid tile provider or Google Maps before heavy traffic.
- **Sample places for local testing** (never in production; every name ends in "(sample)"):

```powershell
php artisan db:seed --class=DemoPlacesSeeder
```

## Civic reports and alerts

- **Public site:** signed-in readers report from `/report` (pin on the map or "use my location", type, time, photos, videos, voice notes or PDFs) and follow their reports under `/account/reports`. Verified alerts are at `/alerts`.
- **Admin › Reports:** the verifier queue (to check, waiting for reporter, checking, mine, alerts, decided), each report with overview, decide, evidence, alert, timeline, police handover and activity tabs. Incident types and Settings › Reports (limits, retention, reference prefix, default police station).
- **Roles:** Verifier (`incidents.view`, `incidents.verify`, `incidents.export`); Admin also has `incidents.types`. Nobody can decide a report they sent themselves.
- **Evidence:** original files are kept unchanged in `backend/storage/app/private/incidents/` (back it up with the database) with a SHA-256 taken on arrival, camera details and the uploader's IP. Every time staff open a file or download a pack it goes in the audit log. Files from rejected and withdrawn reports are deleted after the retention period (default 180 days) unless they were handed to the police.
- **Public alerts** show only what staff wrote and the blurred photos they upload. The reporter's own words, files and contact details never reach the public site; readers who tick "Hide my name" show as "A Cendol Satay reader".
- **Police handover:** the Handover tab builds a ZIP with a summary PDF, the original files and `manifest.txt` (check with `sha256sum -c manifest.txt`), and logs the officer, station and police report number.
- **Emails to reporters** link to the public site: set `WEB_URL` in `backend/.env`.
- **Sample reports for local testing** (never in production; every title ends in "(sample)"):

```powershell
php artisan db:seed --class=DemoIncidentsSeeder
```

## Finance (invoices and bookkeeping)

In the admin under **Finance**. Fill in **Settings › Company** (name, SSM number, address, bank account) before issuing real invoices; those details print on every document.

- Money is stored as whole sen (`RM 12.50` = `1250`) so totals never drift.
- Issued invoices, receipts and credit notes never change. Mistakes are fixed with a credit note or by voiding the invoice, and numbers never skip.
- PDFs come from `backend/resources/views/billing/` (dompdf, A4). Reports also export as CSV for the accountant.
- Expense bills are stored privately in `backend/storage/app/private/billing/`. Back this folder up with the database.
- The **Finance** role prepares and prints. Confirming payments, voiding and credit notes need the `billing.approve` permission.

## Going live on cPanel

- **API:** upload `backend/`, point a subdomain (e.g. `api.yourdomain.my`) at `backend/public`, set `.env` (`APP_ENV=production`, `APP_DEBUG=false`, database, `CORS_ALLOWED_ORIGINS`, mail), run `composer install --no-dev`, `php artisan migrate --force`, `php artisan config:cache route:cache`.
- **Cron (every minute):** `php /home/USER/backend/artisan schedule:run >> /dev/null 2>&1` (runs queued emails and clean-ups).
- **Public site and admin:** each runs as its own app under *Setup Node.js App* (`npm run build`, then start `next start`). The admin has per-person pages like `/users/{id}/profile`, so it needs a Node app too rather than plain static files.

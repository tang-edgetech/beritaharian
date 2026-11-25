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

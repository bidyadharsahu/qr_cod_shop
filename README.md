## QR Coasis Shop

Production-ready QR restaurant ordering app (customer + admin) built with Next.js and Supabase.

## Required Environment Variables

Set these in Vercel Project Settings -> Environment Variables:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

Optional (for human-like AI chatbot wording while preserving existing order logic):

- `OPENROUTER_API_KEY`
- `OPENROUTER_MODEL` (default: `meta-llama/llama-3.3-8b-instruct:free`)
- `NEXT_PUBLIC_SITE_URL` (for API referer header)

If `OPENROUTER_API_KEY` is not set, chatbot still works with deterministic local intent logic.

Optional (for online payments):

- Stripe Card Checkout:
	- `STRIPE_SECRET_KEY`
	- `STRIPE_WEBHOOK_SECRET` (for webhook backup verification)
- PayPal Checkout:
	- `PAYPAL_CLIENT_ID`
	- `PAYPAL_CLIENT_SECRET`
	- `PAYPAL_MODE` (`sandbox` or `live`, default is sandbox)
	- `PAYPAL_WEBHOOK_ID` (for webhook backup verification)
- Optional for server payment redirects:
	- `SUPABASE_SERVICE_ROLE_KEY`

Required for secure Central Admin server APIs:

- `SUPABASE_SERVICE_ROLE_KEY`
- `CENTRAL_ADMIN_USERNAME`
- `CENTRAL_ADMIN_PASSWORD`
- `CENTRAL_ADMIN_SESSION_SECRET`

Local development fallback only (not for production):

- `NEXT_PUBLIC_CENTRAL_ADMIN_USERNAME` (defaults to `owner`)
- `NEXT_PUBLIC_CENTRAL_ADMIN_PASSWORD` (defaults to `owner123`)

If payment keys are not set, cash flow remains fully working and online buttons show a graceful unavailable message.

Webhook endpoints to configure in provider dashboards:

- Stripe: `/api/payment/webhook/stripe`
- PayPal: `/api/payment/webhook/paypal`

## Database Upgrades

Run these SQL files in Supabase SQL editor:

1. `ADD_MENU_IMAGE_COLUMN.sql`
2. `ADD_SAMPLE_MENU_PHOTOS.sql`
3. `ADD_PAYMENT_EVENT_AUDIT_TABLE.sql`
4. `ADD_APP_SETTINGS_TABLE.sql`

After this, admins can edit each dish photo URL from the menu modal. Chatbot/menu cards update live via realtime sync.

The payment audit table powers the admin payment timeline panel, including checkout creation, verify attempts, webhook events, and cash-payment records.

The app settings table stores company branding (business name, subtitle, logo URL, and logo hint) used by the admin dashboard and printable reports.

## Multi-Tenant SaaS Setup

This app now supports multi-restaurant tenancy in one deployment.

Run:

1. `MIGRATE_MULTI_TENANT.sql`
2. `ENFORCE_MULTI_TENANT_RLS.sql` (recommended for tenant isolation)

This migration:

- creates `restaurants` and `restaurant_staff`
- adds `restaurant_id` to tenant tables
- backfills existing data to default tenant
- seeds default tenant staff users
- adds tenant-safe unique constraints and realtime coverage

Central admin login:

- URL: `/central/login`
- server-authenticated role: `super_admin`
- production credentials are read from:
	- `CENTRAL_ADMIN_USERNAME`
	- `CENTRAL_ADMIN_PASSWORD`
	- `CENTRAL_ADMIN_SESSION_SECRET`

From central admin (`/central`), you can:

- create restaurant tenants
- assign plan (`basic` / `premium`)
- activate or disable tenants
- monitor tenant usage and revenue snapshots

Restaurant staff login (`/admin/login`) is tenant-aware and supports:

- manager
- chef
- restaurant_admin

QR links now include `restaurant` in the query string so chatbot/menu/order/payment flow resolves the correct tenant context.

## Local Run

```bash
npm install
npm run dev
```

## Production Build

```bash
npm run build
```

## Notes

- Customer order flow remains deterministic for add/remove/checkout.
- Admin realtime updates remain unchanged.
- AI API only rewrites message tone to feel more natural and human.

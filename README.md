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

If payment keys are not set, cash flow remains fully working and online buttons show a graceful unavailable message.

Webhook endpoints to configure in provider dashboards:

- Stripe: `/api/payment/webhook/stripe`
- PayPal: `/api/payment/webhook/paypal`

## Database Upgrade For Dish Photos

Run these SQL files in Supabase SQL editor:

1. `ADD_MENU_IMAGE_COLUMN.sql`
2. `ADD_SAMPLE_MENU_PHOTOS.sql`
3. `ADD_PAYMENT_EVENT_AUDIT_TABLE.sql`

After this, admins can edit each dish photo URL from the menu modal. Chatbot/menu cards update live via realtime sync.

The payment audit table powers the admin payment timeline panel, including checkout creation, verify attempts, webhook events, and cash-payment records.

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

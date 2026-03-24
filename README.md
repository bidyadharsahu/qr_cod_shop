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

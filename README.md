# Nashville Buys

A free for-sale-by-owner listing hub for Nashville, TN, with a vetted vendor directory. Operated by Ownvista.

Nashville Buys is a marketplace connector only. It is not a broker, does not hold funds, does not facilitate closings, and does not give legal or pricing advice.

## Stack

Next.js (App Router) · Tailwind CSS · Supabase (auth, Postgres, storage) · Resend · Cloudflare Turnstile · Vercel Analytics

## Local development

Requires Node.js 20.9 or newer.

```bash
cp .env.example .env.local   # fill in values
npm install
npm run dev
```

Open http://localhost:3000.

See `SETUP.md` for accounts, environment variables, and DNS records.

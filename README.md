# MYSAT App

Next.js app for SAT-style practice, result tracking, subscriptions, and admin test uploads.

## Local Setup

```bash
npm install
npx prisma generate
npm run dev
```

Open http://localhost:3000 after the dev server starts.

## Required Environment

```bash
DATABASE_URL="postgresql://..."
AUTH_SECRET="..."
NEXT_PUBLIC_APP_URL="http://localhost:3000"
NEXT_PUBLIC_SUPABASE_URL="https://..."
SUPABASE_SERVICE_ROLE_KEY="..."

TELEGRAM_BOT_TOKEN="..."
TELEGRAM_PAYMENT_CHAT_ID="..."
TELEGRAM_ADMIN_URL_SAT="https://mysat-omega.vercel.app"
```

`TELEGRAM_*` variables are optional for local development. Without them, payment requests are still saved, but Telegram notifications are skipped. `TELEGRAM_ADMIN_URL_SAT` is preferred for MYSAT notifications; `TELEGRAM_ADMIN_URL` is still accepted as a fallback for older deployments.

## Manual Payments

The Premium page uses a manual transfer workflow:

1. The user transfers the monthly amount to the HUMO card shown on `/dashboard/subscription`.
2. The user uploads a receipt with `POST /api/payments/manual/request`.
3. The receipt is stored in the private Supabase Storage bucket `mysat-payment-receipts`.
4. Telegram receives a notification if bot secrets are configured.
5. An admin reviews the request in `/admin` and approves or rejects it.
6. Approval creates a `Payment` and activates a 30-day `Subscription`.

## Database

Apply migrations before running in production:

```bash
npx prisma migrate deploy
```

For local development:

```bash
npx prisma migrate dev
```

## Checks

```bash
npm run lint
npx tsc --noEmit
npm run build
```

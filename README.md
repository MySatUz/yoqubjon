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
NEXTAUTH_URL="http://localhost:3000"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
NEXT_PUBLIC_SUPABASE_URL="https://..."
SUPABASE_SERVICE_ROLE_KEY="..."

TELEGRAM_BOT_TOKEN="..."
TELEGRAM_PAYMENT_CHAT_ID="..."
TELEGRAM_ADMIN_URL_SAT="https://mysat-omega.vercel.app"
TELEGRAM_ADMIN_IDS="123456789,987654321"
TELEGRAM_WEBHOOK_SECRET="optional-random-secret"

ENABLE_MOCK_PAYMENTS="false"
SEED_ADMIN_PASSWORD="only-needed-when-running-prisma-seed"
```

`TELEGRAM_BOT_TOKEN` and `TELEGRAM_PAYMENT_CHAT_ID` enable Telegram payment notifications with approve/reject buttons. `TELEGRAM_ADMIN_URL_SAT` is preferred for MYSAT notifications; `TELEGRAM_ADMIN_URL` is still accepted as a fallback for older deployments. `TELEGRAM_ADMIN_IDS` is recommended for button security. If `TELEGRAM_WEBHOOK_SECRET` is omitted, the app derives one from the bot token.

`ENABLE_MOCK_PAYMENTS` is ignored in production and must stay `false` in shared environments. `SEED_ADMIN_PASSWORD` must be set to a strong 12+ character password before running `prisma db seed` if the seed admin does not already exist.

## Manual Payments

The Premium page uses a manual transfer workflow:

1. The user transfers the monthly amount to the HUMO card shown on `/dashboard/subscription`.
2. The user uploads a receipt with `POST /api/payments/manual/request`.
3. The receipt is stored in the private Supabase Storage bucket `mysat-payment-receipts`.
4. Telegram receives a notification if bot secrets are configured.
5. An admin reviews the request in `/admin` and approves or rejects it.
6. Approval creates a `Payment` and activates a 30-day `Subscription`.

Telegram button actions are handled by:

```text
POST /api/telegram/payment-bot
```

Register the bot webhook to:

```text
https://mysat-omega.vercel.app/api/telegram/payment-bot
```

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

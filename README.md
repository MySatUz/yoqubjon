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

LEMONSQUEEZY_API_KEY="..."
LEMONSQUEEZY_STORE_ID="..."
LEMONSQUEEZY_PREMIUM_VARIANT_ID="..."
LEMONSQUEEZY_WEBHOOK_SECRET="..."
LEMONSQUEEZY_TEST_MODE="true"
```

`LEMONSQUEEZY_TEST_MODE` is optional. Set it to `true` only when you want API-created checkouts to be test-mode checkouts.

## Lemon Squeezy

The Premium button creates a hosted Lemon Squeezy checkout from:

```text
POST /api/payments/lemonsqueezy/checkout
```

Configure the Lemon Squeezy webhook callback URL as:

```text
https://your-domain.com/api/webhooks/lemonsqueezy
```

Subscribe the webhook to:

```text
subscription_created
subscription_updated
subscription_cancelled
subscription_resumed
subscription_expired
subscription_paused
subscription_unpaused
subscription_payment_success
subscription_payment_failed
subscription_payment_recovered
subscription_payment_refunded
```

The webhook validates `X-Signature` with `LEMONSQUEEZY_WEBHOOK_SECRET`, syncs the local `Subscription`, and records subscription invoice payments in `Payment`.

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

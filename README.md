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
TELEGRAM_ADMIN_URL="https://your-domain.com"

CLICK_MERCHANT_ID="..."
CLICK_MERCHANT_USER_ID="..."
CLICK_SERVICE_ID="..."
CLICK_SECRET_KEY="..."
CLICK_SUBSCRIPTION_AMOUNT="99000"
CLICK_SUBSCRIPTION_MONTHS="1"
CLICK_RETURN_URL="https://your-domain.com/dashboard/subscription"
```

`TELEGRAM_*` variables are optional for local development. Without them, payment requests are still saved, but Telegram notifications are skipped.

## Click Payments

The Premium page starts a direct Click payment with `POST /api/payments/click`.

1. The app creates a `PaymentOrder` for the signed-in user.
2. The user is redirected to Click with the order id as `transaction_param`.
3. Click calls `/api/payments/click` for prepare and complete callbacks.
4. A successful complete callback records a `Payment` and activates a monthly `Subscription`.

Configure the Click merchant callback URL to:

```text
https://your-domain.com/api/payments/click
```

## Manual Payments

The Premium page also keeps a manual transfer fallback:

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

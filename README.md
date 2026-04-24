# Novoriq Revenue OS

Production-ready SaaS monorepo for authentication, Whop billing access, Stripe restricted-key dispute automation, evidence capture, billing operations, and an admin dashboard.

## Apps

- `apps/api`: Express + Prisma backend
- `apps/web`: Next.js frontend
- `docs`: architecture and Stripe notes

## Core capabilities

- Cookie-based auth with access and refresh tokens
- Role-protected admin and customer APIs
- Whop webhook access activation with database-backed idempotency
- Stripe restricted key validation, encrypted secret storage, and dispute workflows
- Evidence capture with Fingerprint + IP geolocation hooks
- Billing cycle processing and admin settlement tooling
- Structured logging, centralized error handling, and health checks

## Required environment variables

- `DATABASE_URL`
- `ENCRYPTION_KEY`
- `JWT_ACCESS_SECRET`
- `JWT_REFRESH_SECRET`
- `FINGERPRINT_API_KEY`
- `IPAPI_KEY`
- `RESEND_API_KEY`
- `APP_BASE_URL`
- `ALLOWED_ORIGIN`

Optional:

- `STRIPE_WEBHOOK_SECRET`
- `WHOP_WEBHOOK_SECRET`
- `STRIPE_WEBHOOK_TOLERANCE_SECONDS`
- `WHOP_WEBHOOK_TOLERANCE_SECONDS`

Use `.env.example` as the template for local setup.

## Setup

1. Install Node.js 20+.
2. Run `npm install`.
3. Copy `.env.example` to `.env` and fill in the required values.
4. Generate the Prisma client:
   `npm run prisma:generate --workspace @novoriq/api`
5. Apply database schema changes:
   `npm run prisma:push --workspace @novoriq/api`
   For migration-based deploys use:
   `npm run prisma:migrate:deploy --workspace @novoriq/api`
6. Seed local test data:
   `npm run seed --workspace @novoriq/api`
7. Start the apps:
   `npm run dev`

## Seeded test users

All seeded users use password `Novoriq123Secure`.

- `admin@test.com`
- `tier1@test.com`
- `tier2@test.com`
- `tier3@test.com`
- `expired@test.com`

## Main routes

- `GET /api/health`
- `POST /auth/register`
- `POST /auth/login`
- `POST /auth/logout`
- `POST /auth/refresh`
- `GET /auth/me`
- `POST /api/settings/keys`
- `POST /api/whop/webhook`
- `POST /api/stripe/webhook/:userId`
- `POST /api/billing/run`
- `GET /api/admin/overview`
- `GET /api/admin/users`
- `GET /api/user/metrics`

## Production notes

- Sensitive Stripe values are encrypted before persistence.
- Request, webhook, billing, and error logs are structured and redact sensitive fields.
- Admin actions are role-protected server-side.
- HTTPS is enforced in production.
- Stripe and Whop webhook flows are idempotent at the persistence layer.

# Novoriq Revenue OS

Production-oriented monorepo foundation for a multi-tenant Stripe revenue OS.

## Included in phase 1

- Express authentication API with JWT access and refresh tokens
- HttpOnly cookie-based session handling
- Password hashing with bcrypt
- Login rate limiting
- Role-based access control for admin and user flows
- Next.js auth UI for login, registration, and protected destinations

## Workspace

- `apps/api`: Express backend
- `apps/web`: Next.js frontend
- `docs`: architecture notes

## Start

1. Install Node.js 20+.
2. Run `npm install`.
3. Copy `.env.example` to `.env`.
4. Run `npm run dev`.

## Auth routes

- `POST /auth/register`
- `POST /auth/login`
- `POST /auth/logout`
- `POST /auth/refresh`
- `GET /auth/me`

## Protected API routes

- `GET /admin`
- `GET /dashboard`
- `GET /demo`
- `POST /api/settings/keys`
- `POST /api/whop/webhook`
- `POST /api/stripe/webhook/:userId`

## Whop integration

- Frontend checkout buttons redirect directly to Whop checkout pages.
- Backend access is activated only from `POST /api/whop/webhook`.
- Set `WHOP_WEBHOOK_SECRET` to enable signature verification for webhook deliveries.

## Stripe engine

- `POST /api/settings/keys` stores an encrypted Stripe restricted key for the signed-in user and returns a user-scoped webhook URL.
- `POST /api/stripe/webhook/:userId` stores raw Stripe events, deduplicates by `event.id`, persists evidence from successful charges, and prepares dispute evidence from stored charge metadata.
- Prisma now owns user/session/event persistence through PostgreSQL instead of the previous file-backed repositories.

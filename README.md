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

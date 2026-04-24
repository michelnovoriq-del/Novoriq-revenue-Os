# Architecture Notes

## Target shape

- `apps/api` owns authentication, authorization, Stripe connections, webhooks, sync jobs, and recovery workflows.
- `apps/web` owns operator dashboards and tenant-facing UI.
- Backend remains the authority for access decisions and role enforcement.

## Phase 1 auth decisions

1. Access tokens are short-lived JWTs in httpOnly cookies.
2. Refresh tokens are rotated and stored as hashed sessions.
3. The backend computes the exact post-login destination.
4. The frontend never stores tokens in localStorage.

## Immediate backlog

1. Add automated tests for Prisma-backed auth, payments, and Stripe webhooks.
2. Add email verification and password reset flows.
3. Add tenant-level configuration and operator settings pages.
4. Add worker queues for asynchronous Stripe and dispute automation jobs.

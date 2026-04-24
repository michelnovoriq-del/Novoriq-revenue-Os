# Stripe Engine

This Stripe integration uses user-provided restricted API keys stored in PostgreSQL through Prisma. The backend never returns the key after ingestion and only decrypts it inside the webhook flow when a dispute must be updated.

## Prisma schema

### User

```prisma
model User {
  id                  String    @id @default(uuid()) @db.Uuid
  email               String    @unique
  passwordHash        String
  role                String    @default("user")
  hasPaid             Boolean   @default(false)
  hasAccess           Boolean   @default(false)
  accessExpiration    DateTime?
  subscriptionTier    String?
  stripeRestrictedKey String?
  createdAt           DateTime  @default(now())
}
```

### Evidence

```prisma
model Evidence {
  id              String   @id @default(uuid()) @db.Uuid
  userId          String   @db.Uuid
  chargeId        String   @unique
  receiptIp       String   @default("")
  chargeTimestamp DateTime
  createdAt       DateTime @default(now())
}
```

### StripeEvent

```prisma
model StripeEvent {
  id        String   @id @default(uuid()) @db.Uuid
  userId    String   @db.Uuid
  eventId   String   @unique
  eventType String
  payload   Json
  createdAt DateTime @default(now())
}
```

The actual schema also includes `Session` plus existing Whop/access fields so current auth, payments, and gating keep working on the same database.

## Flow

1. A signed-in user posts their restricted key to `POST /api/settings/keys`.
2. The backend validates that the key looks like a Stripe restricted key, encrypts it with AES-256-CBC, stores only the ciphertext, and returns `https://<app>/api/stripe/webhook/{userId}`.
3. Stripe sends events to `POST /api/stripe/webhook/:userId`.
4. The backend checks `event.id` for idempotency, stores the raw payload in `StripeEvent`, and then handles supported event types.
5. `charge.succeeded` captures evidence for later disputes.
6. `charge.dispute.created` loads the user-scoped evidence, decrypts the user’s restricted key just-in-time, submits dispute evidence, and then releases the decrypted value.

## Security note

This implementation follows the requested user-scoped webhook URL pattern. A plain `userId` path segment by itself is not as strong as Stripe signature verification or a secret webhook token, so the next hardening step should be to add a per-endpoint secret before treating the route as fully internet-exposed production infrastructure.

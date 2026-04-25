import assert from "node:assert/strict";
import crypto from "node:crypto";
import http from "node:http";
import path from "node:path";
import { Duplex } from "node:stream";
import { pathToFileURL } from "node:url";

const ROOT = "/home/dadamoox/Desktop/Novoriq revenue OS/Novoriq OS";

function importFromRoot(relativePath) {
  return import(pathToFileURL(path.join(ROOT, relativePath)).href);
}

globalThis.__NOVORIQ_STRIPE_STATE = {
  validationCalls: [],
  disputeUpdates: [],
  webhookConstructs: [],
  failDisputeUpdate: false
};

const db = {
  users: [],
  sessions: [],
  evidences: [],
  activityLogs: [],
  recoveryLogs: [],
  stripeEvents: [],
  whopEvents: []
};

function clone(value) {
  return value == null ? value : structuredClone(value);
}

function toDate(value) {
  if (!value) {
    return null;
  }

  return value instanceof Date ? new Date(value.getTime()) : new Date(value);
}

function uniqueConstraintError(message = "Unique constraint failed") {
  const error = new Error(message);
  error.code = "P2002";
  return error;
}

function applyDataPatch(record, data) {
  for (const [key, value] of Object.entries(data ?? {})) {
    if (value === undefined) {
      continue;
    }

    if (value && typeof value === "object" && "increment" in value) {
      record[key] = (record[key] ?? 0) + value.increment;
      continue;
    }

    record[key] = value;
  }

  return record;
}

function selectFields(record, select) {
  if (!record) {
    return null;
  }

  if (!select) {
    return clone(record);
  }

  const selected = {};

  for (const [key, enabled] of Object.entries(select)) {
    if (enabled) {
      selected[key] = clone(record[key]);
    }
  }

  return selected;
}

function findUser(where) {
  if (where?.id) {
    return db.users.find((user) => user.id === where.id) ?? null;
  }

  if (where?.email) {
    return db.users.find((user) => user.email === where.email) ?? null;
  }

  return null;
}

function findSession(where) {
  if (where?.id) {
    return db.sessions.find((session) => session.id === where.id) ?? null;
  }

  return null;
}

function findEvidence(where) {
  if (where?.chargeId) {
    return db.evidences.find((evidence) => evidence.chargeId === where.chargeId) ?? null;
  }

  return null;
}

function filterUsers(where = {}) {
  return db.users.filter((user) => {
    if (where.id?.in && !where.id.in.includes(user.id)) {
      return false;
    }

    if (where.role && user.role !== where.role) {
      return false;
    }

    if (
      where.unpaidPerformanceBalance?.gt != null &&
      !(user.unpaidPerformanceBalance > where.unpaidPerformanceBalance.gt)
    ) {
      return false;
    }

    if (where.hasAccess != null && user.hasAccess !== where.hasAccess) {
      return false;
    }

    if (
      where.accessExpiration?.gt &&
      !(toDate(user.accessExpiration)?.getTime() > where.accessExpiration.gt.getTime())
    ) {
      return false;
    }

    return true;
  });
}

function filterRecoveryLogs(where = {}) {
  return db.recoveryLogs.filter((recoveryLog) => {
    if (where.userId && recoveryLog.userId !== where.userId) {
      return false;
    }

    if (where.status && recoveryLog.status !== where.status) {
      return false;
    }

    if (where.id?.in && !where.id.in.includes(recoveryLog.id)) {
      return false;
    }

    return true;
  });
}

const prisma = {
  user: {
    async findUnique({ where, select }) {
      return selectFields(findUser(where), select);
    },
    async create({ data }) {
      if (findUser({ email: data.email })) {
        throw uniqueConstraintError("User email already exists");
      }

      const user = {
        id: data.id,
        email: data.email,
        passwordHash: data.passwordHash,
        role: data.role ?? "user",
        hasPaid: data.hasPaid ?? false,
        hasAccess: data.hasAccess ?? false,
        accessExpiration: toDate(data.accessExpiration),
        subscriptionTier: data.subscriptionTier ?? null,
        performanceFeePercentage:
          typeof data.performanceFeePercentage === "number" ? data.performanceFeePercentage : null,
        unpaidPerformanceBalance: data.unpaidPerformanceBalance ?? 0,
        totalRecoveredRevenue: data.totalRecoveredRevenue ?? 0,
        stripeRestrictedKey: data.stripeRestrictedKey ?? null,
        webhookSecret: data.webhookSecret ?? null,
        whopLastEventId: data.whopLastEventId ?? null,
        whopLastEventType: data.whopLastEventType ?? null,
        whopLastPlanId: data.whopLastPlanId ?? null,
        whopLastPaymentId: data.whopLastPaymentId ?? null,
        whopLastMembershipId: data.whopLastMembershipId ?? null,
        whopLastProcessedAt: toDate(data.whopLastProcessedAt),
        createdAt: toDate(data.createdAt) ?? new Date()
      };

      db.users.push(user);
      return clone(user);
    },
    async update({ where, data }) {
      const user = findUser(where);

      if (!user) {
        throw new Error("User not found");
      }

      applyDataPatch(user, {
        ...data,
        accessExpiration: data.accessExpiration === undefined ? undefined : toDate(data.accessExpiration),
        whopLastProcessedAt:
          data.whopLastProcessedAt === undefined ? undefined : toDate(data.whopLastProcessedAt)
      });

      return clone(user);
    },
    async findMany({ where, select, orderBy }) {
      let users = filterUsers(where);

      if (orderBy?.createdAt === "desc") {
        users = users.slice().sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime());
      }

      return users.map((user) => selectFields(user, select));
    },
    async count({ where }) {
      return filterUsers(where).length;
    },
    async aggregate({ _sum, where }) {
      const users = filterUsers(where);
      const result = { _sum: {} };

      for (const key of Object.keys(_sum ?? {})) {
        result._sum[key] = users.reduce((total, user) => total + (user[key] ?? 0), 0);
      }

      return result;
    }
  },
  session: {
    async create({ data }) {
      const session = {
        id: data.id,
        userId: data.userId,
        tokenHash: data.tokenHash ?? null,
        expiresAt: toDate(data.expiresAt),
        fingerprintId: data.fingerprintId ?? null,
        ipAddress: data.ipAddress ?? null,
        country: data.country ?? null,
        city: data.city ?? null,
        userAgent: data.userAgent ?? null,
        createdAt: toDate(data.createdAt) ?? new Date()
      };

      db.sessions.push(session);
      return clone(session);
    },
    async findUnique({ where }) {
      return clone(findSession(where));
    },
    async findFirst({ where, orderBy }) {
      let sessions = db.sessions.filter((session) => {
        if (where?.userId && session.userId !== where.userId) {
          return false;
        }

        if (where?.fingerprintId?.not === null && session.fingerprintId == null) {
          return false;
        }

        return true;
      });

      if (orderBy?.createdAt === "desc") {
        sessions = sessions.slice().sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime());
      }

      return clone(sessions[0] ?? null);
    },
    async deleteMany({ where }) {
      const before = db.sessions.length;
      db.sessions = db.sessions.filter((session) => {
        if (where?.id && session.id === where.id) {
          return false;
        }

        if (where?.userId && session.userId === where.userId) {
          return false;
        }

        return true;
      });

      return { count: before - db.sessions.length };
    }
  },
  evidence: {
    async upsert({ where, update, create, include }) {
      let evidence = findEvidence(where);

      if (evidence) {
        applyDataPatch(evidence, {
          ...update,
          chargeTimestamp:
            update.chargeTimestamp === undefined ? undefined : toDate(update.chargeTimestamp)
        });
      } else {
        evidence = {
          id: crypto.randomUUID(),
          userId: create.userId,
          sessionId: create.sessionId ?? null,
          chargeId: create.chargeId,
          disputeId: create.disputeId ?? null,
          disputeStatus: create.disputeStatus ?? "none",
          recoveredAmount:
            typeof create.recoveredAmount === "number" ? create.recoveredAmount : null,
          receiptIp: create.receiptIp ?? "",
          chargeTimestamp: toDate(create.chargeTimestamp) ?? new Date(),
          createdAt: new Date()
        };

        db.evidences.push(evidence);
      }

      const payload = clone(evidence);
      if (include?.session) {
        payload.session = clone(findSession({ id: evidence.sessionId }));
      }

      return payload;
    },
    async findUnique({ where, include }) {
      const evidence = findEvidence(where);

      if (!evidence) {
        return null;
      }

      const payload = clone(evidence);
      if (include?.session) {
        payload.session = clone(findSession({ id: evidence.sessionId }));
      }

      if (include?.user?.select) {
        payload.user = selectFields(findUser({ id: evidence.userId }), include.user.select);
      }

      return payload;
    },
    async findMany({ where, orderBy, take, include }) {
      let evidences = db.evidences.filter((evidence) => {
        if (where?.disputeId?.not === null && evidence.disputeId == null) {
          return false;
        }

        return true;
      });

      if (orderBy?.createdAt === "desc") {
        evidences = evidences.slice().sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime());
      }

      if (typeof take === "number") {
        evidences = evidences.slice(0, take);
      }

      return evidences.map((evidence) => {
        const payload = clone(evidence);
        if (include?.user?.select) {
          payload.user = selectFields(findUser({ id: evidence.userId }), include.user.select);
        }

        return payload;
      });
    },
    async count({ where }) {
      return db.evidences.filter((evidence) => {
        if (where?.userId && evidence.userId !== where.userId) {
          return false;
        }

        if (where?.disputeStatus?.in) {
          return where.disputeStatus.in.includes(evidence.disputeStatus);
        }

        if (where?.disputeStatus) {
          return evidence.disputeStatus === where.disputeStatus;
        }

        return true;
      }).length;
    }
  },
  activityLog: {
    async create({ data }) {
      const activityLog = {
        id: crypto.randomUUID(),
        userId: data.userId,
        sessionId: data.sessionId,
        action: data.action,
        metadata: data.metadata,
        createdAt: new Date()
      };

      db.activityLogs.push(activityLog);
      return clone(activityLog);
    },
    async findMany({ where, orderBy }) {
      let activityLogs = db.activityLogs.filter((activityLog) => {
        if (where?.sessionId && activityLog.sessionId !== where.sessionId) {
          return false;
        }

        return true;
      });

      if (orderBy?.createdAt === "asc") {
        activityLogs = activityLogs.slice().sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime());
      }

      return activityLogs.map(clone);
    }
  },
  recoveryLog: {
    async create({ data }) {
      if (db.recoveryLogs.some((recoveryLog) => recoveryLog.disputeId === data.disputeId)) {
        throw uniqueConstraintError("Recovery log already exists");
      }

      const recoveryLog = {
        id: crypto.randomUUID(),
        userId: data.userId,
        chargeId: data.chargeId,
        disputeId: data.disputeId,
        recoveredAmount: data.recoveredAmount,
        platformFee: data.platformFee,
        status: data.status ?? "pending",
        billedAt: toDate(data.billedAt),
        createdAt: new Date()
      };

      db.recoveryLogs.push(recoveryLog);
      return clone(recoveryLog);
    },
    async findFirst({ where }) {
      return clone(
        db.recoveryLogs.find((recoveryLog) => {
          if (where?.disputeId) {
            return recoveryLog.disputeId === where.disputeId;
          }

          return false;
        }) ?? null
      );
    },
    async findMany({ where, orderBy }) {
      let recoveryLogs = filterRecoveryLogs(where);

      if (orderBy?.createdAt === "asc") {
        recoveryLogs = recoveryLogs.slice().sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime());
      }

      if (orderBy?.createdAt === "desc") {
        recoveryLogs = recoveryLogs.slice().sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime());
      }

      return recoveryLogs.map(clone);
    },
    async updateMany({ where, data }) {
      const matchingLogs = filterRecoveryLogs(where);

      for (const recoveryLog of matchingLogs) {
        applyDataPatch(recoveryLog, {
          ...data,
          billedAt: data.billedAt === undefined ? undefined : toDate(data.billedAt)
        });
      }

      return { count: matchingLogs.length };
    },
    async aggregate({ _sum, where }) {
      const recoveryLogs = filterRecoveryLogs(where);
      const result = { _sum: {} };

      for (const key of Object.keys(_sum ?? {})) {
        result._sum[key] = recoveryLogs.reduce((total, recoveryLog) => total + (recoveryLog[key] ?? 0), 0);
      }

      return result;
    }
  },
  stripeEvent: {
    async findUnique({ where }) {
      const stripeEvent = db.stripeEvents.find((event) => {
        if (where?.eventId) {
          return event.eventId === where.eventId;
        }

        if (where?.id) {
          return event.id === where.id;
        }

        return false;
      });

      return clone(stripeEvent ?? null);
    },
    async create({ data }) {
      if (db.stripeEvents.some((event) => event.eventId === data.eventId)) {
        throw uniqueConstraintError("Stripe event already exists");
      }

      const stripeEvent = {
        id: crypto.randomUUID(),
        userId: data.userId,
        eventId: data.eventId,
        eventType: data.eventType,
        payload: data.payload,
        processingStatus: "pending",
        processingError: null,
        processingAttempts: 0,
        processedAt: null,
        createdAt: new Date()
      };

      db.stripeEvents.push(stripeEvent);
      return clone(stripeEvent);
    },
    async updateMany({ where, data }) {
      const matchingEvents = db.stripeEvents.filter((event) => {
        if (where?.id && event.id !== where.id) {
          return false;
        }

        if (where?.processingStatus?.in && !where.processingStatus.in.includes(event.processingStatus)) {
          return false;
        }

        return true;
      });

      for (const event of matchingEvents) {
        applyDataPatch(event, data);
      }

      return { count: matchingEvents.length };
    },
    async update({ where, data }) {
      const stripeEvent = db.stripeEvents.find((event) => event.id === where.id);

      if (!stripeEvent) {
        throw new Error("Stripe event not found");
      }

      applyDataPatch(stripeEvent, {
        ...data,
        processedAt: data.processedAt === undefined ? undefined : toDate(data.processedAt)
      });

      return clone(stripeEvent);
    }
  },
  whopEvent: {
    async findUnique({ where }) {
      return clone(db.whopEvents.find((event) => event.eventId === where.eventId) ?? null);
    },
    async create({ data }) {
      if (db.whopEvents.some((event) => event.eventId === data.eventId)) {
        throw uniqueConstraintError("Whop event already exists");
      }

      const whopEvent = {
        id: crypto.randomUUID(),
        userId: data.userId ?? null,
        eventId: data.eventId,
        eventType: data.eventType,
        status: data.status,
        email: data.email ?? null,
        planId: data.planId ?? null,
        reason: data.reason ?? null,
        payload: data.payload ?? null,
        processedAt: toDate(data.processedAt) ?? new Date(),
        createdAt: new Date()
      };

      db.whopEvents.push(whopEvent);
      return clone(whopEvent);
    },
    async update({ where, data }) {
      const whopEvent = db.whopEvents.find((event) => event.eventId === where.eventId);

      if (!whopEvent) {
        throw new Error("Whop event not found");
      }

      applyDataPatch(whopEvent, {
        ...data,
        processedAt: data.processedAt === undefined ? undefined : toDate(data.processedAt)
      });

      return clone(whopEvent);
    }
  },
  async $transaction(callback) {
    return callback(this);
  },
  async $queryRaw(strings, ...values) {
    const sql = String.raw({ raw: strings }, ...values);

    if (sql.includes("FROM recovery_logs")) {
      const limit = typeof values[0] === "number" ? values[0] : 100;

      return db.recoveryLogs
        .filter((recoveryLog) => recoveryLog.status === "pending")
        .slice()
        .sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime())
        .slice(0, limit)
        .map((recoveryLog) => ({ id: recoveryLog.id }));
    }

    return [];
  },
  async $disconnect() {
    return undefined;
  }
};

const { env } = await importFromRoot("apps/api/src/config/env.js");
const prismaModule = await importFromRoot("apps/api/src/lib/prisma.js");
const { encrypt } = await importFromRoot("apps/api/src/lib/secret-encryption.js");
const { createApp } = await importFromRoot("apps/api/src/app.js");
const authService = await importFromRoot("apps/api/src/lib/auth-service.js");
const stripeService = await importFromRoot("apps/api/src/lib/stripe-service.js");
const evidenceService = await importFromRoot("apps/api/src/lib/evidence-service.js");
const whopService = await importFromRoot("apps/api/src/lib/whop-service.js");
const billingService = await importFromRoot("apps/api/src/lib/billing-service.js");
const { authenticate } = await importFromRoot("apps/api/src/middleware/authenticate.js");
const accessGate = await importFromRoot("apps/api/src/middleware/access-gate.js");
const { hashPassword } = await importFromRoot("apps/api/src/lib/password.js");
const whopRoutes = (await importFromRoot("apps/api/src/routes/whop.routes.js")).default;

Object.assign(prismaModule.prisma, prisma);

env.NODE_ENV = "development";
env.APP_BASE_URL = "https://api.example.test";
env.ALLOWED_ORIGIN = "https://app.example.test";
env.FINGERPRINT_API_KEY = "fpjs_test_public";
env.IPAPI_KEY = "ipapi_test_key";
env.RESEND_API_KEY = "re_test_notifications";
env.STRIPE_WEBHOOK_SECRET = "";
env.WHOP_WEBHOOK_SECRET = `whsec_${Buffer.from("whop-shared-secret").toString("base64")}`;

globalThis.fetch = async (url) => {
  if (String(url).startsWith("https://api.ipapi.com/")) {
    return {
      ok: true,
      async json() {
        return {
          country_name: "Zimbabwe",
          city: "Harare"
        };
      }
    };
  }

  if (String(url) === "https://api.resend.com/emails") {
    return {
      ok: true,
      async json() {
        return { id: "email_test" };
      }
    };
  }

  throw new Error(`Unexpected fetch to ${url}`);
};

function seedUser(user) {
  db.users.push({
    id: user.id,
    email: user.email,
    passwordHash: user.passwordHash,
    role: user.role ?? "user",
    hasPaid: user.hasPaid ?? false,
    hasAccess: user.hasAccess ?? false,
    accessExpiration: toDate(user.accessExpiration),
    subscriptionTier: user.subscriptionTier ?? null,
    performanceFeePercentage:
      typeof user.performanceFeePercentage === "number" ? user.performanceFeePercentage : null,
    unpaidPerformanceBalance: user.unpaidPerformanceBalance ?? 0,
    totalRecoveredRevenue: user.totalRecoveredRevenue ?? 0,
    stripeRestrictedKey: user.stripeRestrictedKey ?? null,
    webhookSecret: user.webhookSecret ?? null,
    whopLastEventId: user.whopLastEventId ?? null,
    whopLastEventType: user.whopLastEventType ?? null,
    whopLastPlanId: user.whopLastPlanId ?? null,
    whopLastPaymentId: user.whopLastPaymentId ?? null,
    whopLastMembershipId: user.whopLastMembershipId ?? null,
    whopLastProcessedAt: toDate(user.whopLastProcessedAt),
    createdAt: toDate(user.createdAt) ?? new Date()
  });
}

function seedEvidence(evidence) {
  db.evidences.push({
    id: crypto.randomUUID(),
    userId: evidence.userId,
    sessionId: evidence.sessionId ?? null,
    chargeId: evidence.chargeId,
    disputeId: evidence.disputeId ?? null,
    disputeStatus: evidence.disputeStatus ?? "none",
    recoveredAmount:
      typeof evidence.recoveredAmount === "number" ? evidence.recoveredAmount : null,
    receiptIp: evidence.receiptIp ?? "",
    chargeTimestamp: toDate(evidence.chargeTimestamp) ?? new Date(),
    createdAt: new Date()
  });
}

seedUser({
  id: "11111111-1111-4111-8111-111111111111",
  email: "admin@test.com",
  passwordHash: await hashPassword("Novoriq123Secure"),
  role: "admin",
  hasPaid: true,
  hasAccess: true,
  accessExpiration: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
  subscriptionTier: "admin"
});
seedUser({
  id: "22222222-2222-4222-8222-222222222222",
  email: "tier1@test.com",
  passwordHash: await hashPassword("Novoriq123Secure"),
  role: "user",
  hasPaid: true,
  hasAccess: true,
  accessExpiration: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
  subscriptionTier: "tier1",
  performanceFeePercentage: 0.1
});

const app = createApp();

class MockSocket extends Duplex {
  _read() {}
  _write(chunk, encoding, callback) {
    callback();
  }
}

async function invokeHealth(url = "/api/health") {
  return new Promise((resolve, reject) => {
    const socket = new MockSocket();
    socket.remoteAddress = "127.0.0.1";

    const req = new http.IncomingMessage(socket);
    req.method = "GET";
    req.url = url;
    req.headers = {};
    req.connection = socket;
    req.socket = socket;

    const res = new http.ServerResponse(req);
    const chunks = [];
    const originalWrite = res.write.bind(res);
    const originalEnd = res.end.bind(res);

    res.write = (chunk, encoding, callback) => {
      if (chunk) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, encoding));
      }

      return originalWrite(chunk, encoding, callback);
    };

    res.end = (chunk, encoding, callback) => {
      if (chunk) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, encoding));
      }

      return originalEnd(chunk, encoding, callback);
    };

    res.assignSocket(socket);
    res.on("finish", () => {
      resolve({
        statusCode: res.statusCode,
        json: JSON.parse(Buffer.concat(chunks).toString("utf8"))
      });
    });
    res.on("error", reject);

    app.handle(req, res, reject);
    process.nextTick(() => req.push(null));
  });
}

function createMiddlewareResponse() {
  return {
    statusCode: null,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    }
  };
}

async function runMiddleware(middleware, req) {
  const res = createMiddlewareResponse();

  return new Promise((resolve, reject) => {
    Promise.resolve(
      middleware(req, res, (error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve({ nextCalled: true, req, res });
      })
    )
      .then(() => resolve({ nextCalled: false, req, res }))
      .catch(reject);
  });
}

function signWhopPayload(body, secret) {
  const webhookId = body.id;
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const rawBody = JSON.stringify(body);
  const secretBuffer = Buffer.from(secret.replace(/^whsec_/, ""), "base64");
  const signedContent = `${webhookId}.${timestamp}.${rawBody}`;
  const digest = crypto.createHmac("sha256", secretBuffer).update(signedContent).digest("base64");

  return {
    rawBody,
    headers: {
      "webhook-id": webhookId,
      "webhook-timestamp": timestamp,
      "webhook-signature": `v1,${digest}`
    }
  };
}

async function invokeWhopRoute({ headers, rawBody }) {
  const routeLayer = whopRoutes.stack.find((layer) => layer.route?.path === "/api/whop/webhook");
  const handler = routeLayer.route.stack[routeLayer.route.stack.length - 1].handle;

  const req = {
    headers,
    body: Buffer.from(rawBody, "utf8"),
    get(name) {
      return headers[name.toLowerCase()] ?? headers[name];
    }
  };
  const result = {
    statusCode: null,
    body: null
  };
  const res = {
    sendStatus(code) {
      result.statusCode = code;
      return this;
    },
    status(code) {
      result.statusCode = code;
      return this;
    },
    json(payload) {
      result.body = payload;
      return this;
    }
  };

  await handler(req, res);
  return result;
}

async function drainAsyncWork() {
  await new Promise((resolve) => setTimeout(resolve, 0));
  await new Promise((resolve) => setTimeout(resolve, 0));
}

async function processStripeWebhook({ userId, webhookSecret, event }) {
  const rawBody = Buffer.from(JSON.stringify(event), "utf8");
  const verified = await stripeService.verifyStripeWebhookRequest({
    userId,
    signature: `valid:${webhookSecret}`,
    rawBody
  });
  const stored = await stripeService.storeStripeWebhookEvent({
    userId: verified.user.id,
    eventId: verified.eventId,
    eventType: verified.eventType,
    event: verified.event
  });

  if (!stored.duplicate) {
    await stripeService.processStoredStripeEvent({
      stripeEventId: stored.event.id,
      userId: verified.user.id,
      event: verified.event
    });
  }

  return stored;
}

const testResults = [];

async function runTest(name, testFn) {
  await testFn();
  testResults.push({ name, status: "passed" });
}

await runTest("health", async () => {
  const healthResponse = await invokeHealth();
  assert.equal(healthResponse.statusCode, 200);
  assert.deepEqual(healthResponse.json, { status: "ok" });
});

let registeredUserId = "";

await runTest("auth + demo flow", async () => {
  const registerResult = await authService.registerUser({
    email: "new.user@test.com",
    password: "Novoriq123Secure"
  });
  const loginResult = await authService.loginUser({
    email: "new.user@test.com",
    password: "Novoriq123Secure"
  });

  registeredUserId = registerResult.user.id;

  assert.equal(registerResult.redirectTo, "/demo");
  assert.equal(loginResult.redirectTo, "/demo");

  const authResult = await runMiddleware(authenticate, {
    cookies: {
      novoriq_access_token: loginResult.accessToken
    }
  });
  assert.equal(authResult.req.user.id, registeredUserId);

  const demoGate = await runMiddleware(accessGate.requireDemoAccess, {
    user: registerResult.user
  });
  assert.equal(demoGate.nextCalled, true);
});

await runTest("spoofed whop webhook rejected", async () => {
  const response = await invokeWhopRoute({
    headers: {
      "content-type": "application/json"
    },
    rawBody: JSON.stringify({
      id: "evt_spoof",
      type: "membership.activated",
      data: {
        id: "membership_spoof",
        member: {
          email: "new.user@test.com"
        },
        plan_id: "plan_pJpWvIqcYCRvV"
      }
    })
  });

  assert.equal(response.statusCode, 401);
});

await runTest("whop unlock flow", async () => {
  const payload = {
    id: "evt_whop_membership_1",
    type: "membership.activated",
    data: {
      id: "membership_1",
      member: {
        email: "new.user@test.com"
      },
      plan_id: "plan_pJpWvIqcYCRvV"
    }
  };
  const signedWhop = signWhopPayload(payload, env.WHOP_WEBHOOK_SECRET);
  const response = await invokeWhopRoute({
    headers: signedWhop.headers,
    rawBody: signedWhop.rawBody
  });

  assert.equal(response.statusCode, 200);
  await drainAsyncWork();

  const unlockedUser = findUser({ id: registeredUserId });
  assert.equal(unlockedUser.subscriptionTier, "tier1");
  assert.equal(unlockedUser.hasAccess, true);
});

await runTest("stripe key validation + encryption", async () => {
  await assert.rejects(
    stripeService.validateRestrictedStripeKey("sk_test_invalid"),
    /Only Stripe restricted API keys are accepted/
  );

  const result = await stripeService.storeRestrictedStripeKey({
    userId: registeredUserId,
    restrictedKey: "rk_valid_new_user",
    webhookSecret: "whsec_user_specific"
  });
  const user = findUser({ id: registeredUserId });

  assert.ok(result.webhookUrl.endsWith(`/api/stripe/webhook/${registeredUserId}`));
  assert.notEqual(user.stripeRestrictedKey, "rk_valid_new_user");
  assert.notEqual(user.webhookSecret, "whsec_user_specific");
});

let evidenceSessionId = "";

await runTest("evidence engine", async () => {
  const session = await evidenceService.captureEvidenceSession({
    userId: registeredUserId,
    fingerprintId: "fingerprint_123",
    userAgent: "Mozilla/5.0 QA Harness",
    ipAddress: "203.0.113.42"
  });
  const activity = await evidenceService.logEvidenceActivity({
    userId: registeredUserId,
    sessionId: session.id,
    action: "dashboard_view",
    metadata: {
      page: "dashboard"
    }
  });

  evidenceSessionId = session.id;

  assert.equal(session.userId, registeredUserId);
  assert.equal(activity.sessionId, session.id);
});

await runTest("duplicate stripe event processed once", async () => {
  const event = {
    id: "evt_charge_succeeded_1",
    type: "charge.succeeded",
    data: {
      object: {
        id: "ch_1",
        created: 1710000000,
        receipt_ip: "198.51.100.10"
      }
    }
  };

  const first = await processStripeWebhook({
    userId: registeredUserId,
    webhookSecret: "whsec_user_specific",
    event
  });
  const second = await processStripeWebhook({
    userId: registeredUserId,
    webhookSecret: "whsec_user_specific",
    event
  });

  assert.equal(first.duplicate, false);
  assert.equal(second.duplicate, true);
  assert.equal(findEvidence({ chargeId: "ch_1" }).sessionId, evidenceSessionId);
});

await runTest("dispute submission + idempotency", async () => {
  await processStripeWebhook({
    userId: registeredUserId,
    webhookSecret: "whsec_user_specific",
    event: {
      id: "evt_dispute_created_1",
      type: "charge.dispute.created",
      data: {
        object: {
          id: "dp_1",
          charge: "ch_1"
        }
      }
    }
  });

  await processStripeWebhook({
    userId: registeredUserId,
    webhookSecret: "whsec_user_specific",
    event: {
      id: "evt_dispute_created_2",
      type: "charge.dispute.created",
      data: {
        object: {
          id: "dp_1",
          charge: "ch_1"
        }
      }
    }
  });

  assert.equal(globalThis.__NOVORIQ_STRIPE_STATE.disputeUpdates.length, 1);
  assert.equal(findEvidence({ chargeId: "ch_1" }).disputeStatus, "submitted");
});

await runTest("money precision uses cents", async () => {
  await processStripeWebhook({
    userId: registeredUserId,
    webhookSecret: "whsec_user_specific",
    event: {
      id: "evt_dispute_closed_1",
      type: "charge.dispute.closed",
      data: {
        object: {
          id: "dp_1",
          charge: "ch_1",
          status: "won",
          amount: 1001
        }
      }
    }
  });

  const recoveryLog = db.recoveryLogs.find((entry) => entry.disputeId === "dp_1");

  assert.equal(recoveryLog.recoveredAmount, 1001);
  assert.equal(recoveryLog.platformFee, 100);
});

await runTest("concurrent billing does not double bill", async () => {
  seedUser({
    id: "33333333-3333-4333-8333-333333333333",
    email: "billing@test.com",
    passwordHash: await hashPassword("Novoriq123Secure"),
    role: "user",
    hasPaid: true,
    hasAccess: true,
    accessExpiration: new Date(Date.now() + 24 * 60 * 60 * 1000),
    subscriptionTier: "tier1",
    performanceFeePercentage: 0.1,
    unpaidPerformanceBalance: 100
  });
  db.recoveryLogs.push({
    id: crypto.randomUUID(),
    userId: "33333333-3333-4333-8333-333333333333",
    chargeId: "ch_billing",
    disputeId: "dp_billing",
    recoveredAmount: 1000,
    platformFee: 100,
    status: "pending",
    billedAt: null,
    createdAt: new Date()
  });

  const [firstRun, secondRun] = await Promise.all([
    billingService.runBillingCycle(),
    billingService.runBillingCycle()
  ]);

  const billedEntries = [firstRun, secondRun]
    .flatMap((run) => run.billedUsers ?? [])
    .filter((entry) => entry.userId === "33333333-3333-4333-8333-333333333333");
  const billedForDispute = db.recoveryLogs.filter((recoveryLog) => recoveryLog.disputeId === "dp_billing");

  assert.equal(firstRun.alreadyRunning === true || secondRun.alreadyRunning === true, true);
  assert.equal(billedEntries.reduce((total, entry) => total + entry.amountDueCents, 0), 100);
  assert.equal(billedForDispute[0].status, "billed");
});

await runTest("expired access and missing evidence fail safely", async () => {
  seedUser({
    id: "44444444-4444-4444-8444-444444444444",
    email: "expired@test.com",
    passwordHash: await hashPassword("Novoriq123Secure"),
    role: "user",
    hasPaid: true,
    hasAccess: false,
    accessExpiration: new Date(Date.now() - 60 * 1000),
    subscriptionTier: "tier1",
    performanceFeePercentage: 0.1,
    stripeRestrictedKey: encrypt("rk_valid_expired_user"),
    webhookSecret: encrypt("whsec_expired_user")
  });
  seedUser({
    id: "55555555-5555-4555-8555-555555555555",
    email: "empty-evidence@test.com",
    passwordHash: await hashPassword("Novoriq123Secure"),
    role: "user",
    hasPaid: true,
    hasAccess: true,
    accessExpiration: new Date(Date.now() + 60 * 60 * 1000),
    subscriptionTier: "tier1",
    performanceFeePercentage: 0.1,
    stripeRestrictedKey: encrypt("rk_valid_empty"),
    webhookSecret: encrypt("whsec_empty")
  });
  seedEvidence({
    userId: "44444444-4444-4444-8444-444444444444",
    chargeId: "ch_expired"
  });

  const expiredStored = await stripeService.storeStripeWebhookEvent({
    userId: "44444444-4444-4444-8444-444444444444",
    eventId: "evt_expired_dispute",
    eventType: "charge.dispute.created",
    event: {
      type: "charge.dispute.created",
      data: {
        object: {
          id: "dp_expired",
          charge: "ch_expired"
        }
      }
    }
  });

  await assert.rejects(
    stripeService.processStoredStripeEvent({
      stripeEventId: expiredStored.event.id,
      userId: "44444444-4444-4444-8444-444444444444",
      event: expiredStored.event.payload
    }),
    /User access has expired/
  );

  const emptyStored = await stripeService.storeStripeWebhookEvent({
    userId: "55555555-5555-4555-8555-555555555555",
    eventId: "evt_empty_dispute",
    eventType: "charge.dispute.created",
    event: {
      type: "charge.dispute.created",
      data: {
        object: {
          id: "dp_empty",
          charge: "ch_missing"
        }
      }
    }
  });

  await assert.rejects(
    stripeService.processStoredStripeEvent({
      stripeEventId: emptyStored.event.id,
      userId: "55555555-5555-4555-8555-555555555555",
      event: emptyStored.event.payload
    }),
    /No evidence found/
  );
});

console.log(
  JSON.stringify(
    {
      passed: testResults.length,
      tests: testResults
    },
    null,
    2
  )
);

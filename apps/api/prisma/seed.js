import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const DEFAULT_PASSWORD = "Novoriq123Secure";
const now = Date.now();
const future30Days = new Date(now + 30 * 24 * 60 * 60 * 1000);
const pastDate = new Date(now - 7 * 24 * 60 * 60 * 1000);

async function upsertUser({ email, role = "user", ...data }) {
  const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, 12);

  return prisma.user.upsert({
    where: { email },
    update: {
      role,
      ...data,
      passwordHash
    },
    create: {
      email,
      role,
      passwordHash,
      ...data
    }
  });
}

async function main() {
  await upsertUser({
    email: "admin@test.com",
    role: "admin",
    hasPaid: true,
    hasAccess: true,
    subscriptionTier: "admin",
    accessExpiration: future30Days
  });

  await upsertUser({
    email: "tier1@test.com",
    hasPaid: true,
    hasAccess: true,
    subscriptionTier: "tier1",
    performanceFeePercentage: 0.1,
    accessExpiration: future30Days
  });

  await upsertUser({
    email: "tier2@test.com",
    hasPaid: true,
    hasAccess: true,
    subscriptionTier: "tier2",
    performanceFeePercentage: 0.05,
    accessExpiration: future30Days
  });

  await upsertUser({
    email: "tier3@test.com",
    hasPaid: true,
    hasAccess: true,
    subscriptionTier: "tier3",
    performanceFeePercentage: 0.03,
    accessExpiration: future30Days
  });

  await upsertUser({
    email: "expired@test.com",
    hasPaid: true,
    hasAccess: false,
    subscriptionTier: "tier1",
    performanceFeePercentage: 0.1,
    accessExpiration: pastDate
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });

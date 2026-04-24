import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { z } from "zod";

dotenv.config();

const optionalString = z.preprocess((value) => {
  if (typeof value !== "string") {
    return value;
  }

  const trimmedValue = value.trim();
  return trimmedValue === "" ? undefined : trimmedValue;
}, z.string().min(1).optional());

function optionalStringFromAliases(...aliasNames) {
  return z.preprocess((value) => {
    if (typeof value === "string" && value.trim() !== "") {
      return value;
    }

    for (const aliasName of aliasNames) {
      const aliasValue = process.env[aliasName];
      if (typeof aliasValue === "string" && aliasValue.trim() !== "") {
        return aliasValue;
      }
    }

    return value;
  }, z.string().min(1).optional());
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const appRoot = path.resolve(__dirname, "../../");

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  API_PORT: z.coerce.number().int().positive().default(4000),
  APP_BASE_URL: z.string().url().default("http://localhost:4000"),
  ALLOWED_ORIGIN: z.string().url().default("http://localhost:3000"),
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  ACCESS_TOKEN_TTL_MINUTES: z.coerce.number().int().positive().default(15),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(30),
  BCRYPT_ROUNDS: z.coerce.number().int().min(10).max(14).default(12),
  DATABASE_URL: z.string().min(1),
  ENCRYPTION_KEY: z.string().regex(/^[0-9a-fA-F]{64}$/, {
    message: "ENCRYPTION_KEY must be a 32-byte hex string"
  }),
  FINGERPRINT_API_KEY: optionalStringFromAliases("FINGERPRINTJS_API_KEY"),
  IPAPI_KEY: optionalStringFromAliases("IPAPI_API_KEY"),
  RESEND_API_KEY: optionalString,
  STRIPE_WEBHOOK_SECRET: optionalString,
  STRIPE_WEBHOOK_TOLERANCE_SECONDS: z.coerce.number().int().positive().default(300),
  WHOP_WEBHOOK_SECRET: optionalString,
  WHOP_WEBHOOK_TOLERANCE_SECONDS: z.coerce.number().int().positive().default(300),
  WHOP_EVENT_STORE_FILE: z.string().default("./data/whop-events.json")
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid environment configuration", parsed.error.flatten().fieldErrors);
  throw new Error("Invalid environment configuration");
}

const dataPath = (relativePath) => path.resolve(appRoot, relativePath);

export const env = {
  ...parsed.data,
  isProduction: parsed.data.NODE_ENV === "production",
  whopEventStoreFile: dataPath(parsed.data.WHOP_EVENT_STORE_FILE)
};

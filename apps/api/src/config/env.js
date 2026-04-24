import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { z } from "zod";
import { logger } from "../utils/logger.js";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const appRoot = path.resolve(__dirname, "../../");

function requiredString(message) {
  return z
    .string({
      required_error: message
    })
    .trim()
    .min(1, message);
}

function aliasedRequiredString(aliasNames, message) {
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
  }, requiredString(message));
}

const optionalString = z.preprocess((value) => {
  if (typeof value !== "string") {
    return value;
  }

  const trimmedValue = value.trim();
  return trimmedValue === "" ? undefined : trimmedValue;
}, z.string().min(1).optional());

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  API_PORT: z.coerce.number().int().positive().default(4000),
  APP_BASE_URL: z.string().url().default("http://localhost:4000"),
  ALLOWED_ORIGIN: z.string().url().default("http://localhost:3000"),
  JWT_ACCESS_SECRET: requiredString("JWT_ACCESS_SECRET is required").min(32),
  JWT_REFRESH_SECRET: requiredString("JWT_REFRESH_SECRET is required").min(32),
  ACCESS_TOKEN_TTL_MINUTES: z.coerce.number().int().positive().default(15),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(30),
  BCRYPT_ROUNDS: z.coerce.number().int().min(10).max(14).default(12),
  DATABASE_URL: requiredString("DATABASE_URL is required"),
  ENCRYPTION_KEY: requiredString("ENCRYPTION_KEY is required").regex(/^[0-9a-fA-F]{64}$/, {
    message: "ENCRYPTION_KEY must be a 32-byte hex string"
  }),
  FINGERPRINT_API_KEY: aliasedRequiredString(
    ["FINGERPRINTJS_API_KEY"],
    "FINGERPRINT_API_KEY is required"
  ),
  IPAPI_KEY: aliasedRequiredString(["IPAPI_API_KEY"], "IPAPI_KEY is required"),
  RESEND_API_KEY: requiredString("RESEND_API_KEY is required"),
  STRIPE_WEBHOOK_SECRET: optionalString,
  STRIPE_WEBHOOK_TOLERANCE_SECONDS: z.coerce.number().int().positive().default(300),
  WHOP_WEBHOOK_SECRET: optionalString,
  WHOP_WEBHOOK_TOLERANCE_SECONDS: z.coerce.number().int().positive().default(300),
  WHOP_EVENT_STORE_FILE: z.string().default("./data/whop-events.json")
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  logger.error("Invalid environment configuration", {
    issues: parsed.error.flatten().fieldErrors
  });
  throw new Error("Invalid environment configuration");
}

const dataPath = (relativePath) => path.resolve(appRoot, relativePath);

export const env = {
  ...parsed.data,
  isProduction: parsed.data.NODE_ENV === "production",
  whopEventStoreFile: dataPath(parsed.data.WHOP_EVENT_STORE_FILE)
};

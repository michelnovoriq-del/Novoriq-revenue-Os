import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { z } from "zod";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const appRoot = path.resolve(__dirname, "../../");

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  API_PORT: z.coerce.number().int().positive().default(4000),
  ALLOWED_ORIGIN: z.string().url().default("http://localhost:3000"),
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  ACCESS_TOKEN_TTL_MINUTES: z.coerce.number().int().positive().default(15),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(30),
  BCRYPT_ROUNDS: z.coerce.number().int().min(10).max(14).default(12),
  USER_STORE_FILE: z.string().default("./data/users.json"),
  SESSION_STORE_FILE: z.string().default("./data/sessions.json")
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
  userStoreFile: dataPath(parsed.data.USER_STORE_FILE),
  sessionStoreFile: dataPath(parsed.data.SESSION_STORE_FILE)
};

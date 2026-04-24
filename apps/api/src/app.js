import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import authRoutes from "./routes/auth.routes.js";
import billingRoutes from "./routes/billing.routes.js";
import evidenceRoutes from "./routes/evidence.routes.js";
import protectedRoutes from "./routes/protected.routes.js";
import settingsRoutes from "./routes/settings.routes.js";
import stripeRoutes from "./routes/stripe.routes.js";
import whopRoutes from "./routes/whop.routes.js";
import { env } from "./config/env.js";
import { errorHandler } from "./middleware/error-handler.js";
import { requestLogger } from "./middleware/request-logger.js";
import { requireHttps } from "./middleware/require-https.js";
import { sanitizeBody } from "./middleware/sanitize-body.js";

export function createApp() {
  const app = express();

  app.disable("x-powered-by");
  app.set("trust proxy", 1);
  app.use(
    cors({
      origin: env.ALLOWED_ORIGIN,
      credentials: true
    })
  );
  app.use(requestLogger);
  app.use(requireHttps);
  app.use(cookieParser());
  app.use(whopRoutes);
  app.use(stripeRoutes);
  app.use(express.json({ limit: "1mb", strict: true }));
  app.use(sanitizeBody);

  app.get("/health", (req, res) => {
    return res.status(200).json({ status: "ok" });
  });

  app.get("/api/health", (req, res) => {
    return res.status(200).json({ status: "ok" });
  });

  app.use("/auth", authRoutes);
  app.use(billingRoutes);
  app.use(evidenceRoutes);
  app.use(settingsRoutes);
  app.use(protectedRoutes);

  app.use(errorHandler);

  return app;
}

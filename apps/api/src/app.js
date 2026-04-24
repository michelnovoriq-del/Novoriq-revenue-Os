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
  app.use(cookieParser());
  app.use(whopRoutes);
  app.use(stripeRoutes);
  app.use(express.json({ limit: "1mb" }));

  app.get("/health", (req, res) => {
    res.status(200).json({ ok: true });
  });

  app.use("/auth", authRoutes);
  app.use(billingRoutes);
  app.use(evidenceRoutes);
  app.use(settingsRoutes);
  app.use(protectedRoutes);

  app.use(errorHandler);

  return app;
}

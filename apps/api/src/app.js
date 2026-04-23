import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import authRoutes from "./routes/auth.routes.js";
import protectedRoutes from "./routes/protected.routes.js";
import { env } from "./config/env.js";
import { errorHandler } from "./middleware/error-handler.js";

export function createApp() {
  const app = express();

  app.disable("x-powered-by");
  app.use(
    cors({
      origin: env.ALLOWED_ORIGIN,
      credentials: true
    })
  );
  app.use(express.json({ limit: "1mb" }));
  app.use(cookieParser());

  app.get("/health", (req, res) => {
    res.status(200).json({ ok: true });
  });

  app.use("/auth", authRoutes);
  app.use(protectedRoutes);

  app.use(errorHandler);

  return app;
}

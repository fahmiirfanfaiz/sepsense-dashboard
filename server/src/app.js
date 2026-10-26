import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";
import { env } from "./configs/env.js";
import {
  errorHandler,
  notFoundHandler,
} from "./middlewares/error.middleware.js";
import authRoutes from "./routes/auth.routes.js";
import dashboardRoutes from "./routes/dashboard.routes.js";
import { AppError } from "./utils/AppError.js";

export function createApp() {
  const app = express();

  app.disable("x-powered-by");

  if (env.trustProxy > 0) {
    app.set("trust proxy", env.trustProxy);
  }

  app.use(helmet());

  app.use(
    cors({
      origin(origin, callback) {
        // Request tanpa Origin (curl, health check, server-to-server) diizinkan.
        if (!origin || env.frontendOrigins.includes(origin)) {
          return callback(null, true);
        }

        return callback(
          new AppError(
            403,
            "Origin tidak diizinkan oleh konfigurasi CORS.",
            "CORS_ORIGIN_DENIED",
          ),
        );
      },
      credentials: true,
      methods: ["GET", "POST", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization"],
      maxAge: 86400,
    }),
  );

  app.use(express.json({ limit: "16kb" }));
  app.use(express.urlencoded({ extended: false, limit: "16kb" }));
  app.use(cookieParser());

  if (env.nodeEnv !== "test") {
    app.use(morgan(env.isProduction ? "combined" : "dev"));
  }

  app.get("/health", (_req, res) => {
    res.status(200).json({
      status: "ok",
      timestamp: new Date().toISOString(),
    });
  });

  app.use("/", authRoutes);
  app.use("/api/dashboard", dashboardRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

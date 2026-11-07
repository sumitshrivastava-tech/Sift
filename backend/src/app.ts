import express, { Application } from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";

import userRoutes from "./routes/user.routes";
import postRoutes from "./routes/post.routes";
import saveRoutes from "./routes/save.routes";
import commentRoutes from "./routes/comment.routes";
import authRoutes from "./routes/auth.routes";
import settingsRoutes from "./routes/settings.routes";
import searchRoutes from "./routes/search.routes";
import boardRoutes from "./routes/board.routes";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler";

export function createApp(): Application {
  const app = express();

  // ─── Security & Utility Middleware ──────────────────────────────────────────
  app.use(
    helmet({
      crossOriginResourcePolicy: false,
    })
  );
  app.use(
    cors({
      origin: process.env.CORS_ORIGIN ?? "*",
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization", "Accept", "Origin", "X-Requested-With"],
    })
  );
  app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));
  app.use(express.json({ limit: "10mb" }));
  app.use(express.urlencoded({ extended: true }));

  // ─── Health Check ────────────────────────────────────────────────────────────
  app.get("/health", (_req, res) => {
    res.json({
      status: "ok",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    });
  });

  // ─── API Routes ──────────────────────────────────────────────────────────────
  app.use("/api/auth", authRoutes);
  app.use("/api/users", userRoutes);
  app.use("/api/posts", postRoutes);
  app.use("/api/saves", saveRoutes);
  app.use("/api/comments", commentRoutes);
  app.use("/api/settings", settingsRoutes);
  app.use("/api/search", searchRoutes);
  app.use("/api/boards", boardRoutes);

  // ─── Error Handling (must come last) ────────────────────────────────────────
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}


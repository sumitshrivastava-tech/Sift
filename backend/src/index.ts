import "dotenv/config";
import { createApp } from "./app";
import { prisma } from "./lib/prisma";

const PORT = parseInt(process.env.PORT ?? "3000", 10);

async function bootstrap(): Promise<void> {
  // Verify database connection before starting the server
  try {
    await prisma.$connect();
    console.log("✅ Database connection established");
  } catch (error) {
    console.error("❌ Failed to connect to database:", error);
    process.exit(1);
  }

  const app = createApp();

  const server = app.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 Server running on http://0.0.0.0:${PORT}`);
    console.log(`📡 Local Network access: http://192.168.31.190:${PORT}`);
    console.log(`📋 Environment: ${process.env.NODE_ENV ?? "development"}`);
    console.log(`❤️  Health check: http://localhost:${PORT}/health`);
  });

  // ─── Graceful Shutdown ──────────────────────────────────────────────────────
  const shutdown = async (signal: string): Promise<void> => {
    console.log(`\n⚠️  Received ${signal}. Shutting down gracefully...`);
    server.close(async () => {
      await prisma.$disconnect();
      console.log("✅ Database disconnected. Exiting.");
      process.exit(0);
    });
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("unhandledRejection", (reason) => {
    console.error("Unhandled Rejection:", reason);
  });
  process.on("uncaughtException", (error) => {
    console.error("Uncaught Exception:", error);
  });
}

bootstrap();


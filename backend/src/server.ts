import { createApp } from "./app";
import { connectDatabase, disconnectDatabase } from "./config/database";
import { env } from "./config/env";
import { isWhatsAppDryRun } from "./config/whatsapp";
import { logger } from "./common/utils/logger";
import { startScheduler, stopScheduler } from "./scheduler/scheduler";

async function main() {
  await connectDatabase();
  if (isWhatsAppDryRun()) logger.warn("WhatsApp is not configured: messages are logged, not sent (dry-run)");
  // Background jobs (campaigns, reminders, imports, exports, webhooks) run in this process.
  if (env.SCHEDULER_ENABLED) await startScheduler();
  else logger.info("Job scheduler disabled in this process (SCHEDULER_ENABLED=false)");

  const app = createApp();
  const server = app.listen(env.PORT, () => {
    logger.info({ port: env.PORT, prefix: env.API_PREFIX, env: env.NODE_ENV }, "BizInvite API listening");
  });

  let shuttingDown = false;
  const shutdown = async (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info({ signal }, "Shutting down API");
    setTimeout(() => process.exit(1), 15000).unref();
    server.close(async () => {
      await stopScheduler().catch(() => undefined);
      await disconnectDatabase().catch(() => undefined);
      process.exit(0);
    });
  };
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));
}

main().catch((err) => {
  logger.fatal({ err: (err as Error).message }, "API failed to start");
  process.exit(1);
});

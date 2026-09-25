/**
 * Optional scheduler-only process. The API already runs the scheduler, so this is
 * only needed to move background work off API instances (run those with
 * SCHEDULER_ENABLED=false). Needs nothing but MongoDB.
 *
 *   npm run worker
 */
import { connectDatabase, disconnectDatabase } from "./config/database";
import { whatsappStartupWarnings } from "./config/whatsapp";
import { logger } from "./common/utils/logger";
import { startScheduler, stopScheduler } from "./scheduler/scheduler";

async function main() {
  await connectDatabase();
  for (const warning of whatsappStartupWarnings()) logger.warn(warning);
  await startScheduler();

  const shutdown = async (signal: string) => {
    logger.info({ signal }, "Shutting down worker");
    await stopScheduler().catch(() => undefined);
    await disconnectDatabase().catch(() => undefined);
    process.exit(0);
  };
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));
}

main().catch((err) => {
  logger.fatal({ err: (err as Error).message }, "Worker failed to start");
  process.exit(1);
});

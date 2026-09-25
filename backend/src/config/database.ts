import dns from "dns";
import mongoose from "mongoose";
import { env, REQUIRED_DB_NAME } from "./env";
import { logger } from "../common/utils/logger";

mongoose.set("strictQuery", true);

export async function connectDatabase(uri: string = env.MONGODB_URI): Promise<typeof mongoose> {
  if (env.DNS_SERVERS) {
    dns.setServers(env.DNS_SERVERS.split(",").map((s) => s.trim()).filter(Boolean));
    logger.info({ dnsServers: dns.getServers() }, "Using DNS_SERVERS for name resolution");
  }

  mongoose.connection.on("disconnected", () => logger.warn("MongoDB disconnected"));
  mongoose.connection.on("reconnected", () => logger.info("MongoDB reconnected"));
  mongoose.connection.on("error", (err: Error) => logger.error({ err: err.message }, "MongoDB connection error"));

  // dbName is always forced so a URI without a path can never fall back to another database.
  await mongoose.connect(uri, {
    dbName: REQUIRED_DB_NAME,
    serverSelectionTimeoutMS: 10000,
    autoIndex: true,
  });

  const connectedDb = mongoose.connection.db?.databaseName;
  if (connectedDb !== REQUIRED_DB_NAME) {
    await mongoose.disconnect();
    throw new Error(`Refusing to run against database "${connectedDb}"; expected ${REQUIRED_DB_NAME}`);
  }
  logger.info({ db: connectedDb }, "MongoDB connected");
  return mongoose;
}

export async function disconnectDatabase(): Promise<void> {
  await mongoose.disconnect();
}

export function databaseState(): "up" | "down" {
  return mongoose.connection.readyState === 1 ? "up" : "down";
}

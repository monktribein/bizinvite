import { MongoMemoryReplSet } from "mongodb-memory-server";
import type { TestProject } from "vitest/node";

let server: MongoMemoryReplSet | undefined;

/** One in-memory MongoDB (single-node replica set) for the whole run. */
export async function setup(project: TestProject) {
  server = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  project.provide("mongoUri", server.getUri());
}

export async function teardown() {
  await server?.stop();
}

declare module "vitest" {
  export interface ProvidedContext {
    mongoUri: string;
  }
}

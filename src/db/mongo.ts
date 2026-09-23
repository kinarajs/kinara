import { KinaraError } from "../errors.js";

export interface MongoHandle {
  client: unknown;
  db: (name?: string) => unknown;
  close: () => Promise<void>;
}

export async function connectMongo(url: string): Promise<MongoHandle> {
  let MongoClient: new (url: string, options?: Record<string, unknown>) => {
    connect(): Promise<unknown>;
    db(name?: string): unknown;
    close(): Promise<void>;
  };
  try {
    ({ MongoClient } = (await import("mongodb")) as unknown as { MongoClient: typeof MongoClient });
  } catch {
    throw new KinaraError("MongoDB requires the optional peer `mongodb`.", { code: "MISSING_PEER" });
  }

  try {
    const client = new MongoClient(url, { ignoreUndefined: true });
    await client.connect();
    return {
      client,
      db: (name?: string) => client.db(name),
      close: () => client.close(),
    };
  } catch (error) {
    throw new KinaraError("MongoDB connection failed.", {
      code: "MONGO_CONNECT_FAILED",
      details: error instanceof Error ? error.message : undefined,
      expose: false,
    });
  }
}

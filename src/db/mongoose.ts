import { KinaraError } from "../errors.js";

export interface MongooseHandle {
  mongoose: {
    connection: { readyState: number };
    disconnect: () => Promise<void>;
  };
  close: () => Promise<void>;
}

type MongooseModule = {
  connect: (url: string) => Promise<unknown>;
  disconnect: () => Promise<void>;
  connection: { readyState: number };
};

async function loadMongoose(): Promise<MongooseModule> {
  const spec = "mongoose";
  try {
    const imported = (await import(spec)) as { default?: MongooseModule } & MongooseModule;
    return imported.default ?? imported;
  } catch {
    throw new KinaraError("Mongoose requires the optional peer `mongoose`.", {
      code: "MISSING_PEER",
    });
  }
}

export async function connectMongoose(url: string): Promise<MongooseHandle> {
  const mongoose = await loadMongoose();

  try {
    await mongoose.connect(url);
    return {
      mongoose,
      close: () => mongoose.disconnect(),
    };
  } catch (error) {
    throw new KinaraError("Mongoose connection failed.", {
      code: "MONGOOSE_CONNECT_FAILED",
      details: error instanceof Error ? error.message : undefined,
      expose: false,
    });
  }
}

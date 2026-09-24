import type { Kinara } from "./app.js";
import { createApp } from "./app.js";
import type { CreateAppOptions } from "./types.js";

export interface BootOptions extends CreateAppOptions {
  serviceName: string;
  port?: number;
  host?: string;
  /**
   * Mongoose URL. `false` skips connect. A string connects that URL.
   * Omitted uses `MONGO_URI`, then `MONGO_URL`, when `createApp` has not already connected.
   */
  mongo?: string | false;
  /** Emitted after listen. Default is `${serviceName}.started`. */
  startedEvent?: string;
  onReady?: (app: Kinara) => void | Promise<void>;
  /** Install SIGINT and SIGTERM handlers that call `app.close()`. Default true. */
  signals?: boolean;
}

export async function boot(options: BootOptions): Promise<Kinara> {
  const kinara = await createApp(options);

  if (options.mongo !== false && !kinara.mongoose) {
    const url =
      typeof options.mongo === "string"
        ? options.mongo
        : process.env.MONGO_URI || process.env.MONGO_URL;
    if (url) await kinara.connectMongoose(url);
  }

  await options.onReady?.(kinara);

  const port = options.port ?? (Number(process.env.PORT) || 3000);
  await kinara.listen(port, options.host);
  const eventName = options.startedEvent ?? `${options.serviceName}.started`;
  await kinara.emitSafe(eventName, { port });

  if (options.signals !== false) installShutdown(kinara);

  return kinara;
}

function installShutdown(kinara: Kinara): void {
  const shutdown = (signal: string) => {
    kinara.logger.info("shutting down", { signal });
    void kinara.close().finally(() => process.exit(0));
  };
  process.once("SIGINT", () => shutdown("SIGINT"));
  process.once("SIGTERM", () => shutdown("SIGTERM"));
}

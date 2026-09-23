import { isProduction } from "./runtime.js";
import { getRequestId } from "./context.js";

export interface LogRecord {
  level: "debug" | "info" | "warn" | "error";
  message: string;
  time: string;
  requestId?: string;
  extra?: Record<string, unknown>;
}

export interface LogSink {
  write(record: LogRecord): void | Promise<void>;
  flush?(): Promise<void>;
}

export interface Logger {
  debug(message: string, extra?: Record<string, unknown>): void;
  info(message: string, extra?: Record<string, unknown>): void;
  warn(message: string, extra?: Record<string, unknown>): void;
  error(message: string, extra?: Record<string, unknown>): void;
  use(sink: LogSink): void;
  flush(): Promise<void>;
}

export function consoleSink(json: boolean): LogSink {
  return {
    write(record) {
      const stream =
        record.level === "error" ? console.error : record.level === "warn" ? console.warn : console.log;
      if (json) {
        stream(JSON.stringify(record));
        return;
      }
      const extra = record.extra ? ` ${JSON.stringify(record.extra)}` : "";
      const id = record.requestId ? ` ${record.requestId}` : "";
      stream(`[kinara:${record.level}]${id} ${record.message}${extra}`);
    },
  };
}

export function createLogger(options: { quiet?: boolean; json?: boolean; sinks?: LogSink[] } = {}): Logger {
  const sinks = [...(options.sinks ?? []), consoleSink(options.json ?? isProduction())];
  const debugEnabled =
    process.env.KINARA_DEBUG === "1" ||
    process.env.KINARA_DEBUG === "true" ||
    process.env.HARK_DEBUG === "1";

  const write = (level: LogRecord["level"], message: string, extra?: Record<string, unknown>) => {
    if (options.quiet && level === "info") return;
    if (level === "debug" && !debugEnabled) return;
    const record: LogRecord = {
      level,
      message,
      time: new Date().toISOString(),
      requestId: getRequestId(),
      extra,
    };
    for (const sink of sinks) {
      void Promise.resolve(sink.write(record)).catch((error) => {
        console.error("[kinara:error] log sink failed", error);
      });
    }
  };

  return {
    debug: (message, extra) => write("debug", message, extra),
    info: (message, extra) => write("info", message, extra),
    warn: (message, extra) => write("warn", message, extra),
    error: (message, extra) => write("error", message, extra),
    use(sink) {
      sinks.push(sink);
    },
    async flush() {
      await Promise.all(sinks.map((sink) => sink.flush?.()));
    },
  };
}

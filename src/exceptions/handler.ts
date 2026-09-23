import { getRequestId } from "../context.js";
import { KinaraError, toKinaraError } from "../errors.js";
import { fail } from "../http/response.js";
import { isProduction, type RuntimeMode } from "../runtime.js";
import { getTracer } from "../telemetry/otel.js";
import type { Logger } from "../logger.js";

export type ExceptionReporter = (error: KinaraError, context: { requestId?: string }) => void | Promise<void>;

export class ExceptionHandler {
  private readonly reporters: ExceptionReporter[] = [];
  private readonly silent = new Set<string>(["NOT_FOUND", "VALIDATION_ERROR", "UNAUTHORIZED", "FORBIDDEN"]);

  constructor(private readonly logger?: Logger) {}

  reportUsing(reporter: ExceptionReporter): this {
    this.reporters.push(reporter);
    return this;
  }

  dontReport(code: string): this {
    this.silent.add(code);
    return this;
  }

  shouldReport(error: KinaraError): boolean {
    return !this.silent.has(error.code) && error.statusCode >= 500;
  }

  async report(error: unknown): Promise<KinaraError> {
    const mapped = toKinaraError(error);
    const requestId = getRequestId();
    const span = getTracer("kinara.exceptions").startSpan("exception.report");
    span.setAttribute?.("error.code", mapped.code);
    span.setAttribute?.("error.status", mapped.statusCode);
    if (requestId) span.setAttribute?.("request.id", requestId);
    span.recordException?.(mapped);
    try {
      if (this.shouldReport(mapped)) {
        this.logger?.error(mapped.message, { code: mapped.code, requestId });
        for (const reporter of this.reporters) {
          await reporter(mapped, { requestId });
        }
      }
    } finally {
      span.end();
    }
    return mapped;
  }

  render(error: unknown, mode?: RuntimeMode) {
    const mapped = toKinaraError(error);
    const production = mode ? mode === "production" : isProduction();
    const message = mapped.expose || !production ? mapped.message : "Internal server error";
    const details = mapped.expose || !production ? mapped.details : undefined;
    return {
      status: mapped.statusCode,
      body: {
        ...fail(mapped.code, message, details),
        meta: { requestId: getRequestId() },
      },
    };
  }
}

export async function report(error: unknown, handler?: ExceptionHandler): Promise<KinaraError> {
  return (handler ?? new ExceptionHandler()).report(error);
}

export async function rescue<T>(fn: () => Promise<T> | T, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch {
    return fallback;
  }
}

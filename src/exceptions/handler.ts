import { getRequestId } from "../context.js";
import { KinaraError, toKinaraError } from "../errors.js";
import { fail } from "../http/response.js";
import { isProduction, type RuntimeMode } from "../runtime.js";
import { getTracer } from "../telemetry/otel.js";
import type { Logger } from "../logger.js";

export type ExceptionReporter = (error: KinaraError, context: { requestId?: string }) => void | Promise<void>;

export type ResponseStyle = "envelope" | "legacy";

const LEGACY_NAMES: Record<string, string> = {
  BAD_REQUEST: "BadRequestException",
  UNAUTHORIZED: "UnauthorizedException",
  FORBIDDEN: "ForbiddenException",
  NOT_FOUND: "NotFoundException",
  CONFLICT: "ConflictException",
  VALIDATION_ERROR: "validationException",
  RATE_LIMITED: "RateLimitException",
};

export class ExceptionHandler {
  responseStyle: ResponseStyle = "envelope";
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

  render(error: unknown, mode?: RuntimeMode): { status: number; body: Record<string, unknown> } {
    const mapped = toKinaraError(error);
    if (this.responseStyle === "legacy") return renderLegacy(mapped, mode);
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

function renderLegacy(mapped: KinaraError, mode?: RuntimeMode) {
  const production = mode ? mode === "production" : isProduction();
  if (mapped.statusCode >= 500) {
    const msg = mapped.expose && !production ? mapped.message : "something went wrong";
    return {
      status: mapped.statusCode,
      body: { success: false, msg },
    };
  }
  const fieldMap =
    mapped.details && typeof mapped.details === "object" && !Array.isArray(mapped.details);
  const name =
    mapped.legacyName ??
    (mapped.code === "VALIDATION_ERROR" && fieldMap ? "ValidationException" : undefined) ??
    LEGACY_NAMES[mapped.code] ??
    "RequestException";
  return {
    status: mapped.statusCode,
    body: {
      success: false,
      code: mapped.statusCode,
      name,
      errors: mapped.details === undefined ? mapped.message : mapped.details,
    },
  };
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

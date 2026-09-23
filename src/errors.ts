export class KinaraError extends Error {
  readonly code: string;
  readonly statusCode: number;
  readonly details?: unknown;
  readonly expose: boolean;

  constructor(
    message: string,
    options:
      | string
      | {
          code?: string;
          statusCode?: number;
          details?: unknown;
          expose?: boolean;
        } = {}
  ) {
    super(message);
    this.name = this.constructor.name;
    const opts = typeof options === "string" ? { code: options } : options;
    this.code = opts.code ?? "KINARA_ERROR";
    this.statusCode = opts.statusCode ?? 500;
    this.details = opts.details;
    this.expose = opts.expose ?? this.statusCode < 500;
  }
}

/** @deprecated Use KinaraError */
export const HarkError = KinaraError;
/** @deprecated Use KinaraError */
export const PulseError = KinaraError;

export class NotBootedError extends KinaraError {
  constructor() {
    super("Kinara has not been started. Call createApp() first.", {
      code: "NOT_BOOTED",
      statusCode: 500,
      expose: false,
    });
  }
}

export class UnboundServiceError extends KinaraError {
  constructor(key: string) {
    super(`Service '${key}' is not bound.`, { code: "UNBOUND_SERVICE", statusCode: 500 });
  }
}

export class InvalidEventNameError extends KinaraError {
  constructor(event: string) {
    super(`Invalid event name '${event}'. Use names like user.created or billing:invoice-paid.`, {
      code: "INVALID_EVENT_NAME",
      statusCode: 400,
    });
  }
}

export class UnknownDriverError extends KinaraError {
  constructor(name: string) {
    super(`Event driver '${name}' is not registered.`, { code: "UNKNOWN_DRIVER", statusCode: 500 });
  }
}

export class PathEscapeError extends KinaraError {
  constructor(filePath: string) {
    super(`Path '${filePath}' escapes the storage root.`, { code: "PATH_ESCAPE", statusCode: 400 });
  }
}

export class ValidationError extends KinaraError {
  constructor(message: string, details?: unknown) {
    super(message, { code: "VALIDATION_ERROR", statusCode: 422, details, expose: true });
  }
}

export class BadRequestError extends KinaraError {
  constructor(message = "Bad request", details?: unknown) {
    super(message, { code: "BAD_REQUEST", statusCode: 400, details, expose: true });
  }
}

export class UnauthorizedError extends KinaraError {
  constructor(message = "Authentication required") {
    super(message, { code: "UNAUTHORIZED", statusCode: 401, expose: true });
  }
}

export class ForbiddenError extends KinaraError {
  constructor(permission?: string) {
    super(permission ? `Missing permission: ${permission}` : "Forbidden", {
      code: "FORBIDDEN",
      statusCode: 403,
      expose: true,
    });
  }
}

export class NotFoundError extends KinaraError {
  constructor(resource = "Resource") {
    super(`${resource} not found`, { code: "NOT_FOUND", statusCode: 404, expose: true });
  }
}

export class ConflictError extends KinaraError {
  constructor(message = "Conflict") {
    super(message, { code: "CONFLICT", statusCode: 409, expose: true });
  }
}

export class RateLimitError extends KinaraError {
  constructor(retryAfterMs?: number) {
    super("Too many requests", {
      code: "RATE_LIMITED",
      statusCode: 429,
      details: retryAfterMs ? { retryAfterMs } : undefined,
      expose: true,
    });
  }
}

export function toKinaraError(error: unknown): KinaraError {
  if (error instanceof KinaraError) return error;
  if (error && typeof error === "object") {
    const candidate = error as {
      message?: string;
      code?: string;
      statusCode?: number;
      details?: unknown;
      expose?: boolean;
    };
    if (typeof candidate.statusCode === "number" || typeof candidate.code === "string") {
      return new KinaraError(candidate.message || "Request failed", {
        code: candidate.code ?? "REQUEST_FAILED",
        statusCode: candidate.statusCode ?? 500,
        details: candidate.details,
        expose: candidate.expose,
      });
    }
  }
  if (error instanceof Error) {
    return new KinaraError(error.message, { code: "INTERNAL_ERROR", statusCode: 500, expose: false });
  }
  return new KinaraError("Unexpected error", { code: "INTERNAL_ERROR", statusCode: 500, expose: false });
}

/** @deprecated Use toKinaraError */
export const toHarkError = toKinaraError;

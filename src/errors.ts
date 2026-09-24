export class KinaraError extends Error {
  readonly code: string;
  readonly statusCode: number;
  readonly details?: unknown;
  readonly expose: boolean;
  /** Preserved when an existing service exception already has a client-facing name. */
  legacyName?: string;

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

function codeForStatus(status: number): string {
  if (status === 400) return "BAD_REQUEST";
  if (status === 401) return "UNAUTHORIZED";
  if (status === 403) return "FORBIDDEN";
  if (status === 404) return "NOT_FOUND";
  if (status === 409) return "CONFLICT";
  if (status === 422) return "VALIDATION_ERROR";
  if (status === 429) return "RATE_LIMITED";
  return status >= 500 ? "INTERNAL_ERROR" : "REQUEST_FAILED";
}

function duplicateKeyError(error: unknown): KinaraError | undefined {
  if (!error || typeof error !== "object") return undefined;
  const candidate = error as { code?: unknown; keyPattern?: Record<string, unknown> };
  if (candidate.code !== 11000) return undefined;
  const field = Object.keys(candidate.keyPattern ?? {})[0] ?? "value";
  const mapped = new ValidationError("Validation failed", {
    [field]: `record with this ${field} already exists.`,
  });
  mapped.legacyName = "ValidationException";
  return mapped;
}

function mongooseValidationError(error: unknown): KinaraError | undefined {
  if (!error || typeof error !== "object") return undefined;
  const candidate = error as {
    name?: string;
    errors?: Record<string, { message?: string; properties?: { message?: string } }>;
  };
  if (candidate.name !== "ValidationError" || !candidate.errors || typeof candidate.errors !== "object") {
    return undefined;
  }
  const details: Record<string, string> = {};
  for (const [field, item] of Object.entries(candidate.errors)) {
    details[field] = item?.properties?.message ?? item?.message ?? "Invalid";
  }
  const mapped = new ValidationError("Validation failed", details);
  mapped.legacyName = "ValidationException";
  return mapped;
}

function legacyServiceError(error: unknown): KinaraError | undefined {
  if (!error || typeof error !== "object") return undefined;
  const candidate = error as {
    code?: unknown;
    success?: boolean;
    name?: string;
    errors?: unknown;
    message?: string;
  };
  if (typeof candidate.code !== "number" || candidate.code < 400 || candidate.code > 599) return undefined;
  if (candidate.success !== false && candidate.errors === undefined) return undefined;
  const message =
    typeof candidate.errors === "string"
      ? candidate.errors
      : candidate.message || "Request failed";
  const mapped = new KinaraError(message, {
    code: codeForStatus(candidate.code),
    statusCode: candidate.code,
    details: candidate.errors,
    expose: candidate.code < 500,
  });
  if (candidate.name) mapped.legacyName = candidate.name;
  return mapped;
}

export function toKinaraError(error: unknown): KinaraError {
  if (error instanceof KinaraError) return error;

  const duplicate = duplicateKeyError(error);
  if (duplicate) return duplicate;

  const mongooseValidation = mongooseValidationError(error);
  if (mongooseValidation) return mongooseValidation;

  const legacy = legacyServiceError(error);
  if (legacy) return legacy;

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

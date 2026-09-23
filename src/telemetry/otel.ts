export interface SpanLike {
  end(): void;
  recordException?(error: unknown): void;
  setAttribute?(key: string, value: string | number | boolean): void;
}

export interface TracerLike {
  startSpan(name: string): SpanLike;
}

export interface TelemetryAdapter {
  getTracer(name?: string): TracerLike;
}

const NOOP: TelemetryAdapter = {
  getTracer: () => ({
    startSpan: () => ({ end: () => undefined }),
  }),
};

let adapter: TelemetryAdapter = NOOP;

export function useTelemetry(next: TelemetryAdapter): void {
  adapter = next;
}

export function getTracer(name = "kinara"): TracerLike {
  return adapter.getTracer(name);
}

export async function withSpan<T>(name: string, fn: (span: SpanLike) => Promise<T> | T): Promise<T> {
  const span = getTracer().startSpan(name);
  try {
    return await fn(span);
  } catch (error) {
    span.recordException?.(error);
    throw error;
  } finally {
    span.end();
  }
}

/**
 * Bind any OpenTelemetry TracerProvider / API-compatible adapter.
 * Example: useOpenTelemetry(require('@opentelemetry/api'))
 */
export function useOpenTelemetry(api: {
  trace: { getTracer(name: string): { startSpan(name: string): SpanLike } };
}): void {
  useTelemetry({
    getTracer: (name = "kinara") => api.trace.getTracer(name),
  });
}

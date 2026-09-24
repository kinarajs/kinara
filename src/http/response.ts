import type { Response } from "express";

export interface SuccessEnvelope<T> {
  ok: true;
  data: T;
  meta?: Record<string, unknown>;
}

export interface ErrorEnvelope {
  ok: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export type Envelope<T = unknown> = SuccessEnvelope<T> | ErrorEnvelope;

export function ok<T>(data: T, meta?: Record<string, unknown>): SuccessEnvelope<T> {
  return meta ? { ok: true, data, meta } : { ok: true, data };
}

export function fail(
  code: string,
  message: string,
  details?: unknown
): ErrorEnvelope {
  return {
    ok: false,
    error: details === undefined ? { code, message } : { code, message, details },
  };
}

export function paginated<T>(
  items: T[],
  meta: { page: number; pageSize: number; total: number }
): SuccessEnvelope<T[]> {
  return ok(items, {
    page: meta.page,
    pageSize: meta.pageSize,
    total: meta.total,
    pages: Math.max(1, Math.ceil(meta.total / Math.max(meta.pageSize, 1))),
  });
}

export function sendOk<T>(res: Response, data: T, status = 200, meta?: Record<string, unknown>): void {
  res.status(status).json(ok(data, meta));
}

export function sendFail(
  res: Response,
  code: string,
  message: string,
  status = 400,
  details?: unknown
): void {
  res.status(status).json(fail(code, message, details));
}

export function sendCreated<T>(res: Response, data: T): void {
  sendOk(res, data, 201);
}

/** `{ success: true, ...data }` used by services that predate the Kinara envelope. */
export function legacyOk<T extends Record<string, unknown>>(data: T): { success: true } & T {
  return { success: true, ...data };
}

export function sendLegacy<T extends Record<string, unknown>>(
  res: Response,
  data: T,
  status = 200
): void {
  res.status(status).json(legacyOk(data));
}

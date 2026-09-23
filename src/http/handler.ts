import type { NextFunction, Request, RequestHandler, Response } from "express";

export type AsyncRoute = (req: Request, res: Response, next: NextFunction) => unknown | Promise<unknown>;

/** Wrap async routes so thrown KinaraError values become JSON envelopes. */
export function handle(fn: AsyncRoute): RequestHandler {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

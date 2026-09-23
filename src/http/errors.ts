import type { ErrorRequestHandler, RequestHandler } from "express";
import { fail } from "./response.js";
import type { RuntimeMode } from "../runtime.js";
import { ExceptionHandler } from "../exceptions/handler.js";

export function notFoundHandler(): RequestHandler {
  return (_req, res) => {
    res.status(404).json(fail("NOT_FOUND", "Route not found"));
  };
}

export function errorHandler(mode?: RuntimeMode, handler?: ExceptionHandler): ErrorRequestHandler {
  const exceptions = handler ?? new ExceptionHandler();
  return async (err, _req, res, _next) => {
    const mapped = await exceptions.report(err);
    const rendered = exceptions.render(mapped, mode);
    if (!res.headersSent) {
      res.status(rendered.status).json(rendered.body);
    }
  };
}

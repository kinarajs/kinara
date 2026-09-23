import type { RequestHandler } from "express";
import { createRequestId, runWithContext } from "../context.js";
import { isProduction, type RuntimeMode } from "../runtime.js";

export function requestContext(): RequestHandler {
  return (req, res, next) => {
    const requestId = String(req.headers["x-request-id"] || createRequestId());
    res.setHeader("x-request-id", requestId);
    runWithContext({ requestId }, () => next());
  };
}

export function securityHeaders(mode?: RuntimeMode): RequestHandler {
  const production = mode ? mode === "production" : isProduction();
  return (_req, res, next) => {
    res.removeHeader("x-powered-by");
    res.setHeader("x-content-type-options", "nosniff");
    res.setHeader("referrer-policy", "no-referrer");
    res.setHeader("x-frame-options", "DENY");
    res.setHeader("permissions-policy", "camera=(), microphone=(), geolocation=()");
    res.setHeader("x-dns-prefetch-control", "off");
    if (production) {
      res.setHeader("strict-transport-security", "max-age=15552000; includeSubDomains");
    }
    next();
  };
}

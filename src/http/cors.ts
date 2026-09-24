import type { RequestHandler } from "express";

export interface CorsOptions {
  /** `true` reflects the request origin. A list allows only those origins. */
  origin?: boolean | string | string[];
  credentials?: boolean;
  methods?: string;
  allowedHeaders?: string;
  exposedHeaders?: string[];
}

function allowedOrigin(origin: string | undefined, options: CorsOptions): string | undefined {
  const rule = options.origin ?? true;
  if (rule === false) return undefined;
  if (rule === true) return options.credentials ? origin ?? "*" : "*";
  if (typeof rule === "string") return rule === origin || rule === "*" ? rule : undefined;
  if (!origin) return undefined;
  return rule.includes(origin) ? origin : undefined;
}

/** CORS without the `cors` package. Enable from `createApp({ cors })` or `config/cors.ts`. */
export function cors(options: CorsOptions = {}): RequestHandler {
  const methods = options.methods ?? "GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS";
  return (req, res, next) => {
    const requestOrigin = typeof req.headers.origin === "string" ? req.headers.origin : undefined;
    const origin = allowedOrigin(requestOrigin, options);
    if (origin) {
      res.setHeader("Access-Control-Allow-Origin", origin);
      if (origin !== "*") res.setHeader("Vary", "Origin");
    }
    if (options.credentials) res.setHeader("Access-Control-Allow-Credentials", "true");
    if (options.exposedHeaders?.length) {
      res.setHeader("Access-Control-Expose-Headers", options.exposedHeaders.join(", "));
    }
    if (req.method === "OPTIONS") {
      res.setHeader("Access-Control-Allow-Methods", methods);
      const requested = req.headers["access-control-request-headers"];
      res.setHeader(
        "Access-Control-Allow-Headers",
        options.allowedHeaders ?? (typeof requested === "string" ? requested : "Content-Type, Authorization")
      );
      res.status(204).end();
      return;
    }
    next();
  };
}

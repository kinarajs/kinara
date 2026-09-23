import type { Express, Router } from "express";
import type { Server } from "node:http";
import { KinaraError } from "../errors.js";
import type { RuntimeMode } from "../runtime.js";

export async function createHttp(
  mode: RuntimeMode = "development"
): Promise<{ http: Express; router: Router }> {
  try {
    const express = (await import("express")).default;
    const http = express();
    http.disable("x-powered-by");
    http.use(express.json({ limit: mode === "production" ? "256kb" : "1mb" }));
    http.use(express.urlencoded({ extended: true, limit: mode === "production" ? "256kb" : "1mb" }));
    const router = express.Router();
    return { http, router };
  } catch {
    throw new KinaraError("HTTP support requires `express`.", { code: "MISSING_PEER" });
  }
}

export function listen(http: Express, port: number, host = "0.0.0.0"): Promise<Server> {
  return new Promise((resolve, reject) => {
    const server = http.listen(port, host, () => resolve(server));
    server.on("error", reject);
  });
}

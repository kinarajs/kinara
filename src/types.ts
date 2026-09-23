import type { RequestHandler } from "express";
import type { RuntimeMode } from "./runtime.js";
import type { TelemetryAdapter } from "./telemetry/otel.js";

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonObject | JsonValue[];
export type JsonObject = { [key: string]: JsonValue };

export interface ServiceProvider {
  register?(app: import("./app.js").Kinara): void | Promise<void>;
  boot?(app: import("./app.js").Kinara): void | Promise<void>;
}

export interface EventDriver {
  readonly name: string;
  connect?(): Promise<void>;
  close?(): Promise<void>;
  on(event: string, listener: EventListener): Promise<void> | void;
  off(event: string, listener: EventListener): Promise<void> | void;
  emit(event: string, payload: unknown): Promise<void> | void;
}

export type EventListener = (payload: unknown, event: string) => unknown | Promise<unknown>;

export type EventDriverFactory = (options?: Record<string, unknown>) => EventDriver;

export interface HookMeta {
  id: string;
  name?: string;
}

export interface HookContext {
  event: string;
  app: import("./app.js").Kinara;
}

export interface Hook<T = unknown> {
  meta(): HookMeta;
  listenTo(): string[];
  handle(payload: T, context: HookContext): unknown | Promise<unknown>;
}

export type HookDefinition<T = unknown> = {
  id: string;
  name?: string;
  on: string | string[];
  handle: (payload: T, context: HookContext) => unknown | Promise<unknown>;
};

export type MiddlewareFn = RequestHandler;

export type MiddlewareFactory = (app: import("./app.js").Kinara) => MiddlewareFn;

export type RouteRegistrar = (
  http: import("express").Express,
  router: import("express").Router,
  middleware: (name: string) => MiddlewareFn
) => void | Promise<void>;

export interface CreateAppOptions {
  /** Folder that contains `modules/`, `config/`, and `middleware/`. */
  root?: string;
  modulesDir?: string;
  configDir?: string;
  mode?: RuntimeMode | string;
  quiet?: boolean;
  events?: {
    driver?: string;
    options?: Record<string, unknown>;
    drivers?: Record<string, EventDriverFactory>;
  };
  providers?: Array<new (app: import("./app.js").Kinara) => ServiceProvider>;
  telemetry?: TelemetryAdapter;
  otel?: { trace: { getTracer(name: string): { startSpan(name: string): { end(): void } } } };
}

import path from "node:path";
import type { Express, RequestHandler, Router } from "express";
import type { Server } from "node:http";
import { Container } from "./container.js";
import { ConfigRepository } from "./config/repository.js";
import { loadConfig } from "./config/load.js";
import { EventBus } from "./events/bus.js";
import { createRabbitMqDriver } from "./events/drivers/rabbitmq.js";
import { HookRegistry } from "./hooks/registry.js";
import { loadHooks } from "./hooks/loader.js";
import { MiddlewareManager } from "./http/middleware.js";
import { createHttp, listen } from "./http/server.js";
import { loadRoutes } from "./http/routes.js";
import { loadNamedMiddleware } from "./http/named-middleware.js";
import { loadModuleProviders } from "./providers/loader.js";
import { StorageManager } from "./storage/manager.js";
import { createLogger, type Logger } from "./logger.js";
import { KinaraError, NotBootedError } from "./errors.js";
import { resolveMode, type RuntimeMode } from "./runtime.js";
import { CacheManager, MemoryCache, createRedisCache } from "./cache/manager.js";
import { PermissionGate } from "./auth/permissions.js";
import { requestContext, securityHeaders } from "./http/security.js";
import { createRateLimiter } from "./http/rate-limit.js";
import { errorHandler, notFoundHandler } from "./http/errors.js";
import { ok } from "./http/response.js";
import { loadRpc } from "./grpc/loader.js";
import { KinaraGrpcServer } from "./grpc/server.js";
import { connectMongo, type MongoHandle } from "./db/mongo.js";
import { connectMongoose, type MongooseHandle } from "./db/mongoose.js";
import { createS3LogSink } from "./log/s3.js";
import { cors as corsMiddleware, type CorsOptions } from "./http/cors.js";
import { cookies as cookiesMiddleware } from "./http/cookies.js";
import { createMemcachedCache } from "./cache/manager.js";
import type { ResponseStyle } from "./exceptions/handler.js";
import { useOpenTelemetry, useTelemetry } from "./telemetry/otel.js";
import { ExceptionHandler } from "./exceptions/handler.js";
import { KinaraWebsocket } from "./ws/server.js";
import { bindMongoCollections, resetCollections } from "./orm/store.js";
import { setEncryptionKey } from "./crypto/fields.js";
import { loadEnv } from "./env.js";
import type { CreateAppOptions, HttpAppOptions, ServiceProvider } from "./types.js";

export class Kinara {
  readonly root: string;
  readonly mode: RuntimeMode;
  readonly container = new Container();
  readonly middleware = new MiddlewareManager();
  readonly permissions = new PermissionGate();
  readonly logger: Logger;

  config!: ConfigRepository;
  events!: EventBus;
  hooks!: HookRegistry;
  storage!: StorageManager;
  cache!: CacheManager;
  http?: Express;
  router?: Router;
  grpc?: KinaraGrpcServer;
  mongo?: MongoHandle;
  mongoose?: MongooseHandle;
  exceptions = new ExceptionHandler();
  ws = new KinaraWebsocket();

  private server?: Server;
  private httpFinalized = false;

  constructor(root: string, mode: RuntimeMode, quiet: boolean) {
    this.root = path.resolve(root);
    this.mode = mode;
    this.logger = createLogger({ quiet, json: mode === "production" });
    this.exceptions = new ExceptionHandler(this.logger);
    this.ws = new KinaraWebsocket(this.logger);
    this.container.instance("kinara", this);
    this.container.instance("app", this);
  }

  getPath(relative = ""): string {
    return path.join(this.root, relative);
  }

  make<T>(key: string): T {
    return this.container.make<T>(key);
  }

  async emit<T>(event: string, payload?: T): Promise<this> {
    await this.events.emit(event, payload);
    return this;
  }

  async emitSafe<T>(event: string, payload?: T): Promise<this> {
    await this.events.emitSafe(event, payload);
    return this;
  }

  async connectMongoose(url: string): Promise<MongooseHandle> {
    this.mongoose = await connectMongoose(url);
    this.container.instance("mongoose", this.mongoose);
    return this.mongoose;
  }

  use(path: string, ...handlers: RequestHandler[]): this;
  use(...handlers: RequestHandler[]): this;
  use(...args: unknown[]): this {
    if (!this.http) {
      throw new KinaraError("HTTP is not enabled.", { code: "HTTP_DISABLED" });
    }
    (this.http.use as (...useArgs: unknown[]) => unknown)(...args);
    return this;
  }

  mount(handler: RequestHandler): this;
  mount(path: string, handler: RequestHandler): this;
  mount(pathOrHandler: string | RequestHandler, handler?: RequestHandler): this {
    if (typeof pathOrHandler === "string") {
      if (!handler) {
        throw new KinaraError("mount(path, handler) requires a handler.", { code: "HTTP_DISABLED" });
      }
      return this.use(pathOrHandler, handler);
    }
    return this.use(pathOrHandler);
  }

  finalizeHttp(): this {
    if (!this.http || this.httpFinalized) return this;
    this.http.use(notFoundHandler());
    this.http.use(errorHandler(this.mode, this.exceptions));
    this.httpFinalized = true;
    return this;
  }

  async listen(port = Number(process.env.PORT) || 3000, host?: string): Promise<Server> {
    if (!this.http) {
      throw new KinaraError("HTTP is not enabled.", { code: "HTTP_DISABLED" });
    }
    this.finalizeHttp();
    this.server = await listen(this.http, port, host);
    this.logger.info(`http listening on ${host ?? "0.0.0.0"}:${port}`);
    if (this.config.get("app.websocket", false)) {
      await this.ws.attach(this.server);
      this.logger.info("websocket attached");
    }
    if (this.config.get("app.grpc", true) && this.grpc) {
      await this.grpc.listen(Number(process.env.GRPC_PORT) || 50051);
    }
    return this.server;
  }

  async close(): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      if (!this.server) {
        resolve();
        return;
      }
      this.server.close((err) => (err ? reject(err) : resolve()));
    });
    await this.ws.close();
    await this.grpc?.close();
    await this.events.close();
    await this.cache.close();
    await this.mongoose?.close();
    await this.mongo?.close();
    await this.logger.flush();
  }
}

export async function emitSafe(event: string, payload?: unknown): Promise<void> {
  if (!current) return;
  await current.emitSafe(event, payload);
}

let current: Kinara | null = null;

export function currentApp(): Kinara {
  if (!current) throw new NotBootedError();
  return current;
}

export function app(): Kinara {
  return currentApp();
}

export function event(): EventBus {
  return currentApp().events;
}

export function server(): Express {
  const http = currentApp().http;
  if (!http) throw new KinaraError("HTTP server is not available.", { code: "HTTP_DISABLED" });
  return http;
}

export async function createApp(options: CreateAppOptions = {}): Promise<Kinara> {
  const root = options.root ?? path.resolve("src");
  loadEnv(root);
  const mode = resolveMode(options.mode);
  const quiet = options.quiet ?? process.env.KINARA_DEBUG !== "1";
  const kinara = new Kinara(root, mode, quiet);
  current = kinara;

  kinara.config = await loadConfig(root, options.configDir ?? "config");
  kinara.container.instance("config", kinara.config);

  if (options.telemetry) useTelemetry(options.telemetry);
  else if (options.otel) useOpenTelemetry(options.otel);

  const s3 = kinara.config.get<{ bucket: string; prefix?: string; region?: string }>("log.s3");
  if (s3?.bucket) {
    kinara.logger.use(createS3LogSink(s3));
  }

  kinara.storage = StorageManager.createDefault(root);
  kinara.container.instance("filesystem", kinara.storage);

  kinara.cache = new CacheManager(new MemoryCache());
  const cacheDriver = kinara.config.get<string>("cache.driver", "memory");
  if (cacheDriver === "redis") {
    const url = kinara.config.get<string>("cache.redis.url") || process.env.REDIS_URL;
    if (url) kinara.cache.use(await createRedisCache(url));
  } else if (cacheDriver === "memcached") {
    const servers =
      kinara.config.get<string | string[]>("cache.memcached.servers") || process.env.MEMCACHED_SERVERS;
    if (servers) kinara.cache.use(await createMemcachedCache(servers));
  }
  kinara.exceptions.responseStyle =
    options.responses ?? kinara.config.get<ResponseStyle>("app.responses", "envelope") ?? "envelope";
  kinara.container.instance("cache", kinara.cache);

  const encryptionKey = kinara.config.get<string>("crypto.key") || process.env.KINARA_KEY;
  if (encryptionKey) setEncryptionKey(encryptionKey);

  const mongoUrl = kinara.config.get<string>("mongo.url") || process.env.MONGO_URL;
  if (mongoUrl) {
    kinara.mongo = await connectMongo(mongoUrl);
    kinara.container.instance("mongo", kinara.mongo);
    const db = kinara.mongo.db() as { collection: (name: string) => unknown };
    if (typeof db?.collection === "function") bindMongoCollections(db);
  }

  kinara.events = new EventBus(kinara.logger);
  kinara.events.registerDriver("rabbitmq", createRabbitMqDriver);
  for (const [name, factory] of Object.entries(options.events?.drivers ?? {})) {
    kinara.events.registerDriver(name, factory);
  }

  const driver =
    options.events?.driver ??
    kinara.config.get<string>("events.driver", "memory") ??
    "memory";
  const driverOptions =
    options.events?.options ??
    kinara.config.get<Record<string, unknown>>(`events.${driver}`, {}) ??
    {};
  await kinara.events.use(driver, driverOptions);
  kinara.container.instance("events", kinara.events);

  kinara.hooks = new HookRegistry(kinara.events, kinara.logger);
  kinara.container.instance("hooks", kinara.hooks);

  const roles = kinara.config.get<Record<string, string[]>>("permissions.roles", {});
  for (const [role, permissions] of Object.entries(roles ?? {})) {
    kinara.permissions.role(role, permissions);
  }
  kinara.container.instance("permissions", kinara.permissions);

  const httpOptions: HttpAppOptions = typeof options.http === "object" ? options.http : {};
  const enableHttp = options.http !== false && kinara.config.get<boolean>("app.http", true) !== false;
  if (enableHttp) {
    try {
      const created = await createHttp(mode, {
        jsonLimit: httpOptions.jsonLimit ?? kinara.config.get<string>("app.bodyLimit"),
        urlencodedLimit: httpOptions.urlencodedLimit,
      });
      kinara.http = created.http;
      kinara.router = created.router;
      if (mode === "production") {
        kinara.http.set("trust proxy", 1);
      }
      kinara.http.set("kinara", kinara);
      kinara.http.use(requestContext());
      kinara.http.use(securityHeaders(mode));
      const corsOptions = resolveCors(options.cors, kinara.config.get<CorsOptions>("cors"));
      if (corsOptions) kinara.http.use(corsMiddleware(corsOptions));
      const cookiesEnabled =
        options.cookies === true || kinara.config.get<boolean>("cookies.enabled", false) === true;
      if (cookiesEnabled) kinara.http.use(cookiesMiddleware());
      const rateConfig = kinara.config.get<{ enabled?: boolean; max?: number; windowMs?: number }>(
        "rateLimit",
        {}
      );
      const rate =
        options.rateLimit === false
          ? { enabled: false }
          : {
              ...rateConfig,
              ...(typeof options.rateLimit === "object" ? options.rateLimit : {}),
            };
      const rateEnabled = rate.enabled ?? mode === "production";
      if (rateEnabled) {
        kinara.http.use(createRateLimiter({ ...rate, enabled: true }, kinara.cache));
      }
      const healthEnabled =
        options.health !== false &&
        httpOptions.health !== false &&
        kinara.config.get<boolean>("app.health", true) !== false;
      if (healthEnabled) {
        const service =
          options.serviceName ??
          kinara.config.get<string>("app.name") ??
          process.env.SERVICE_NAME ??
          process.env.npm_package_name ??
          "kinara";
        const payload = () => ok({ status: "ok", service });
        kinara.http.get("/health", (_req, res) => {
          res.json(payload());
        });
        kinara.http.get("/healthz", (_req, res) => {
          res.json(payload());
        });
      }
      kinara.container.instance("http", kinara.http);
      kinara.container.instance("router", kinara.router);
    } catch (error) {
      kinara.logger.warn(error instanceof Error ? error.message : String(error));
    }
  }

  kinara.container.instance("middleware", kinara.middleware.resolver());
  kinara.container.instance("middlewareManager", kinara.middleware);

  const extraProviders = (options.providers ?? []).map((Provider) => new Provider(kinara));
  const modulesDir =
    options.modulesDir ?? kinara.config.get("app.modulesDir", "modules") ?? "modules";
  const moduleProviders = await loadModuleProviders(kinara, modulesDir);
  const providers: ServiceProvider[] = [...extraProviders, ...moduleProviders];

  for (const provider of providers) {
    await provider.register?.(kinara);
  }

  await loadNamedMiddleware(kinara);
  const hookCount = await loadHooks(kinara, modulesDir);
  const routeCount = await loadRoutes(kinara, modulesDir);
  kinara.grpc = await loadRpc(kinara, modulesDir);

  for (const provider of providers) {
    await provider.boot?.(kinara);
  }

  kinara.logger.info(
    `ready mode=${mode} hooks=${hookCount} routes=${routeCount} driver=${kinara.events.driverName()}`
  );
  kinara.container.instance("kinara", kinara);
  return kinara;
}

export function resetCurrentApp(): void {
  current = null;
  resetCollections();
  setEncryptionKey(undefined);
}

function resolveCors(
  option: boolean | CorsOptions | undefined,
  configured: CorsOptions | undefined
): CorsOptions | undefined {
  if (option === false) return undefined;
  if (option === true) return {};
  if (option && typeof option === "object") return option;
  if (configured && typeof configured === "object") return configured;
  return undefined;
}

export const start = createApp;
/** @deprecated Use Kinara */
export const Hark = Kinara;
/** @deprecated Use Kinara */
export const Pulse = Kinara;

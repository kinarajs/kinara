import path from "node:path";
import { writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { randomBytes } from "node:crypto";
import type { Kinara } from "../app.js";
import type { RpcService } from "./define.js";
import { KinaraError, toKinaraError } from "../errors.js";

type GrpcLike = {
  Server: new () => {
    addService(service: unknown, impl: Record<string, unknown>): void;
    bindAsync(
      address: string,
      creds: unknown,
      cb: (err: Error | null, port: number) => void
    ): void;
    tryShutdown(cb: () => void): void;
  };
  ServerCredentials: { createInsecure(): unknown };
  loadPackageDefinition(def: unknown): Record<string, unknown>;
  status: {
    INVALID_ARGUMENT: number;
    UNAUTHENTICATED: number;
    PERMISSION_DENIED: number;
    NOT_FOUND: number;
    RESOURCE_EXHAUSTED: number;
    FAILED_PRECONDITION: number;
    INTERNAL: number;
  };
};

type ProtoLoaderLike = {
  loadSync(file: string, options: Record<string, unknown>): unknown;
};

export class KinaraGrpcServer {
  private server?: InstanceType<GrpcLike["Server"]>;
  private grpc?: GrpcLike;
  private boundPort?: number;

  constructor(private readonly app: Kinara) {}

  async add(service: RpcService): Promise<void> {
    const { grpc, protoLoader } = await loadGrpc();
    this.grpc = grpc;
    this.server ??= new grpc.Server();

    const protoFile = await resolveProto(service);
    const packageDefinition = protoLoader.loadSync(protoFile, {
      keepCase: true,
      longs: String,
      enums: String,
      defaults: true,
      oneofs: true,
    });
    const loaded = grpc.loadPackageDefinition(packageDefinition);
    const def = service.package
      .split(".")
      .reduce<unknown>((acc, key) => (acc as Record<string, unknown> | undefined)?.[key], loaded) as
      | { service?: unknown }
      | undefined;
    const serviceDef = (def as { [key: string]: { service?: unknown } } | undefined)?.[service.service] ?? def;
    if (!serviceDef?.service) {
      throw new KinaraError(`gRPC service ${service.package}.${service.service} not found in proto`, {
        code: "GRPC_SERVICE_MISSING",
      });
    }

    const impl: Record<string, unknown> = {};
    for (const [name, handler] of Object.entries(service.methods)) {
      impl[name] = async (
        call: { request?: Record<string, unknown> },
        callback: (err: { code: number; message: string } | null, value?: unknown) => void
      ) => {
        try {
          const result = await handler(call.request ?? {}, { app: this.app });
          callback(null, result ?? {});
        } catch (error) {
          const mapped = toKinaraError(error);
          callback({
            code: statusFromHttp(mapped.statusCode, grpc),
            message: mapped.expose ? mapped.message : "Internal server error",
          });
        }
      };
    }

    this.server.addService(serviceDef.service, impl);
  }

  async listen(port = Number(process.env.GRPC_PORT) || 50051): Promise<number> {
    if (!this.server || !this.grpc) {
      throw new KinaraError("No gRPC services were registered.", { code: "GRPC_EMPTY" });
    }
    const address = `0.0.0.0:${port}`;
    this.boundPort = await new Promise<number>((resolve, reject) => {
      this.server!.bindAsync(address, this.grpc!.ServerCredentials.createInsecure(), (err, bound) => {
        if (err) reject(err);
        else resolve(bound);
      });
    });
    this.app.logger.info(`gRPC listening on ${this.boundPort}`);
    return this.boundPort;
  }

  async close(): Promise<void> {
    await new Promise<void>((resolve) => {
      if (!this.server) {
        resolve();
        return;
      }
      this.server.tryShutdown(() => resolve());
    });
  }
}

function statusFromHttp(status: number, grpc: GrpcLike): number {
  if (status === 400) return grpc.status.INVALID_ARGUMENT;
  if (status === 401) return grpc.status.UNAUTHENTICATED;
  if (status === 403) return grpc.status.PERMISSION_DENIED;
  if (status === 404) return grpc.status.NOT_FOUND;
  if (status === 429) return grpc.status.RESOURCE_EXHAUSTED;
  if (status < 500) return grpc.status.FAILED_PRECONDITION;
  return grpc.status.INTERNAL;
}

async function resolveProto(service: RpcService): Promise<string> {
  if (service.protoPath) return path.resolve(service.protoPath);
  if (!service.proto) {
    throw new KinaraError(`RPC ${service.service} needs proto or protoPath`, {
      code: "GRPC_PROTO_MISSING",
    });
  }
  const file = path.join(tmpdir(), `kinara-${randomBytes(6).toString("hex")}.proto`);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, service.proto);
  return file;
}

async function loadGrpc(): Promise<{ grpc: GrpcLike; protoLoader: ProtoLoaderLike }> {
  try {
    const grpc = (await import("@grpc/grpc-js")) as unknown as GrpcLike;
    const protoLoader = (await import("@grpc/proto-loader")) as unknown as ProtoLoaderLike;
    return { grpc, protoLoader };
  } catch {
    throw new KinaraError("gRPC requires optional peers `@grpc/grpc-js` and `@grpc/proto-loader`.", {
      code: "MISSING_PEER",
    });
  }
}

/** @deprecated Use KinaraGrpcServer */
export const HarkGrpcServer = KinaraGrpcServer;

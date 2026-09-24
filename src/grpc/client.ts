import { KinaraError } from "../errors.js";

export interface UnaryClient {
  [method: string]: (request: unknown, callback: (err: Error | null, response?: unknown) => void) => void;
}

export interface GrpcClient {
  call<T = unknown>(method: string, request?: Record<string, unknown>): Promise<T>;
  close(): void;
}

/** Promisifies one unary gRPC method. */
export function unaryCall<T = unknown>(client: UnaryClient, method: string, request: unknown = {}): Promise<T> {
  const fn = client[method];
  if (typeof fn !== "function") {
    return Promise.reject(
      new KinaraError(`gRPC method ${method} is not on the client.`, { code: "GRPC_METHOD_MISSING" })
    );
  }
  return new Promise<T>((resolve, reject) => {
    fn.call(client, request, (err, response) => {
      if (err) reject(err);
      else resolve(response as T);
    });
  });
}

export interface GrpcClientOptions {
  address: string;
  package: string;
  service: string;
  protoPath?: string;
  proto?: string;
}

type GrpcModule = {
  loadPackageDefinition(def: unknown): Record<string, unknown>;
  credentials: { createInsecure(): unknown };
  closeClient?(client: { close?: () => void }): void;
};

type ServiceCtor = new (
  address: string,
  creds: unknown
) => UnaryClient & { close?: () => void };

/**
 * Unary gRPC client. Requires optional peers `@grpc/grpc-js` and `@grpc/proto-loader`.
 */
export async function createGrpcClient(options: GrpcClientOptions): Promise<GrpcClient> {
  let grpc: GrpcModule;
  let protoLoader: { loadSync(file: string, opts: Record<string, unknown>): unknown };
  try {
    grpc = (await import("@grpc/grpc-js")) as unknown as GrpcModule;
    protoLoader = (await import("@grpc/proto-loader")) as unknown as {
      loadSync(file: string, opts: Record<string, unknown>): unknown;
    };
  } catch {
    throw new KinaraError("gRPC requires optional peers `@grpc/grpc-js` and `@grpc/proto-loader`.", {
      code: "MISSING_PEER",
    });
  }

  const { resolveProtoFile } = await import("./proto.js");
  const protoFile = await resolveProtoFile(options);
  const definition = protoLoader.loadSync(protoFile, {
    keepCase: true,
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true,
  });
  const loaded = grpc.loadPackageDefinition(definition);
  const Service = lookup(loaded, options.package, options.service);
  const raw = new Service(options.address, grpc.credentials.createInsecure());

  return {
    call(method, request) {
      return unaryCall(raw, method, request ?? {});
    },
    close() {
      raw.close?.();
    },
  };
}

function lookup(loaded: Record<string, unknown>, packageName: string, service: string): ServiceCtor {
  const pkg = packageName.split(".").reduce<unknown>((acc, key) => {
    if (!acc || typeof acc !== "object") return undefined;
    return (acc as Record<string, unknown>)[key];
  }, loaded) as Record<string, unknown> | undefined;
  const ctor = pkg?.[service];
  if (typeof ctor !== "function") {
    throw new KinaraError(`gRPC service ${packageName}.${service} not found in proto`, {
      code: "GRPC_SERVICE_MISSING",
    });
  }
  return ctor as ServiceCtor;
}

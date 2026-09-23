import type { Kinara } from "../app.js";
import type { Actor } from "../auth/permissions.js";

export interface RpcContext {
  app: Kinara;
  actor?: Actor;
}

export type RpcMethod = (
  request: Record<string, unknown>,
  context: RpcContext
) => unknown | Promise<unknown>;

export interface RpcService {
  package: string;
  service: string;
  proto?: string;
  protoPath?: string;
  methods: Record<string, RpcMethod>;
}

export function defineRpc(service: RpcService): RpcService {
  if (!service.package || !service.service) {
    throw new Error("defineRpc requires package and service");
  }
  return service;
}

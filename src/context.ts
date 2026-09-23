import { AsyncLocalStorage } from "node:async_hooks";
import { randomBytes } from "node:crypto";
import type { Actor } from "./auth/permissions.js";

export interface RequestStore {
  requestId: string;
  actor?: Actor;
}

const storage = new AsyncLocalStorage<RequestStore>();

export function createRequestId(): string {
  return randomBytes(12).toString("hex");
}

export function runWithContext<T>(store: RequestStore, fn: () => T): T {
  return storage.run(store, fn);
}

export function getContext(): RequestStore | undefined {
  return storage.getStore();
}

export function getRequestId(): string | undefined {
  return storage.getStore()?.requestId;
}

export function getActor(): Actor | undefined {
  return storage.getStore()?.actor;
}

export function setActor(actor: Actor): void {
  const store = storage.getStore();
  if (store) store.actor = actor;
}

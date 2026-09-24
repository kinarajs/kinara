import type { Hook, HookContext, HookDefinition, HookMeta } from "../types.js";

export class BaseHook<T = unknown> implements Hook<T> {
  meta(): HookMeta {
    throw new Error("meta() is required");
  }

  listenTo(): string[] {
    throw new Error("listenTo() is required");
  }

  handle(_payload: T, _context: HookContext): unknown {
    throw new Error("handle() is required");
  }
}

/** @deprecated Use BaseHook */
export class Action<T = unknown> extends BaseHook<T> {}
/** @deprecated Use BaseHook */
export class HookBase<T = unknown> extends BaseHook<T> {}

export function defineHook<T = unknown>(definition: HookDefinition<T>): Hook<T> {
  const events = Array.isArray(definition.on) ? definition.on : [definition.on];

  return {
    meta: () => ({ id: definition.id, name: definition.name ?? definition.id }),
    listenTo: () => events,
    handle: (payload, context) => definition.handle(payload, context),
  };
}

/** @deprecated Use defineHook */
export const defineAction = defineHook;

/** Logs every listed event. Payload objects are passed through; other values are wrapped. */
export function defineLogHook(id: string, on: string | string[], message = id): Hook {
  return defineHook({
    id,
    on,
    handle(payload, { app }) {
      app.logger.info(message, payload);
    },
  });
}

export function isHook(value: unknown): value is Hook {
  return Boolean(
    value &&
      typeof value === "object" &&
      typeof (value as Hook).listenTo === "function" &&
      typeof (value as Hook).handle === "function"
  );
}

export function wrapClassHook(
  Candidate: new () => Hook | Record<string, unknown>,
  fallbackId: string
): Hook | null {
  const instance = new Candidate() as Hook;
  if (!isHook(instance)) return null;

  const originalMeta = typeof instance.meta === "function" ? instance.meta.bind(instance) : null;
  instance.meta = () => {
    const meta = originalMeta ? originalMeta() : { id: fallbackId };
    return { id: meta.id || fallbackId, name: meta.name ?? meta.id ?? fallbackId };
  };
  return instance;
}

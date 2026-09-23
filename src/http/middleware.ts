import { KinaraError } from "../errors.js";
import type { MiddlewareFactory, MiddlewareFn } from "../types.js";

export class MiddlewareManager {
  private readonly named = new Map<string, () => MiddlewareFn>();
  private global: string[] = [];

  register(name: string, factory: () => MiddlewareFn): this {
    this.named.set(name, factory);
    return this;
  }

  registerFactory(name: string, factory: MiddlewareFactory, app: import("../app.js").Kinara): this {
    this.named.set(name, () => factory(app));
    return this;
  }

  setGlobal(names: string[]): this {
    this.global = [...names];
    return this;
  }

  globalNames(): string[] {
    return [...this.global];
  }

  resolve(name: string): MiddlewareFn {
    const factory = this.named.get(name);
    if (!factory) {
      throw new KinaraError(`Middleware '${name}' is not registered.`, { code: "UNKNOWN_MIDDLEWARE" });
    }
    return factory();
  }

  resolver(): (name: string) => MiddlewareFn {
    return (name) => this.resolve(name);
  }
}

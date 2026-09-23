import { UnboundServiceError } from "./errors.js";

type Resolver<T> = () => T;

export class Container {
  private readonly bindings = new Map<string, Resolver<unknown>>();
  private readonly instances = new Map<string, unknown>();

  bind<T>(key: string, resolver: Resolver<T>): this {
    this.bindings.set(key, resolver);
    this.instances.delete(key);
    return this;
  }

  singleton<T>(key: string, resolver: Resolver<T>): this {
    this.bindings.set(key, () => {
      if (!this.instances.has(key)) {
        this.instances.set(key, resolver());
      }
      return this.instances.get(key);
    });
    return this;
  }

  instance<T>(key: string, value: T): this {
    this.instances.set(key, value);
    return this;
  }

  bound(key: string): boolean {
    return this.bindings.has(key) || this.instances.has(key);
  }

  make<T>(key: string): T {
    if (this.instances.has(key)) {
      return this.instances.get(key) as T;
    }

    const resolver = this.bindings.get(key);
    if (!resolver) {
      throw new UnboundServiceError(key);
    }

    const value = resolver();
    this.instances.set(key, value);
    return value as T;
  }

  forget(key: string): this {
    this.bindings.delete(key);
    this.instances.delete(key);
    return this;
  }
}

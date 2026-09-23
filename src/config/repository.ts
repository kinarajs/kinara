export class ConfigRepository {
  private readonly values = new Map<string, unknown>();

  set(key: string, value: unknown): this {
    this.values.set(key, value);
    return this;
  }

  has(key: string): boolean {
    return this.lookup(key) !== undefined;
  }

  get<T = unknown>(key: string, defaultValue?: T): T {
    const found = this.lookup(key);
    return (found === undefined ? defaultValue : found) as T;
  }

  all(): Record<string, unknown> {
    return Object.fromEntries(this.values);
  }

  merge(namespace: string, data: Record<string, unknown>): this {
    const existing = this.values.get(namespace);
    if (existing && typeof existing === "object" && !Array.isArray(existing)) {
      this.values.set(namespace, { ...(existing as Record<string, unknown>), ...data });
    } else {
      this.values.set(namespace, data);
    }
    return this;
  }

  private lookup(key: string): unknown {
    if (this.values.has(key)) {
      return this.values.get(key);
    }

    const [head, ...rest] = key.split(".");
    if (!head || rest.length === 0) return undefined;

    let current: unknown = this.values.get(head);
    for (const part of rest) {
      if (!current || typeof current !== "object" || Array.isArray(current)) {
        return undefined;
      }
      current = (current as Record<string, unknown>)[part];
    }
    return current;
  }
}

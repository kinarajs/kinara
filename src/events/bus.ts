import { UnknownDriverError } from "../errors.js";
import { createLogger, type Logger } from "../logger.js";
import { sanitizePayload } from "../security/payload.js";
import { assertEventName, assertEventPattern } from "../security/event-name.js";
import type { EventDriver, EventDriverFactory, EventListener } from "../types.js";
import { MemoryEventDriver } from "./drivers/memory.js";

export class EventBus {
  private driver: EventDriver;
  private readonly factories = new Map<string, EventDriverFactory>();
  private readonly logger: Logger;

  constructor(logger?: Logger) {
    this.logger = logger ?? createLogger({ quiet: true });
    this.factories.set("memory", () => new MemoryEventDriver());
    this.factories.set("emitter", () => new MemoryEventDriver());
    this.driver = new MemoryEventDriver();
  }

  registerDriver(name: string, factory: EventDriverFactory): this {
    this.factories.set(name, factory);
    return this;
  }

  async use(name: string, options?: Record<string, unknown>): Promise<this> {
    const factory = this.factories.get(name);
    if (!factory) {
      throw new UnknownDriverError(name);
    }

    if (this.driver.close) {
      await this.driver.close();
    }

    this.driver = factory(options);
    if (this.driver.connect) {
      await this.driver.connect();
    }
    this.logger.debug(`event driver ${name}`);
    return this;
  }

  driverName(): string {
    return this.driver.name;
  }

  async on(event: string, listener: EventListener): Promise<this> {
    assertEventPattern(event);
    await this.driver.on(event, listener);
    return this;
  }

  async off(event: string, listener: EventListener): Promise<this> {
    assertEventPattern(event);
    await this.driver.off(event, listener);
    return this;
  }

  async emit<T>(event: string, payload?: T): Promise<this> {
    assertEventName(event);
    const safe = sanitizePayload(payload);
    await this.driver.emit(event, safe);
    return this;
  }

  async dispatch<T>(event: string, payload?: T): Promise<this> {
    return this.emit(event, payload);
  }

  async close(): Promise<void> {
    if (this.driver.close) {
      await this.driver.close();
    }
  }
}

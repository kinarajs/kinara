import type { Hook, HookContext } from "../types.js";
import type { EventBus } from "../events/bus.js";
import type { Logger } from "../logger.js";

export class HookRegistry {
  private readonly hooks = new Map<string, Hook>();

  constructor(
    private readonly events: EventBus,
    private readonly logger: Logger
  ) {}

  async register(hook: Hook, contextFactory: () => Omit<HookContext, "event">): Promise<void> {
    const meta = hook.meta();
    const events = hook.listenTo();

    if (!meta?.id) {
      this.logger.warn("skipped hook without id");
      return;
    }
    if (!Array.isArray(events) || events.length === 0) {
      this.logger.warn(`hook ${meta.id} listenTo() must return event names`);
      return;
    }

    this.hooks.set(meta.id, hook);

    for (const event of events) {
      await this.events.on(event, async (payload, name) => {
        await hook.handle(payload, { ...contextFactory(), event: name });
      });
      this.logger.debug(`hook ${meta.id} -> ${event}`);
    }
  }

  get(id: string): Hook | undefined {
    return this.hooks.get(id);
  }

  all(): Hook[] {
    return [...this.hooks.values()];
  }

  ids(): string[] {
    return [...this.hooks.keys()];
  }
}

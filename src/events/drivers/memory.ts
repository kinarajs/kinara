import { sanitizePayload } from "../../security/payload.js";
import { matchesEvent } from "../../security/event-name.js";
import type { EventDriver, EventListener } from "../../types.js";

export class MemoryEventDriver implements EventDriver {
  readonly name = "memory";
  private readonly listeners = new Map<string, Set<EventListener>>();

  on(event: string, listener: EventListener): void {
    const set = this.listeners.get(event) ?? new Set();
    set.add(listener);
    this.listeners.set(event, set);
  }

  off(event: string, listener: EventListener): void {
    this.listeners.get(event)?.delete(listener);
  }

  async emit(event: string, payload: unknown): Promise<void> {
    const safe = sanitizePayload(payload);
    const tasks: Promise<unknown>[] = [];

    for (const [pattern, listeners] of this.listeners) {
      if (!matchesEvent(pattern, event)) continue;
      for (const listener of listeners) {
        tasks.push(
          Promise.resolve()
            .then(() => listener(safe, event))
            .catch((error: unknown) => {
              const message = error instanceof Error ? error.message : String(error);
              console.error(`[kinara:error] hook failed on ${event}: ${message}`);
            })
        );
      }
    }

    await Promise.all(tasks);
  }

  listenerCount(event?: string): number {
    if (event) return this.listeners.get(event)?.size ?? 0;
    let total = 0;
    for (const set of this.listeners.values()) total += set.size;
    return total;
  }

  async close(): Promise<void> {
    this.listeners.clear();
  }
}

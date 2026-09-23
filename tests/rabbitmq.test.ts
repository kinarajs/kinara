import { describe, expect, it, vi } from "vitest";
import { RabbitMqEventDriver } from "../src/events/drivers/rabbitmq.js";
import { KinaraError } from "../src/errors.js";

describe("rabbitmq driver", () => {
  it("prefixes and sanitizes exchange names", async () => {
    const published: Array<{ exchange: string; body: string }> = [];
    const channel = {
      assertExchange: vi.fn(async () => ({})),
      assertQueue: vi.fn(async () => ({ queue: "q" })),
      bindQueue: vi.fn(async () => ({})),
      consume: vi.fn(async (_q: string, onMessage: (msg: { content: Buffer }) => void) => {
        onMessage({ content: Buffer.from(JSON.stringify({ id: 3 })) });
        return { consumerTag: "c" };
      }),
      publish: vi.fn((exchange: string, _rk: string, content: Buffer) => {
        published.push({ exchange, body: content.toString() });
        return true;
      }),
      close: vi.fn(async () => undefined),
    };

    const driver = new RabbitMqEventDriver({ url: "amqp://test", prefix: "kinara" });
    (driver as unknown as { connect: () => Promise<void> }).connect = async () => {
      (driver as unknown as { channel: typeof channel }).channel = channel;
    };

    const seen: unknown[] = [];
    await driver.on("user.created", (payload) => {
      seen.push(payload);
    });
    await driver.emit("user.created", { id: 3 });

    expect(channel.assertExchange).toHaveBeenCalledWith("kinara.user.created", "fanout", {
      durable: true,
    });
    expect(seen).toEqual([{ id: 3 }]);
    expect(published[0]?.body).toBe(JSON.stringify({ id: 3 }));
  });

  it("documents the missing-peer error", () => {
    const error = new KinaraError(
      "RabbitMQ driver requires the optional peer dependency `amqplib`.",
      "MISSING_PEER"
    );
    expect(error.code).toBe("MISSING_PEER");
  });
});

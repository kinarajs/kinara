import { KinaraError } from "../../errors.js";
import { decodeEventBody, sanitizePayload } from "../../security/payload.js";
import { assertEventName } from "../../security/event-name.js";
import type { EventDriver, EventListener } from "../../types.js";

type AmqpConnection = {
  createChannel(): Promise<AmqpChannel>;
  close(): Promise<void>;
};

type AmqpChannel = {
  assertExchange(name: string, type: string, options: Record<string, unknown>): Promise<unknown>;
  assertQueue(name: string, options: Record<string, unknown>): Promise<{ queue: string }>;
  bindQueue(queue: string, exchange: string, routingKey: string): Promise<unknown>;
  consume(
    queue: string,
    onMessage: (msg: { content: Buffer } | null) => void,
    options: Record<string, unknown>
  ): Promise<{ consumerTag: string }>;
  publish(exchange: string, routingKey: string, content: Buffer): boolean;
  close(): Promise<void>;
};

export interface RabbitMqOptions {
  url?: string;
  prefix?: string;
  durable?: boolean;
  exchangeType?: "fanout" | "topic" | "direct";
}

/**
 * Optional RabbitMQ bus. `amqplib` is a peer dependency — loaded only when used.
 */
export class RabbitMqEventDriver implements EventDriver {
  readonly name = "rabbitmq";
  private readonly options: Required<Pick<RabbitMqOptions, "durable" | "exchangeType">> &
    RabbitMqOptions;
  private connection: AmqpConnection | null = null;
  private channel: AmqpChannel | null = null;

  constructor(options: RabbitMqOptions = {}) {
    this.options = {
      url: options.url ?? process.env.RABBITMQ_URL ?? "amqp://127.0.0.1",
      prefix: options.prefix ?? "kinara",
      durable: options.durable ?? true,
      exchangeType: options.exchangeType ?? "fanout",
    };
  }

  async connect(): Promise<void> {
    if (this.channel) return;

    let amqplib: { connect: (url: string) => Promise<AmqpConnection> };
    try {
      amqplib = (await import("amqplib")) as unknown as {
        connect: (url: string) => Promise<AmqpConnection>;
      };
    } catch {
      throw new KinaraError("RabbitMQ driver requires the optional peer dependency `amqplib`.", {
        code: "MISSING_PEER",
      });
    }

    this.connection = await amqplib.connect(this.options.url as string);
    this.channel = await this.connection.createChannel();
  }

  async close(): Promise<void> {
    await this.channel?.close();
    await this.connection?.close();
    this.channel = null;
    this.connection = null;
  }

  private exchangeName(event: string): string {
    const safe = assertEventName(event);
    return `${this.options.prefix}.${safe}`;
  }

  async on(event: string, listener: EventListener): Promise<void> {
    await this.connect();
    const channel = this.channel as AmqpChannel;
    const exchange = this.exchangeName(event);
    await channel.assertExchange(exchange, this.options.exchangeType, {
      durable: this.options.durable,
    });
    const queue = await channel.assertQueue("", { exclusive: true, autoDelete: true });
    await channel.bindQueue(queue.queue, exchange, "");
    await channel.consume(
      queue.queue,
      (msg) => {
        if (!msg) return;
        try {
          const payload = decodeEventBody(msg.content);
          void listener(payload, event);
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          console.error(`[kinara:error] rabbitmq decode failed on ${event}: ${message}`);
        }
      },
      { noAck: true }
    );
  }

  async emit(event: string, payload: unknown): Promise<void> {
    await this.connect();
    const channel = this.channel as AmqpChannel;
    const exchange = this.exchangeName(event);
    await channel.assertExchange(exchange, this.options.exchangeType, {
      durable: this.options.durable,
    });
    const body = Buffer.from(JSON.stringify(sanitizePayload(payload) ?? null));
    channel.publish(exchange, "", body);
  }

  async off(): Promise<void> {
    // Exclusive queues die with the channel; close() is the supported unsubscribe.
  }
}

export function createRabbitMqDriver(options?: Record<string, unknown>): RabbitMqEventDriver {
  return new RabbitMqEventDriver(options as RabbitMqOptions);
}

import type { Server } from "node:http";
import { KinaraError } from "../errors.js";
import { getRequestId } from "../context.js";
import { getTracer } from "../telemetry/otel.js";
import type { Logger } from "../logger.js";

export interface WsClient {
  id: string;
  rooms: Set<string>;
  send(event: string, payload?: unknown): void;
  join(room: string): void;
  leave(room: string): void;
}

type ConnectionHandler = (client: WsClient) => void | Promise<void>;

export class KinaraWebsocket {
  private clients = new Map<string, WsClient>();
  private rooms = new Map<string, Set<string>>();
  private handlers: ConnectionHandler[] = [];
  private socketServer?: { close(cb?: () => void): void };

  constructor(private readonly logger?: Logger) {}

  onConnection(handler: ConnectionHandler): this {
    this.handlers.push(handler);
    return this;
  }

  async attach(server: Server): Promise<void> {
    let WebSocketServer: new (options: { server: Server }) => {
      on(event: string, listener: (socket: WsRaw) => void): void;
      close(cb?: () => void): void;
    };
    try {
      ({ WebSocketServer } = (await import("ws")) as unknown as { WebSocketServer: typeof WebSocketServer });
    } catch {
      throw new KinaraError("WebSockets require the optional peer `ws`.", { code: "MISSING_PEER" });
    }

    const wss = new WebSocketServer({ server });
    this.socketServer = wss;
    wss.on("connection", (socket) => {
      const client = this.register(socket);
      for (const handler of this.handlers) {
        void handler(client);
      }
    });
  }

  to(room: string) {
    return {
      emit: (event: string, payload?: unknown) => this.emit(event, payload, room),
    };
  }

  emit(event: string, payload?: unknown, room?: string): number {
    const span = getTracer("kinara.ws").startSpan("ws.emit");
    span.setAttribute?.("ws.event", event);
    if (room) span.setAttribute?.("ws.room", room);
    try {
      const ids = room ? this.rooms.get(room) : new Set(this.clients.keys());
      let sent = 0;
      for (const id of ids ?? []) {
        this.clients.get(id)?.send(event, payload);
        sent += 1;
      }
      span.setAttribute?.("ws.sent", sent);
      return sent;
    } finally {
      span.end();
    }
  }

  broadcast(event: string, payload?: unknown): number {
    return this.emit(event, payload);
  }

  size(): number {
    return this.clients.size;
  }

  async close(): Promise<void> {
    await new Promise<void>((resolve) => {
      if (!this.socketServer) {
        resolve();
        return;
      }
      this.socketServer.close(() => resolve());
    });
    this.clients.clear();
    this.rooms.clear();
  }

  /** Test helper — register an in-memory client without `ws`. */
  addClient(client: WsClient): void {
    this.clients.set(client.id, client);
    for (const room of client.rooms) {
      const members = this.rooms.get(room) ?? new Set<string>();
      members.add(client.id);
      this.rooms.set(room, members);
    }
  }

  private register(socket: WsRaw): WsClient {
    const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    const rooms = new Set<string>();
    const client: WsClient = {
      id,
      rooms,
      send: (event, payload) => {
        socket.send(JSON.stringify({ event, payload, meta: { requestId: getRequestId() } }));
      },
      join: (room) => {
        rooms.add(room);
        const members = this.rooms.get(room) ?? new Set<string>();
        members.add(id);
        this.rooms.set(room, members);
      },
      leave: (room) => {
        rooms.delete(room);
        this.rooms.get(room)?.delete(id);
      },
    };
    this.clients.set(id, client);
    socket.on("close", () => {
      for (const room of rooms) this.rooms.get(room)?.delete(id);
      this.clients.delete(id);
    });
    this.logger?.debug(`ws connected ${id}`);
    return client;
  }
}

type WsRaw = {
  send(data: string): void;
  on(event: string, listener: () => void): void;
};

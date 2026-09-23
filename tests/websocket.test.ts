import { describe, expect, it } from "vitest";
import { KinaraWebsocket, type WsClient } from "../src/ws/server.js";

function fakeClient(id: string, rooms: string[] = []): { client: WsClient; events: Array<{ event: string; payload: unknown }> } {
  const events: Array<{ event: string; payload: unknown }> = [];
  const client: WsClient = {
    id,
    rooms: new Set(rooms),
    send: (event, payload) => events.push({ event, payload }),
    join: (room) => client.rooms.add(room),
    leave: (room) => client.rooms.delete(room),
  };
  return { client, events };
}

describe("websockets", () => {
  it("broadcasts and rooms without buffering payloads per replica", () => {
    const ws = new KinaraWebsocket();
    const a = fakeClient("a", ["ops"]);
    const b = fakeClient("b", ["ops"]);
    const c = fakeClient("c");
    ws.addClient(a.client);
    ws.addClient(b.client);
    ws.addClient(c.client);

    expect(ws.broadcast("ping", { n: 1 })).toBe(3);
    expect(ws.to("ops").emit("deployed", { ok: true })).toBe(2);
    expect(a.events.map((row) => row.event)).toEqual(["ping", "deployed"]);
    expect(c.events.map((row) => row.event)).toEqual(["ping"]);
    expect(ws.size()).toBe(3);
    c.client.join("ops");
    ws.addClient(c.client);
    expect(ws.to("ops").emit("again")).toBe(3);
    c.client.leave("ops");
  });

  it("requires the ws peer to attach a real server", async () => {
    const ws = new KinaraWebsocket();
    await expect(ws.attach({} as never)).rejects.toMatchObject({ code: "MISSING_PEER" });
  });
});

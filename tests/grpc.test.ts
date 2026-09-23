import { describe, expect, it } from "vitest";
import { defineRpc } from "../src/grpc/define.js";
import { KinaraGrpcServer } from "../src/grpc/server.js";
import { createLogger } from "../src/logger.js";

describe("gRPC", () => {
  it("defineRpc requires package and service", () => {
    expect(() => defineRpc({ package: "", service: "", methods: {} })).toThrow(/package and service/);
    const service = defineRpc({
      package: "demo.v1",
      service: "Demo",
      proto: "syntax = \"proto3\";",
      methods: { Ping: async () => ({ ok: true }) },
    });
    expect(service.service).toBe("Demo");
  });

  it("needs proto or protoPath before listen", async () => {
    const app = { logger: createLogger({ quiet: true }) } as never;
    const server = new KinaraGrpcServer(app);
    await expect(server.listen(0)).rejects.toMatchObject({ code: "GRPC_EMPTY" });
  });
});

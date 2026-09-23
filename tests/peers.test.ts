import { describe, expect, it } from "vitest";
import { connectMongo } from "../src/db/mongo.js";
import { createRedisCache } from "../src/cache/manager.js";
import { createS3LogSink } from "../src/log/s3.js";
import { storeImage } from "../src/media/image.js";
import { MemoryStorageDriver } from "../src/storage/local.js";

describe("optional peers", () => {
  it("mongo connect fails closed without the driver or a live server", async () => {
    await expect(connectMongo("mongodb://127.0.0.1:1/kinara")).rejects.toMatchObject({
      code: expect.stringMatching(/MISSING_PEER|MONGO_CONNECT_FAILED/),
    });
  });

  it("redis cache requires ioredis", async () => {
    await expect(createRedisCache("redis://127.0.0.1:6379")).rejects.toMatchObject({
      code: expect.stringMatching(/MISSING_PEER/),
    });
  });

  it("s3 log sink fails without the AWS SDK", async () => {
    const sink = createS3LogSink({ bucket: "logs", flushEvery: 1 });
    await expect(
      sink.write({
        level: "info",
        message: "hi",
        time: new Date().toISOString(),
      })
    ).rejects.toMatchObject({ code: "LOG_SINK_FAILED" });
  });

  it("storeImage requires sharp", async () => {
    await expect(
      storeImage(new MemoryStorageDriver(), "a.webp", Buffer.from("x"), { format: "webp" })
    ).rejects.toMatchObject({ code: "MISSING_PEER" });
  });
});

import { describe, expect, it } from "vitest";
import { optimizeImage } from "../src/media/image.js";

describe("image optimization", () => {
  it("requires sharp as an optional peer", async () => {
    await expect(optimizeImage(Buffer.from("not-an-image"))).rejects.toMatchObject({
      code: "MISSING_PEER",
    });
  });
});

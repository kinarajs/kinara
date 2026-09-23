import { describe, expect, it } from "vitest";
import {
  chunk,
  clamp,
  compact,
  ensureArray,
  groupBy,
  hash,
  isEmail,
  maskEmail,
  paginate,
  parseJson,
  pick,
  slug,
  timingSafeEqual,
  toBool,
  toInt,
  unique,
} from "../src/utils/index.js";

describe("utils", () => {
  it("covers the common helpers", () => {
    expect(slug("Hello Kinara!")).toBe("hello-kinara");
    expect(maskEmail("ada@yalu.dev")).toBe("a***@yalu.dev");
    expect(isEmail("ada@yalu.dev")).toBe(true);
    expect(isEmail("nope")).toBe(false);
    expect(toInt("42", 0)).toBe(42);
    expect(toBool("true")).toBe(true);
    expect(pick({ a: 1, b: 2 }, ["a"])).toEqual({ a: 1 });
    expect(compact({ a: 1, b: null })).toEqual({ a: 1 });
    expect(unique([1, 1, 2])).toEqual([1, 2]);
    expect(ensureArray("a")).toEqual(["a"]);
    expect(groupBy([{ t: "a" }, { t: "a" }], (row) => row.t).a).toHaveLength(2);
    expect(paginate([1, 2, 3], 2, 2).items).toEqual([3]);
    expect(chunk([1, 2, 3, 4], 2)).toEqual([
      [1, 2],
      [3, 4],
    ]);
    expect(clamp(12, 0, 10)).toBe(10);
    expect(parseJson('{"a":1}')).toEqual({ a: 1 });
    expect(hash("x")).toHaveLength(64);
    expect(timingSafeEqual("secret", "secret")).toBe(true);
    expect(timingSafeEqual("secret", "other")).toBe(false);
  });

  it("covers id, omit, retry, timeout, and parse fallbacks", async () => {
    const { id, omit, retry, timeout, parseJson, maskPhone, toBool, sleep, iso, now } = await import(
      "../src/utils/index.js"
    );
    expect(id(4)).toHaveLength(8);
    expect(omit({ a: 1, b: 2 }, ["b"])).toEqual({ a: 1 });
    expect(maskPhone("+94 77 123 4567")).toBe("***4567");
    expect(toBool("no")).toBe(false);
    expect(parseJson("not-json", { ok: false })).toEqual({ ok: false });
    expect(iso(now())).toMatch(/T/);
    await expect(timeout(sleep(20), 1)).rejects.toThrow(/Timed out/);
    let attempts = 0;
    await expect(
      retry(
        async () => {
          attempts += 1;
          if (attempts < 2) throw new Error("again");
          return 1;
        },
        { times: 3, delayMs: 1 }
      )
    ).resolves.toBe(1);
  });
});


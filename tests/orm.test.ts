import { afterEach, describe, expect, it } from "vitest";
import { defineModel, resetCollections, writeCsv } from "../src/orm/index.js";
import { setEncryptionKey } from "../src/crypto/fields.js";

afterEach(() => {
  resetCollections();
  setEncryptionKey(undefined);
});

interface User {
  _id: string;
  email: string;
  secret?: string;
  age?: number;
}

const User = defineModel<User>({ collection: "users", encrypt: ["secret"] });

describe("mongo ORM", () => {
  it("inserts, finds, paginates, and streams without loading everything", async () => {
    setEncryptionKey("test-secret-key-for-orm");
    for (let i = 1; i <= 5; i += 1) {
      await User.create({ _id: `u${i}`, email: `u${i}@example.com`, secret: `s${i}`, age: i });
    }

    const found = await User.find("u2");
    expect(found?.email).toBe("u2@example.com");
    expect(found?.secret).toBe("s2");

    const page = await User.paginate(2, 2);
    expect(page.total).toBe(5);
    expect(page.pages).toBe(3);
    expect(page.items).toHaveLength(2);

    const streamed: string[] = [];
    for await (const user of User.cursor()) {
      streamed.push(user._id);
    }
    expect(streamed).toEqual(["u1", "u2", "u3", "u4", "u5"]);

    const adults = await User.where({ age: { $gte: 4 } }).count();
    expect(adults).toBe(2);
  });

  it("exports CSV incrementally", async () => {
    await User.create({ _id: "a", email: "a@example.com" });
    await User.create({ _id: "b", email: "b@example.com" });
    let csv = "";
    const rows = await User.toCsv((chunk) => {
      csv += chunk;
    }, ["_id", "email"]);
    expect(rows).toBe(2);
    expect(csv).toBe("_id,email\na,a@example.com\nb,b@example.com\n");
  });

  it("cursor-paginates large sets", async () => {
    for (let i = 1; i <= 4; i += 1) {
      await User.create({ _id: `c${i}`, email: `${i}@x.com` });
    }
    const first = await User.query().cursorPaginate(2);
    expect(first.items).toHaveLength(2);
    expect(first.next).toBeTruthy();
    const second = await User.query().cursorPaginate(2, first.next);
    expect(second.items.length).toBeGreaterThan(0);
  });

  it("supports findBy, insertMany, select, and orderBy", async () => {
    await User.query().insertMany([
      { _id: "m1", email: "m1@example.com", age: 3 },
      { _id: "m2", email: "m2@example.com", age: 9 },
    ]);
    expect((await User.findBy({ email: "m2@example.com" }))?.age).toBe(9);
    const ordered = await User.query().orderBy({ age: -1 }).select(["_id", "age"]).paginate(1, 10);
    expect(ordered.items[0]?._id).toBe("m2");
    expect(ordered.items[0]).not.toHaveProperty("email");
  });

  it("updates and destroys", async () => {
    await User.create({ _id: "z", email: "z@example.com", age: 1 });
    await User.where({ _id: "z" }).update({ age: 9 });
    expect((await User.find("z"))?.age).toBe(9);
    await User.where({ _id: "z" }).destroy();
    expect(await User.find("z")).toBeNull();
  });

  it("writeCsv helper streams rows", async () => {
    const chunks: string[] = [];
    const count = await writeCsv(
      (async function* () {
        yield { a: 1, b: "x" };
        yield { a: 2, b: "y,z" };
      })(),
      (chunk) => {
        chunks.push(chunk);
      }
    );
    expect(count).toBe(2);
    expect(chunks.join("")).toContain('"y,z"');
  });
});

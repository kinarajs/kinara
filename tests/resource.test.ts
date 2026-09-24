import { describe, expect, it } from "vitest";
import { defineResource, isLoaded, when, whenLoaded } from "../src/http/resource.js";

describe("resources", () => {
  const UserResource = defineResource((user: { _id: string; email: string; password?: string; posts?: unknown }) => ({
    id: user._id,
    email: user.email,
    posts: whenLoaded(user, "posts", (rows) => rows),
  }));

  it("returns only the fields the resource names", () => {
    expect(UserResource.make({ _id: "1", email: "a@b.c", password: "secret" })).toEqual({
      id: "1",
      email: "a@b.c",
    });
  });

  it("omits a relation that is still an id", () => {
    const user = { _id: "1", email: "a@b.c", posts: "507f1f77bcf86cd799439011" };
    expect(isLoaded(user, "posts")).toBe(false);
    expect(UserResource.make(user)).toEqual({ id: "1", email: "a@b.c" });
  });

  it("includes a relation that was already loaded", () => {
    const user = {
      _id: "1",
      email: "a@b.c",
      posts: [{ title: "Hello" }],
      populated(path: string) {
        return path === "posts" ? "posts" : undefined;
      },
    };
    expect(UserResource.make(user)?.posts).toEqual([{ title: "Hello" }]);
  });

  it("builds a collection without dropping null records into queries", () => {
    const rows = UserResource.collection([
      { _id: "1", email: "a@b.c" },
      { _id: "2", email: "c@d.e" },
    ]);
    expect(rows).toEqual([
      { id: "1", email: "a@b.c" },
      { id: "2", email: "c@d.e" },
    ]);
  });

  it("when() drops a false condition", () => {
    const gated = defineResource((row: { name: string }, staff?: { admin: boolean }) => ({
      name: row.name,
      secret: when(staff?.admin, "visible"),
    }));
    expect(gated.make({ name: "Ada" }, { admin: false })).toEqual({ name: "Ada" });
    expect(gated.make({ name: "Ada" }, { admin: true })).toEqual({ name: "Ada", secret: "visible" });
  });
});

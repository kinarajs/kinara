# Mongo ORM

Kinara’s ORM is a thin cursor over the official MongoDB driver. It does not hydrate fat models or buffer whole collections.

```ts
import { defineModel } from "@kinarajs/kinara";

export interface User {
  _id: string;
  email: string;
  ssn?: string;
}

export const User = defineModel<User>({
  collection: "users",
  encrypt: ["ssn"],
});

await User.create({ email: "ada@example.com", ssn: "000-00-0000" });
const page = await User.paginate(1, 50);
for await (const user of User.cursor()) {
  // one document at a time
}
await User.toCsv((chunk) => res.write(chunk), ["_id", "email"]);
```

## Large data

- `cursor()` / `toCsv()` stream. Do not call `toArray()` on million-row sets.
- `paginate(page, pageSize)` is for admin tables (capped at 200 per page).
- `cursorPaginate(pageSize, after)` walks `_id` and skips expensive `skip()`.
- Field encryption is AES-256-GCM. Set `KINARA_KEY` or run `kinara key:generate`.

Without `MONGO_URL` the same API uses an in-memory collection (tests and local spikes).

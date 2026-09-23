# MongoDB

```bash
npm install mongodb
```

```ts
// src/config/mongo.ts
export default { url: process.env.MONGO_URL };
```

```ts
const users = app.mongo?.db().collection("users");
await users.insertOne({ id, email, createdAt: new Date() });
```

Kinara connects on boot and closes on `app.close()`. Missing `mongodb` package → `MISSING_PEER`. Bad URL → `MONGO_CONNECT_FAILED` without leaking credentials in production logs.

Use indexes and connection pooling from the official driver. Kinara does not wrap queries — it only owns the client lifecycle.

# Caching

Default driver is in-memory (fast for a single process, gone on restart).

```ts
await app.cache.set("session:1", session, 15 * 60_000);
const session = await app.cache.get("session:1");
const plan = await app.cache.wrap("plan:pro", 60_000, () => db.plans.findOne({ id: "pro" }));
```

Redis:

```bash
npm install ioredis
```

```ts
// src/config/cache.ts
export default { driver: "redis", redis: { url: process.env.REDIS_URL } };
```

Or `REDIS_URL` in the environment. Rate limiting uses the same cache when enabled, so Redis is the right choice behind more than one replica.

Memcached:

```bash
npm install memcached
```

```ts
// src/config/cache.ts
export default { driver: "memcached", memcached: { servers: process.env.MEMCACHED_SERVERS } };
```

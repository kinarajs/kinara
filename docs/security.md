# Security

Kinara is conservative by default.

- Event names are allow-listed. `../` and spaces never become RabbitMQ exchanges.
- Event payloads are cloned without `__proto__` / `constructor`.
- Storage paths cannot escape the disk root.
- `x-powered-by` is removed. `nosniff`, `DENY` framing, `no-referrer`, and a tight Permissions-Policy are always on. HSTS is production-only.
- JSON body limit shrinks in production (256kb).
- Rate limiting is on in production (override with `rateLimit.enabled`).
- `trust proxy` is on in production so `req.ip` is the client, not the load balancer.
- Production 5xx responses hide internal messages.
- `timingSafeEqual` is exported for secret comparison.

You still need to:

- Authenticate at the gateway (API keys, JWT) and pass an actor into Kinara.
- Use TLS in front of HTTP and mTLS or a service mesh for gRPC inside the cluster.
- Store secrets in the environment or a vault, never in `config/` committed to git.
- Enable Redis-backed rate limits when you run more than one replica.

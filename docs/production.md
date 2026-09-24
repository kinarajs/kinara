# Production

## Run

```bash
npm run build
NODE_ENV=production PORT=3000 GRPC_PORT=50051 node dist/index.js
```

Or `kinara start` after compile. Do not use `kinara dev` / `tsx watch` in production.

## Checklist

- [ ] `NODE_ENV=production` or `KINARA_ENV=production`
- [ ] `PORT` and `GRPC_PORT` set by the orchestrator
- [ ] Event driver `rabbitmq` (or your bus) with a durable prefix
- [ ] `cache.driver=redis` if you have more than one pod
- [ ] `rateLimit.enabled=true` (default in production)
- [ ] Mongo URL from secrets, not source
- [ ] OTEL adapter registered before `createApp`
- [ ] Optional S3 log bucket + IAM write-only role
- [ ] Health route on HTTP (`/health` / `/healthz` are built in) for probes
- [ ] Gateway is the only public listener; gRPC stays cluster-internal
- [ ] Resource limits: Node 20+, enough file descriptors for gRPC + Mongo

## Performance

Production mode uses a smaller JSON body limit, JSON logs (no pretty-print), and no debug hooks unless `KINARA_DEBUG=1`. Keep hooks cheap; offload slow work (`email.send`) to the event bus so the HTTP request returns.

`app.cache.wrap` is the right place for hot reads (plans, feature flags, public config).

## Shutdown

`await app.close()` stops HTTP, gRPC, the bus, cache, Mongo, and log sinks. Wire it to `SIGTERM` in Kubernetes.

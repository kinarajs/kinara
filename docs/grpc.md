# gRPC

Kinara loads gRPC when a module exports `rpc.ts` (or `grpc.ts`). The packages are optional peers so HTTP-only services stay small.

```bash
npm install @grpc/grpc-js @grpc/proto-loader
```

```ts
import { defineRpc, UnauthorizedError } from "@kinarajs/kinara";

export default defineRpc({
  package: "billing.v1",
  service: "BillingService",
  protoPath: new URL("./billing.proto", import.meta.url).pathname,
  methods: {
    GetInvoice: async (req, { app }) => {
      if (!req.id) throw new UnauthorizedError();
      return app.cache.wrap(`invoice:${req.id}`, 15_000, () => loadInvoice(req.id));
    },
  },
});
```

You can inline `proto` instead of `protoPath`. HTTP status from `KinaraError` maps to gRPC status (`404` → `NOT_FOUND`, `401` → `UNAUTHENTICATED`, `429` → `RESOURCE_EXHAUSTED`).

Listen with `app.listen()` (HTTP + gRPC) or set `GRPC_PORT`. Disable with `app.grpc: false` in config.

Use gRPC for cluster-internal calls. Keep HTTP as the public surface behind your gateway.

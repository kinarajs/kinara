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

Clients use the same proto loader:

```ts
import { createGrpcClient } from "@kinarajs/kinara";

const sms = await createGrpcClient({
  address: process.env.YALU_ENGINE_GRPC_URL ?? "127.0.0.1:50051",
  protoPath: new URL("../proto/sms.proto", import.meta.url).pathname,
  package: "yalu.sms.v1",
  service: "SmsService",
});
const response = await sms.call("SendSms", { to, message });
```

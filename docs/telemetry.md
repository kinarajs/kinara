# Telemetry and logs

## OpenTelemetry

Kinara does not bundle an SDK. Plug any adapter that looks like the OTEL API:

```ts
import { createApp, useOpenTelemetry, withSpan } from "@kinarajs/kinara";
import { trace } from "@opentelemetry/api";

useOpenTelemetry({ trace });

const app = await createApp({
  root: import.meta.dirname,
  telemetry: {
    getTracer: (name) => trace.getTracer(name ?? "billing"),
  },
});

await withSpan("invoice.charge", async (span) => {
  span.setAttribute?.("invoice.id", id);
  return charge(id);
});
```

Datadog, Honeycomb, Grafana, or a custom exporter all work as long as they expose `getTracer().startSpan()`.

## S3 logs

```ts
// src/config/log.ts
export default {
  s3: {
    bucket: process.env.LOG_BUCKET,
    prefix: "kinara",
    region: process.env.AWS_REGION,
  },
};
```

Batches of JSON lines flush to `s3://bucket/kinara/<hour>/<ts>.json`. Requires `@aws-sdk/client-s3` and standard AWS credentials. Console JSON logs still run in production so stdout scrapers keep working.

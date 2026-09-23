import { createApp, useTelemetry } from "@kinarajs/kinara";

useTelemetry({
  getTracer: () => ({
    startSpan: (name) => ({
      end: () => undefined,
      setAttribute: () => undefined,
      recordException: () => undefined,
    }),
  }),
});

const app = await createApp({ root: import.meta.dirname });
await app.listen(Number(process.env.PORT) || 3002);

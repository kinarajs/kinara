import { createApp } from "@kinarajs/kinara";

const app = await createApp({ root: import.meta.dirname });
await app.listen(Number(process.env.PORT) || 3000);

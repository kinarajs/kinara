import "dotenv/config";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createApp } from "@kinarajs/kinara";

const root = path.dirname(fileURLToPath(import.meta.url));

const app = await createApp({ root });
const port = Number(process.env.PORT) || 3000;
await app.listen(port);

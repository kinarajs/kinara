# Images

```bash
npm install sharp
```

```ts
import { optimizeImage, storeImage } from "@kinarajs/kinara";

const webp = await optimizeImage(req.file.buffer, {
  width: 1200,
  format: "webp",
  quality: 80,
});

await storeImage(app.storage.disk("local"), `avatars/${id}.webp`, req.file.buffer, {
  width: 256,
  format: "webp",
});
```

Sharp is an optional peer. Work is wrapped in an OTEL span (`media.optimize`) with format and byte attributes. Prefer WebP/AVIF over shipping original uploads.

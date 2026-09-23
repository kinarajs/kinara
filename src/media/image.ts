import { KinaraError } from "../errors.js";
import { withSpan } from "../telemetry/otel.js";
import type { StorageDriver } from "../storage/local.js";

export interface OptimizeOptions {
  width?: number;
  height?: number;
  format?: "webp" | "jpeg" | "png" | "avif";
  quality?: number;
  fit?: "cover" | "inside" | "contain";
}

export interface OptimizedImage {
  buffer: Buffer;
  contentType: string;
  bytes: number;
}

const TYPES: Record<NonNullable<OptimizeOptions["format"]>, string> = {
  webp: "image/webp",
  jpeg: "image/jpeg",
  png: "image/png",
  avif: "image/avif",
};

export async function optimizeImage(
  input: Buffer,
  options: OptimizeOptions = {}
): Promise<OptimizedImage> {
  return withSpan("media.optimize", async (span) => {
    const format = options.format ?? "webp";
    span.setAttribute?.("media.format", format);
    if (options.width) span.setAttribute?.("media.width", options.width);
    let sharp: (input: Buffer) => SharpLike;
    try {
      sharp = (await import("sharp")).default as unknown as typeof sharp;
    } catch {
      throw new KinaraError("Image optimization requires the optional peer `sharp`.", {
        code: "MISSING_PEER",
      });
    }

    let pipeline = sharp(input);
    if (options.width || options.height) {
      pipeline = pipeline.resize(options.width, options.height, { fit: options.fit ?? "inside" });
    }
    if (format === "webp") pipeline = pipeline.webp({ quality: options.quality ?? 80 });
    if (format === "jpeg") pipeline = pipeline.jpeg({ quality: options.quality ?? 80, mozjpeg: true });
    if (format === "png") pipeline = pipeline.png({ compressionLevel: 9 });
    if (format === "avif") pipeline = pipeline.avif({ quality: options.quality ?? 50 });

    const buffer = await pipeline.toBuffer();
    span.setAttribute?.("media.bytes", buffer.byteLength);
    return { buffer, contentType: TYPES[format], bytes: buffer.byteLength };
  });
}

export async function storeImage(
  disk: StorageDriver,
  path: string,
  input: Buffer,
  options: OptimizeOptions = {}
): Promise<OptimizedImage> {
  const optimized = await optimizeImage(input, options);
  await disk.write(path, optimized.buffer);
  return optimized;
}

type SharpLike = {
  resize(width?: number, height?: number, options?: { fit?: string }): SharpLike;
  webp(options?: { quality?: number }): SharpLike;
  jpeg(options?: { quality?: number; mozjpeg?: boolean }): SharpLike;
  png(options?: { compressionLevel?: number }): SharpLike;
  avif(options?: { quality?: number }): SharpLike;
  toBuffer(): Promise<Buffer>;
};

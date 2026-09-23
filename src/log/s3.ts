import { KinaraError } from "../errors.js";
import type { LogRecord, LogSink } from "../logger.js";

export interface S3LogSinkOptions {
  bucket: string;
  prefix?: string;
  region?: string;
  flushEvery?: number;
}

export function createS3LogSink(options: S3LogSinkOptions): LogSink {
  const buffer: LogRecord[] = [];
  const flushEvery = options.flushEvery ?? 20;
  let client: { send(command: unknown): Promise<unknown> } | null = null;

  const flush = async () => {
    if (buffer.length === 0) return;
    const batch = buffer.splice(0, buffer.length);
    const key = `${options.prefix ?? "logs"}/${new Date().toISOString().slice(0, 13)}/${Date.now()}.json`;
    try {
      const sdk = await import("@aws-sdk/client-s3");
      const s3 = client ?? new sdk.S3Client({ region: options.region ?? process.env.AWS_REGION });
      client = s3;
      await s3.send(
        new sdk.PutObjectCommand({
          Bucket: options.bucket,
          Key: key,
          Body: batch.map((row) => JSON.stringify(row)).join("\n"),
          ContentType: "application/x-ndjson",
        })
      );
    } catch (error) {
      throw new KinaraError("S3 log sink requires `@aws-sdk/client-s3` and valid credentials.", {
        code: "LOG_SINK_FAILED",
        details: error instanceof Error ? error.message : undefined,
      });
    }
  };

  return {
    async write(record) {
      buffer.push(record);
      if (buffer.length >= flushEvery) {
        await flush();
      }
    },
    flush,
  };
}

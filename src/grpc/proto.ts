import { mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { KinaraError } from "../errors.js";

export async function resolveProtoFile(service: {
  service: string;
  proto?: string;
  protoPath?: string;
}): Promise<string> {
  if (service.protoPath) return path.resolve(service.protoPath);
  if (!service.proto) {
    throw new KinaraError(`RPC ${service.service} needs proto or protoPath`, {
      code: "GRPC_PROTO_MISSING",
    });
  }
  const file = path.join(tmpdir(), `kinara-${randomBytes(6).toString("hex")}.proto`);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, service.proto);
  return file;
}

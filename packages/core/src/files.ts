import { mkdir, rename, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import type { ResourceMeta } from "./dto.js";
import { preconditionFailedError } from "./errors.js";

export async function fileMeta(file: string): Promise<ResourceMeta> {
  const info = await stat(file);
  return {
    path: file,
    updatedAt: info.mtime.toISOString(),
    etag: etagFromStat(info.mtimeMs, info.size),
  };
}

export async function assertRevision(file: string, ifMatch?: string): Promise<void> {
  if (!ifMatch) return;
  const meta = await fileMeta(file);
  if (meta.etag !== ifMatch) throw preconditionFailedError(`Resource changed since it was read: ${path.basename(file)}`);
}

export async function writeAtomic(file: string, content: string): Promise<void> {
  const dir = path.dirname(file);
  await mkdir(dir, { recursive: true });
  const temp = path.join(dir, `.${path.basename(file)}.${process.pid}.${Date.now()}.tmp`);
  await writeFile(temp, content, "utf8");
  await rename(temp, file);
}

function etagFromStat(mtimeMs: number, size: number): string {
  return `W/"${Math.round(mtimeMs)}-${size}"`;
}

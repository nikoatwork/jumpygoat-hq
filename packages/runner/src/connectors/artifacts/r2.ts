import { createHmac, createHash } from "node:crypto";
import { fetchWithTimeout, parseResponseBody, responseErrorDetail } from "../helpers.js";

export type R2Config = {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
};

export type R2PutObjectArgs = {
  key: string;
  body: Buffer;
  contentType?: string;
  timeoutMs: number;
  signal?: AbortSignal;
};

const REGION = "auto";
const SERVICE = "s3";
const ALGORITHM = "AWS4-HMAC-SHA256";

export function readR2ConfigFromEnv(): R2Config {
  const accountId = requiredEnv("CLOUDFLARE_R2_ACCOUNT_ID");
  const accessKeyId = requiredEnv("CLOUDFLARE_R2_ACCESS_KEY_ID");
  const secretAccessKey = requiredEnv("CLOUDFLARE_R2_SECRET_ACCESS_KEY");
  const bucket = requiredEnv("CLOUDFLARE_R2_BUCKET");
  return { accountId, accessKeyId, secretAccessKey, bucket };
}

export async function putR2Object(config: R2Config, args: R2PutObjectArgs): Promise<void> {
  const endpoint = objectUrl(config, args.key);
  const now = new Date();
  const amzDate = toAmzDate(now);
  const dateStamp = amzDate.slice(0, 8);
  const payloadHash = sha256Hex(args.body);
  const host = endpoint.host;
  const signedHeaders = "host;x-amz-content-sha256;x-amz-date";
  const canonicalHeaders = `host:${host}\nx-amz-content-sha256:${payloadHash}\nx-amz-date:${amzDate}\n`;
  const canonicalRequest = ["PUT", endpoint.pathname, "", canonicalHeaders, signedHeaders, payloadHash].join("\n");
  const credentialScope = `${dateStamp}/${REGION}/${SERVICE}/aws4_request`;
  const stringToSign = [ALGORITHM, amzDate, credentialScope, sha256Hex(canonicalRequest)].join("\n");
  const signature = hmacHex(signingKey(config.secretAccessKey, dateStamp), stringToSign);
  const authorization = `${ALGORITHM} Credential=${config.accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  const response = await fetchWithTimeout(endpoint.toString(), {
    method: "PUT",
    headers: {
      authorization,
      "content-type": args.contentType || "application/octet-stream",
      "content-length": String(args.body.byteLength),
      "x-amz-content-sha256": payloadHash,
      "x-amz-date": amzDate,
    },
    body: args.body as unknown as BodyInit,
  }, args.timeoutMs, args.signal);

  if (!response.ok) {
    const body = await parseResponseBody(response);
    throw new Error(`Cloudflare R2 PUT ${response.status}: ${responseErrorDetail(body)}`);
  }
}

export function presignR2GetObject(config: R2Config, key: string, expiresInSeconds: number, now = new Date()): string {
  const endpoint = objectUrl(config, key);
  const amzDate = toAmzDate(now);
  const dateStamp = amzDate.slice(0, 8);
  const credentialScope = `${dateStamp}/${REGION}/${SERVICE}/aws4_request`;
  const query: Record<string, string> = {
    "X-Amz-Algorithm": ALGORITHM,
    "X-Amz-Credential": `${config.accessKeyId}/${credentialScope}`,
    "X-Amz-Date": amzDate,
    "X-Amz-Expires": String(expiresInSeconds),
    "X-Amz-SignedHeaders": "host",
  };
  const canonicalQuery = canonicalQueryString(query);
  const canonicalHeaders = `host:${endpoint.host}\n`;
  const canonicalRequest = ["GET", endpoint.pathname, canonicalQuery, canonicalHeaders, "host", "UNSIGNED-PAYLOAD"].join("\n");
  const stringToSign = [ALGORITHM, amzDate, credentialScope, sha256Hex(canonicalRequest)].join("\n");
  const signature = hmacHex(signingKey(config.secretAccessKey, dateStamp), stringToSign);
  endpoint.search = `${canonicalQuery}&X-Amz-Signature=${signature}`;
  return endpoint.toString();
}

function objectUrl(config: R2Config, key: string): URL {
  return new URL(`/${encodePathSegment(config.bucket)}/${encodeS3Key(key)}`, `https://${config.accountId}.r2.cloudflarestorage.com`);
}

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing ${name}.`);
  return value;
}

function toAmzDate(date: Date): string {
  return date.toISOString().replace(/[:-]|\.\d{3}/g, "");
}

function sha256Hex(value: string | Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}

function hmac(key: Buffer | string, value: string): Buffer {
  return createHmac("sha256", key).update(value).digest();
}

function hmacHex(key: Buffer | string, value: string): string {
  return createHmac("sha256", key).update(value).digest("hex");
}

function signingKey(secretAccessKey: string, dateStamp: string): Buffer {
  const kDate = hmac(`AWS4${secretAccessKey}`, dateStamp);
  const kRegion = hmac(kDate, REGION);
  const kService = hmac(kRegion, SERVICE);
  return hmac(kService, "aws4_request");
}

function canonicalQueryString(query: Record<string, string>): string {
  return Object.entries(query)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${awsEncode(key)}=${awsEncode(value)}`)
    .join("&");
}

function encodeS3Key(key: string): string {
  return key.split("/").map(encodePathSegment).join("/");
}

function encodePathSegment(value: string): string {
  return awsEncode(value);
}

function awsEncode(value: string): string {
  return encodeURIComponent(value).replace(/[!'()*]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`);
}

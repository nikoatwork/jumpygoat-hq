import { fetchWithTimeout, parseResponseBody, responseErrorDetail } from "../helpers.js";

export async function sendResendEmail(args: {
  apiKey: string;
  from: string;
  to: string;
  subject: string;
  body: string;
  timeoutMs?: number;
  headers?: Record<string, string>;
  idempotencyKey?: string;
  signal?: AbortSignal;
}): Promise<string | undefined> {
  const headers: Record<string, string> = {
    authorization: `Bearer ${args.apiKey}`,
    "content-type": "application/json",
  };
  if (args.idempotencyKey) headers["idempotency-key"] = args.idempotencyKey;

  const response = await fetchWithTimeout(
    "https://api.resend.com/emails",
    {
      method: "POST",
      headers,
      body: JSON.stringify({
        from: args.from,
        to: [args.to],
        subject: args.subject,
        text: args.body,
        headers: args.headers,
      }),
    },
    args.timeoutMs ?? 30_000,
    args.signal,
  );

  const body = await parseResponseBody(response);
  if (!response.ok) {
    throw new Error(`Resend API ${response.status}: ${responseErrorDetail(body)}`);
  }

  if (body && typeof body === "object" && "id" in body) return String((body as { id: unknown }).id);
  return undefined;
}

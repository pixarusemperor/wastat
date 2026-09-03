import { queryRun, type DbClient } from "./db/client.js";

const BASE = `${process.env.WASENDER_BASE_URL ?? "https://www.wasenderapi.com/api"}`;

export interface WasenderSession {
  id: number;
  name: string;
  phone_number?: string | null;
  status: string;
  api_key: string;
  webhook_secret?: string | null;
}

/** Account-level Wasender client (PAT-scoped). ponytail: no retry/queue here —
 * admin calls are user-triggered, not hot-path. */
export function makeWasenderAdmin(pat: string, fetchImpl: typeof fetch = fetch) {
  async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
    const res = await fetchImpl(`${BASE}${path}`, {
      signal: AbortSignal.timeout(15_000),
      method,
      headers: { Authorization: `Bearer ${pat}`, "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (!res.ok) throw { status: res.status, body: await res.text().catch(() => "") };
    return (await res.json()) as T;
  }

  return {
    listSessions: () => call<{ data: WasenderSession[] }>("GET", "/whatsapp-sessions").then((r) => r.data),
    getSession: (id: number) => call<{ data: WasenderSession }>("GET", `/whatsapp-sessions/${id}`).then((r) => r.data),
    createSession: (name: string, webhookUrl?: string) =>
      call<{ data: WasenderSession }>("POST", "/whatsapp-sessions", {
        name,
        ...(webhookUrl ? { webhook_url: webhookUrl } : {}),
      }).then((r) => r.data),
    connectSession: (id: number, linkMethod: "qr" | "passkey" = "qr") =>
      call<{ success: boolean; data?: unknown }>("POST", `/whatsapp-sessions/${id}/connect`, { linkMethod }),
    getQrCode: (id: number) =>
      call<{ success: boolean; data?: { qrCode?: string } }>("GET", `/whatsapp-sessions/${id}/qrcode`).then(
        (r) => r.data?.qrCode ?? null,
      ),
    getStatus: (id: number) =>
      call<{ success: boolean; data?: { status?: string } }>("GET", `/whatsapp-sessions/${id}/status`).then(
        (r) => r.data?.status ?? "unknown",
      ),
    restartSession: (id: number) => call<unknown>("POST", `/whatsapp-sessions/${id}/restart`),
    disconnectSession: (id: number) => call<unknown>("POST", `/whatsapp-sessions/${id}/disconnect`),
    deleteSession: (id: number) => call<unknown>("DELETE", `/whatsapp-sessions/${id}`),
    updateWebhook: (id: number, webhookUrl: string, webhookEvents?: string[]) =>
      call<{ success: boolean; data?: unknown }>("PUT", `/whatsapp-sessions/${id}`, {
        webhook_url: webhookUrl,
        webhook_enabled: true,
        ...(webhookEvents ? { webhook_events: webhookEvents } : {}),
      }),
  };
}

export type WasenderAdmin = ReturnType<typeof makeWasenderAdmin>;

/** Mirror a remote session list into the sessions table (active provider). */
export async function upsertSession(db: DbClient, s: WasenderSession): Promise<void> {
  await queryRun(
    db,
    `
    INSERT INTO sessions (name, provider, provider_session_id, status, api_key_encrypted, webhook_secret)
    VALUES (?, 'wasender', ?, ?, ?, ?)
    ON CONFLICT(provider, provider_session_id) DO UPDATE SET
      name = excluded.name, status = excluded.status,
      api_key_encrypted = excluded.api_key_encrypted, webhook_secret = excluded.webhook_secret
  `,
    [s.name, String(s.id), s.status, Buffer.from(s.api_key, "utf8"), s.webhook_secret ?? null],
  );
}

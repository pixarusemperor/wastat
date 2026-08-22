import type BetterSqlite3 from "better-sqlite3";

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
      method,
      headers: { Authorization: `Bearer ${pat}`, "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (!res.ok) throw { status: res.status, body: await res.text().catch(() => "") };
    return (await res.json()) as T;
  }

  return {
    listSessions: () => call<{ data: WasenderSession[] }>("GET", "/whatsapp-sessions").then((r) => r.data),
    createSession: (name: string) =>
      call<{ data: WasenderSession }>("POST", "/whatsapp-sessions", { name }).then((r) => r.data),
    deleteSession: (id: number) => call<unknown>("DELETE", `/whatsapp-sessions/${id}`),
  };
}

export type WasenderAdmin = ReturnType<typeof makeWasenderAdmin>;

/** Mirror a remote session list into the local sessions table. */
export function upsertSession(db: BetterSqlite3.Database, s: WasenderSession): void {
  db.prepare(`
    INSERT INTO sessions (name, provider_session_id, status, api_key_encrypted, webhook_secret)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(provider_session_id) DO UPDATE SET
      name = excluded.name, status = excluded.status,
      api_key_encrypted = excluded.api_key_encrypted, webhook_secret = excluded.webhook_secret
  `).run(s.name, String(s.id), s.status, Buffer.from(s.api_key, "utf8"), s.webhook_secret ?? null);
}

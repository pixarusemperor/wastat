import Database from "better-sqlite3";
import type BetterSqlite3 from "better-sqlite3";
import { createEngine, type SendMessageInput } from "./engine.js";

const WASENDER_API = process.env.WASENDER_API_URL ?? "https://www.wasenderapi.com/api/send-message";

/**
 * Thin Wasender transport. `apiKey` is the session's API key (PAT is only for
 * account-level endpoints). ponytail: response id parsing is defensive because
 * Wasender doesn't document the send-response shape; revisit after first real send.
 */
export function makeWasenderTransport(): (input: SendMessageInput & { apiKey: string }) => Promise<{ providerMessageId: string }> {
  return async (input) => {
    const res = await fetch(WASENDER_API, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${input.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(
        input.kind === "media"
          ? { to: input.toPhone, mediaId: input.mediaId }
          : { to: input.toPhone, text: input.text },
      ),
    });
    if (!res.ok) throw { status: res.status };
    const body = (await res.json().catch(() => ({}))) as {
      data?: { key?: { id?: string }; message_id?: string; id?: string };
    };
    const providerMessageId =
      body.data?.key?.id ?? body.data?.message_id ?? body.data?.id ?? `unconfirmed-${Date.now()}`;
    return { providerMessageId };
  };
}

export function openDb(path: string): BetterSqlite3.Database {
  const db = new Database(path);
  db.pragma("journal_mode = WAL"); // ADR 0001
  db.pragma("foreign_keys = ON"); // ADR 0001
  return db;
}

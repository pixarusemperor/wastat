import Database from "better-sqlite3";
import type BetterSqlite3 from "better-sqlite3";
import { type SendMessageInput } from "./engine.js";
import { type StorageProvider, createStorageFromEnv } from "./media.js";

const WASENDER_API = `${process.env.WASENDER_BASE_URL ?? "https://www.wasenderapi.com/api"}/send-message`;

/**
 * Wasender outbound message transport. Formats payload according to Wasender API spec:
 * - Text: { to, text }
 * - Image: { to, text?: caption, imageUrl }
 * - Audio: { to, audioUrl }
 * - Video: { to, text?: caption, videoUrl }
 * - Document: { to, documentUrl, fileName }
 */
export function makeWasenderTransport(
  db?: BetterSqlite3.Database,
  storage: StorageProvider = createStorageFromEnv(),
  fetchImpl: typeof fetch = fetch,
): (input: SendMessageInput & { apiKey: string }) => Promise<{ providerMessageId: string }> {
  return async (input) => {
    let payload: Record<string, unknown> = { to: input.toPhone };

    if (input.kind === "media" && input.mediaId && db) {
      const asset = db
        .prepare("SELECT filename, mime_type, r2_key FROM media_assets WHERE id = ?")
        .get(input.mediaId) as { filename: string; mime_type: string; r2_key: string } | undefined;

      if (asset) {
        const publicUrl = storage.getPublicUrl(asset.r2_key);
        const mime = asset.mime_type.toLowerCase();

        if (mime.startsWith("image/")) {
          payload.imageUrl = publicUrl;
          if (input.text) payload.text = input.text;
        } else if (mime.startsWith("audio/")) {
          payload.audioUrl = publicUrl;
        } else if (mime.startsWith("video/")) {
          payload.videoUrl = publicUrl;
          if (input.text) payload.text = input.text;
        } else {
          payload.documentUrl = publicUrl;
          payload.fileName = asset.filename;
          if (input.text) payload.text = input.text;
        }
      } else {
        if (input.text) payload.text = input.text;
      }
    } else {
      payload.text = input.text ?? "";
    }

    const res = await fetchImpl(WASENDER_API, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${input.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) throw { status: res.status, body: await res.text().catch(() => "") };

    const body = (await res.json().catch(() => ({}))) as {
      data?: { key?: { id?: string }; message_id?: string; id?: string };
    };
    const providerMessageId =
      body.data?.key?.id ?? body.data?.message_id ?? body.data?.id ?? `unconfirmed-${Date.now()}`;
    return { providerMessageId };
  };
}

import { dirname } from "node:path";
import { mkdirSync } from "node:fs";

export function openDb(path: string): BetterSqlite3.Database {
  if (path !== ":memory:") {
    try {
      mkdirSync(dirname(path), { recursive: true });
    } catch {}
  }
  const db = new Database(path);
  db.pragma("journal_mode = WAL"); // ADR 0001
  db.pragma("foreign_keys = ON"); // ADR 0001
  return db;
}

import Database from "better-sqlite3";
import type BetterSqlite3 from "better-sqlite3";
import { type SendMessageInput } from "./engine.js";
import { type StorageProvider, createStorageFromEnv } from "./media.js";
import { queryGet, toDbClient, type DbClient } from "./db/client.js";

const WASENDER_API = `${process.env.WASENDER_BASE_URL ?? "https://www.wasenderapi.com/api"}/send-message`;

/**
 * Wasender outbound message transport. Formats payload according to Wasender API spec:
 * - Text: { to, text }
 * - Image: { to, text?: caption, imageUrl }
 * - Audio: { to, audioUrl }
 * - Video: { to, text?: caption, videoUrl }
 * - Document: { to, documentUrl, fileName }
 */
/**
 * Compiles options into a numbered WhatsApp text menu fallback.
 * Formats cleanly with bold numbers and optional descriptions.
 */
export function buildTextMenu(
  header: string | undefined,
  bodyText: string,
  options: Array<{ id: string; title: string; description?: string }>,
  footer: string | undefined,
): string {
  const lines: string[] = [];
  if (header && header.trim()) lines.push(`*${header.trim()}*\n`);
  if (bodyText && bodyText.trim()) lines.push(bodyText.trim());
  lines.push("");
  options.forEach((opt, idx) => {
    const desc = opt.description && opt.description.trim() ? ` - _${opt.description.trim()}_` : "";
    lines.push(`*${idx + 1}.* ${opt.title.trim()}${desc}`);
  });
  lines.push("");
  if (footer && footer.trim()) {
    lines.push(`_${footer.trim()}_`);
  } else {
    lines.push("_Reply with the number of your choice._");
  }
  return lines.join("\n");
}

/**
 * Sends a typing/recording presence update before outbound messages.
 */
export async function sendPresenceUpdate(
  apiKey: string,
  toPhone: string,
  type: "composing" | "recording" | "available" | "unavailable" = "composing",
  fetchImpl: typeof fetch = fetch,
): Promise<void> {
  const PRESENCE_API = `${process.env.WASENDER_BASE_URL ?? "https://www.wasenderapi.com/api"}/send-presence-update`;
  await fetchImpl(PRESENCE_API, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ jid: toPhone, type }),
  }).catch(() => {});
}

export function makeWasenderTransport(
  db?: BetterSqlite3.Database | DbClient,
  storage: StorageProvider = createStorageFromEnv(),
  fetchImpl: typeof fetch = fetch,
): (input: SendMessageInput & { apiKey: string }) => Promise<{ providerMessageId: string }> {
  const dbClient = db ? toDbClient(db) : undefined;
  return async (input) => {
    let payload: Record<string, unknown> = { to: input.toPhone };

    if (input.kind === "media") {
      let publicUrl = input.mediaUrl;
      let mime = input.mimeType?.toLowerCase();
      let fileName = input.filename;
      const mediaType = input.mediaType;

      if (input.mediaId && dbClient) {
        const asset = (await queryGet(
          dbClient,
          "SELECT filename, mime_type, r2_key FROM media_assets WHERE id = ?",
          [input.mediaId],
        )) as { filename: string; mime_type: string; r2_key: string } | undefined;

        if (asset) {
          publicUrl = storage.getPublicUrl(asset.r2_key);
          mime = asset.mime_type.toLowerCase();
          fileName = asset.filename;
        }
      }

      if (publicUrl) {
        // Strip query strings and fragment identifiers for accurate extension detection
        const cleanUrl = publicUrl.split("?")[0].split("#")[0];

        const isExplicitImage = mediaType === "image";
        const isExplicitAudio = mediaType === "audio";
        const isExplicitVideo = mediaType === "video";
        const isExplicitDocument = mediaType === "document";

        const isImage =
          isExplicitImage ||
          (!mediaType &&
            (mime?.startsWith("image/") || Boolean(cleanUrl.match(/\.(jpg|jpeg|png|webp|gif|svg|bmp|ico)$/i))));
        const isAudio =
          isExplicitAudio ||
          (!mediaType &&
            (mime?.startsWith("audio/") || Boolean(cleanUrl.match(/\.(mp3|ogg|wav|m4a|aac|opus|flac)$/i))));
        const isVideo =
          isExplicitVideo ||
          (!mediaType &&
            (mime?.startsWith("video/") || Boolean(cleanUrl.match(/\.(mp4|mov|webm|mkv|avi)$/i))));

        if (isImage) {
          payload.imageUrl = publicUrl;
          if (input.text) payload.text = input.text;
        } else if (isAudio) {
          payload.audioUrl = publicUrl;
        } else if (isVideo) {
          payload.videoUrl = publicUrl;
          if (input.text) payload.text = input.text;
        } else {
          payload.documentUrl = publicUrl;
          payload.fileName = fileName || (isExplicitDocument ? "document.pdf" : "attachment.pdf");
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

    let resText = "";
    let body: any = {};
    if (typeof res.text === "function") {
      resText = await res.text().catch(() => "");
      try {
        body = JSON.parse(resText);
      } catch {
        body = { raw: resText };
      }
    } else if (typeof res.json === "function") {
      body = await res.json().catch(() => ({}));
    }

    if (!res.ok) {
      throw { status: res.status, body, rawText: resText, payload };
    }

    const providerMessageId =
      body.data?.key?.id ?? body.data?.message_id ?? body.data?.msgId ?? body.data?.id ?? `unconfirmed-${Date.now()}`;
    return { providerMessageId: String(providerMessageId), status: res.status, rawPayload: payload, rawResponse: body };
  };
}

/** Mark message as read (blue ticks) */
export async function markMessageAsRead(
  apiKey: string,
  key: { id: string; remoteJid: string; fromMe?: boolean },
  fetchImpl: typeof fetch = fetch,
): Promise<void> {
  const url = `${process.env.WASENDER_BASE_URL ?? "https://www.wasenderapi.com/api"}/messages/read`;
  await fetchImpl(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ key }),
  }).catch(() => {});
}

/** React to a message with an emoji */
export async function sendReaction(
  apiKey: string,
  toPhone: string,
  key: { id: string; remoteJid: string; fromMe?: boolean },
  emoji: string,
  fetchImpl: typeof fetch = fetch,
): Promise<void> {
  await fetchImpl(WASENDER_API, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ to: toPhone, reaction: { key, text: emoji } }),
  }).catch(() => {});
}

/** Send a native WhatsApp poll */
export async function sendPoll(
  apiKey: string,
  toPhone: string,
  question: string,
  options: string[],
  multiSelect = false,
  fetchImpl: typeof fetch = fetch,
): Promise<void> {
  await fetchImpl(WASENDER_API, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      to: toPhone,
      poll: { question, options, multiSelect },
    }),
  }).catch(() => {});
}

/** Send a Contact Card (vCard) */
export async function sendContactCard(
  apiKey: string,
  toPhone: string,
  contact: { name: string; phone: string },
  fetchImpl: typeof fetch = fetch,
): Promise<void> {
  await fetchImpl(WASENDER_API, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ to: toPhone, contact }),
  }).catch(() => {});
}

/** Send GPS Location Pin */
export async function sendLocation(
  apiKey: string,
  toPhone: string,
  location: { latitude: number; longitude: number; name?: string; address?: string },
  fetchImpl: typeof fetch = fetch,
): Promise<void> {
  await fetchImpl(WASENDER_API, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ to: toPhone, location }),
  }).catch(() => {});
}

/** Block a contact */
export async function blockContact(
  apiKey: string,
  contactPhone: string,
  fetchImpl: typeof fetch = fetch,
): Promise<void> {
  const url = `${process.env.WASENDER_BASE_URL ?? "https://www.wasenderapi.com/api"}/contacts/${encodeURIComponent(contactPhone)}/block`;
  await fetchImpl(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
  }).catch(() => {});
}

/** Unblock a contact */
export async function unblockContact(
  apiKey: string,
  contactPhone: string,
  fetchImpl: typeof fetch = fetch,
): Promise<void> {
  const url = `${process.env.WASENDER_BASE_URL ?? "https://www.wasenderapi.com/api"}/contacts/${encodeURIComponent(contactPhone)}/unblock`;
  await fetchImpl(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
  }).catch(() => {});
}

/** Save or update contact in address book */
export async function upsertContact(
  apiKey: string,
  contact: { phone: string; name?: string },
  fetchImpl: typeof fetch = fetch,
): Promise<void> {
  const url = `${process.env.WASENDER_BASE_URL ?? "https://www.wasenderapi.com/api"}/contacts`;
  await fetchImpl(url, {
    method: "PUT",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(contact),
  }).catch(() => {});
}

/** Add participants to group */
export async function addGroupParticipants(
  apiKey: string,
  groupJid: string,
  participants: string[],
  fetchImpl: typeof fetch = fetch,
): Promise<void> {
  const url = `${process.env.WASENDER_BASE_URL ?? "https://www.wasenderapi.com/api"}/groups/${encodeURIComponent(groupJid)}/participants/add`;
  await fetchImpl(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ participants }),
  }).catch(() => {});
}

/** Remove participants from group */
export async function removeGroupParticipants(
  apiKey: string,
  groupJid: string,
  participants: string[],
  fetchImpl: typeof fetch = fetch,
): Promise<void> {
  const url = `${process.env.WASENDER_BASE_URL ?? "https://www.wasenderapi.com/api"}/groups/${encodeURIComponent(groupJid)}/participants/remove`;
  await fetchImpl(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ participants }),
  }).catch(() => {});
}

import { dirname, join } from "node:path";
import { mkdirSync } from "node:fs";

export function openDb(path: string): BetterSqlite3.Database {
  let targetPath = path;
  if (targetPath !== ":memory:") {
    try {
      mkdirSync(dirname(targetPath), { recursive: true });
    } catch {
      targetPath = join(process.cwd(), "data", "wastat.db");
      try {
        mkdirSync(dirname(targetPath), { recursive: true });
      } catch {}
    }
  }
  let db: BetterSqlite3.Database;
  try {
    db = new Database(targetPath);
  } catch {
    targetPath = join(process.cwd(), "data", "wastat.db");
    try {
      mkdirSync(dirname(targetPath), { recursive: true });
    } catch {}
    db = new Database(targetPath);
  }
  db.pragma("journal_mode = WAL"); // ADR 0001
  db.pragma("foreign_keys = ON"); // ADR 0001
  return db;
}


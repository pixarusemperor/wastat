import type { WhatsAppProviderAdapter, SessionContext, OutboundMessageInput, OutboundMessageResult, NormalizedWebhookEvent, SessionStatusResult } from "./types.js";
import { formatWasenderTo, normalizePhoneNumber } from "@wastat/shared";
import { buildTextMenu, sendPresenceUpdate } from "../wasender.js";
import { makeWasenderAdmin } from "../wasender-admin.js";

const DEFAULT_WASENDER_BASE_URL = "https://www.wasenderapi.com/api";

export class WasenderProviderAdapter implements WhatsAppProviderAdapter {
  readonly provider = "wasender" as const;

  private getBaseUrl(): string {
    return process.env.WASENDER_BASE_URL || DEFAULT_WASENDER_BASE_URL;
  }

  async sendMessage(session: SessionContext, input: OutboundMessageInput): Promise<OutboundMessageResult> {
    const baseUrl = this.getBaseUrl();
    const formattedTo = formatWasenderTo(input.to);

    let payload: Record<string, unknown> = { to: formattedTo };

    if (input.menu) {
      payload.text = buildTextMenu(undefined, input.menu.body, input.menu.options, input.menu.footer);
    } else if (input.mediaUrl) {
      const publicUrl = input.mediaUrl;
      const cleanUrl = publicUrl.split("?")[0].split("#")[0];
      const mime = input.mimetype?.toLowerCase();
      const mediaType = input.mediaType;

      const isImage = mediaType === "image" || (!mediaType && (mime?.startsWith("image/") || Boolean(cleanUrl.match(/\.(jpg|jpeg|png|webp|gif|svg|bmp|ico)$/i))));
      const isAudio = mediaType === "audio" || (!mediaType && (mime?.startsWith("audio/") || Boolean(cleanUrl.match(/\.(mp3|ogg|wav|m4a|aac|opus|flac)$/i))));
      const isVideo = mediaType === "video" || (!mediaType && (mime?.startsWith("video/") || Boolean(cleanUrl.match(/\.(mp4|mov|webm|mkv|avi)$/i))));

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
        payload.fileName = input.fileName || "attachment.pdf";
        if (input.text) payload.text = input.text;
      }
    } else {
      payload.text = input.text ?? "";
    }

    const res = await fetch(`${baseUrl}/send-message`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${session.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const resText = await res.text().catch(() => "");
    let body: any = {};
    try {
      body = JSON.parse(resText);
    } catch {
      body = {};
    }

    if (!res.ok) {
      throw new Error(`Wasender API HTTP ${res.status}: ${resText || res.statusText}`);
    }

    const providerMessageId =
      body?.data?.key?.id ||
      body?.data?.id ||
      body?.key?.id ||
      body?.id ||
      body?.messageId ||
      body?.provider_message_id;

    if (!providerMessageId) {
      throw new Error(`Wasender response did not include a message key ID: ${resText}`);
    }

    return {
      providerMessageId: String(providerMessageId),
      status: "sent",
      rawResponse: body,
    };
  }

  async sendPresenceUpdate(session: SessionContext, to: string, presence: "composing" | "recording" | "available" | "unavailable"): Promise<void> {
    const formattedTo = formatWasenderTo(to);
    const presenceType = presence === "composing" || presence === "recording" ? "composing" : presence === "available" ? "available" : "unavailable";
    await sendPresenceUpdate(session.apiKey, formattedTo, presenceType as any).catch(() => {});
  }

  async markAsRead(_session: SessionContext, _messageId: string, _chatId?: string): Promise<void> {
    // Wasender companion doesn't require explicit remote read marking for bot funnels
  }

  verifyWebhookSignature(_rawBody: string | Buffer, headers: Record<string, string | string[] | undefined>, secret?: string): boolean {
    if (!secret) return true;
    const signature = headers["x-webhook-signature"];
    const sigStr = Array.isArray(signature) ? signature[0] : signature;
    return sigStr === secret;
  }

  parseWebhook(payload: unknown, _headers?: Record<string, string | string[] | undefined>): NormalizedWebhookEvent | null {
    if (!payload || typeof payload !== "object") return null;
    const body = payload as Record<string, any>;
    const eventName = body.event || "";

    // 1. Session Status
    if (eventName === "session.status" || eventName === "connection.update") {
      return {
        provider: "wasender",
        eventType: "status.updated",
        sessionLookup: { providerSessionId: body.sessionId || body.data?.sessionId },
        rawPayload: payload,
      };
    }

    // 2. Message ACK
    if (eventName === "messages.update" || eventName === "message_ack" || eventName === "message.update") {
      const updates = Array.isArray(body.data) ? body.data : [body.data || {}];
      const item = updates[0] || {};
      const msgId = item.key?.id || item.id;
      const statusRaw = item.update?.status || item.status;

      let status: "queued" | "sent" | "delivered" | "read" | "failed" = "sent";
      if (statusRaw === 3 || statusRaw === "delivered") status = "delivered";
      else if (statusRaw === 4 || statusRaw === "read") status = "read";
      else if (statusRaw === 2 || statusRaw === "sent") status = "sent";
      else if (statusRaw === -1 || statusRaw === "failed") status = "failed";

      return {
        provider: "wasender",
        eventType: "message.ack",
        sessionLookup: { providerSessionId: body.sessionId || body.data?.sessionId },
        ack: {
          messageId: msgId,
          status,
          rawAck: statusRaw,
        },
        rawPayload: payload,
      };
    }

    // 3. Message Received
    const isMessageEvent =
      eventName === "messages.received" ||
      eventName === "messages-group.received" ||
      eventName === "messages.upsert" ||
      eventName === "message.received";

    if (isMessageEvent) {
      const key = body.data?.messages?.key || body.data?.key;
      if (!key?.id || !key.remoteJid) {
        return {
          provider: "wasender",
          eventType: "ignored",
          sessionLookup: {},
          rawPayload: payload,
        };
      }

      const isGroup = Boolean(key.remoteJid.endsWith("@g.us") || eventName === "messages-group.received");
      const phone =
        key.cleanedSenderPn ||
        key.cleanedParticipantPn ||
        (!isGroup && key.remoteJid.includes("@") ? key.remoteJid.split("@")[0] : key.remoteJid);
      const cleanSender = phone;

      const m = Array.isArray(body.data?.messages) ? body.data?.messages[0] : (body.data?.messages || body.data?.message || body.data);
      const messageBody =
        m?.messageBody ??
        m?.conversation ??
        m?.extendedTextMessage?.text ??
        m?.imageMessage?.caption ??
        m?.videoMessage?.caption ??
        m?.documentMessage?.caption ??
        m?.buttonsResponseMessage?.selectedDisplayText ??
        m?.listResponseMessage?.title ??
        body.data?.messageBody ??
        body.data?.text ??
        body.data?.body ??
        null;

      const pushName = body.data?.messages?.pushName || body.data?.pushName || undefined;
      const ts = body.timestamp ? new Date(body.timestamp * 1000).toISOString() : new Date().toISOString();

      return {
        provider: "wasender",
        eventType: "message.created",
        sessionLookup: { providerSessionId: body.sessionId || body.data?.sessionId },
        message: {
          id: key.id,
          chatId: key.remoteJid,
          senderPhone: cleanSender,
          fromMe: Boolean(key.fromMe),
          body: messageBody,
          timestamp: ts,
          isGroup,
          pushName,
        },
        rawPayload: payload,
      };
    }

    return {
      provider: "wasender",
      eventType: "ignored",
      sessionLookup: {},
      rawPayload: payload,
    };
  }

  async getSessionStatus(session: SessionContext): Promise<SessionStatusResult> {
    const pat = session.apiKey || process.env.WASENDER_PAT || "";
    const admin = makeWasenderAdmin(pat);
    const numId = Number(session.providerSessionId) || 0;
    const statusStr = await admin.getStatus(numId).catch(() => "unknown");
    const isReady = statusStr.toLowerCase() === "connected" || statusStr.toLowerCase() === "working";

    return {
      status: isReady ? "connected" : statusStr.toLowerCase().includes("connect") ? "connecting" : "disconnected",
      isReady,
      raw: { status: statusStr },
    };
  }

  async getQrCode(session: SessionContext): Promise<{ qr?: string; status?: string }> {
    const pat = session.apiKey || process.env.WASENDER_PAT || "";
    const admin = makeWasenderAdmin(pat);
    const numId = Number(session.providerSessionId) || 0;
    const qr = await admin.getQrCode(numId).catch(() => null);
    return { qr: qr || undefined };
  }

  async restartSession(session: SessionContext): Promise<void> {
    const pat = session.apiKey || process.env.WASENDER_PAT || "";
    const admin = makeWasenderAdmin(pat);
    const numId = Number(session.providerSessionId) || 0;
    await admin.restartSession(numId).catch(() => {});
  }

  async disconnectSession(session: SessionContext): Promise<void> {
    const pat = session.apiKey || process.env.WASENDER_PAT || "";
    const admin = makeWasenderAdmin(pat);
    const numId = Number(session.providerSessionId) || 0;
    await admin.deleteSession(numId).catch(() => {});
  }

  async listConnectedPhones(_session: { apiKey?: string; baseUrl?: string }): Promise<Array<{ phone: string; phoneId?: string; phoneName?: string; status: string; isReady: boolean }>> {
    return [];
  }
}

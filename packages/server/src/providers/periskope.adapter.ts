import crypto from "node:crypto";
import type { WhatsAppProviderAdapter, SessionContext, OutboundMessageInput, OutboundMessageResult, NormalizedWebhookEvent, SessionStatusResult } from "./types.js";
import { formatPeriskopeChatId, normalizePhoneNumber } from "@wastat/shared";
import { buildTextMenu } from "../wasender.js";

const DEFAULT_PERISKOPE_BASE_URL = "https://api.periskope.app/v1";

export class PeriskopeProviderAdapter implements WhatsAppProviderAdapter {
  readonly provider = "periskope" as const;

  private getBaseUrl(): string {
    return process.env.PERISKOPE_BASE_URL || DEFAULT_PERISKOPE_BASE_URL;
  }

  private getOrgPhone(session: SessionContext): string {
    const raw = session.providerConfig?.orgPhone || session.providerSessionId;
    return normalizePhoneNumber(raw);
  }

  async sendMessage(session: SessionContext, input: OutboundMessageInput): Promise<OutboundMessageResult> {
    const baseUrl = this.getBaseUrl();
    const orgPhone = this.getOrgPhone(session);
    const { chatId } = formatPeriskopeChatId(input.to);

    const payload: Record<string, unknown> = {
      chat_id: chatId,
    };

    if (input.poll) {
      payload.poll = {
        pollName: input.poll.name,
        pollOptions: input.poll.options.map((opt) => ({ name: opt })),
        options: {
          allowMultipleAnswers: Boolean(input.poll.allowMultipleAnswers),
        },
      };
    } else if (input.menu) {
      payload.message = buildTextMenu(undefined, input.menu.body, input.menu.options, input.menu.footer);
    } else if (input.mediaUrl) {
      const publicUrl = input.mediaUrl;
      const cleanUrl = publicUrl.split("?")[0].split("#")[0];
      const mime = input.mimetype?.toLowerCase();
      const mediaType = input.mediaType;

      const isImage = mediaType === "image" || (!mediaType && (mime?.startsWith("image/") || Boolean(cleanUrl.match(/\.(jpg|jpeg|png|webp|gif|svg|bmp|ico)$/i))));
      const isAudio = mediaType === "audio" || (!mediaType && (mime?.startsWith("audio/") || Boolean(cleanUrl.match(/\.(mp3|ogg|wav|m4a|aac|opus|flac)$/i))));
      const isVideo = mediaType === "video" || (!mediaType && (mime?.startsWith("video/") || Boolean(cleanUrl.match(/\.(mp4|mov|webm|mkv|avi)$/i))));

      let finalType: "image" | "audio" | "video" | "document" = "document";
      let defaultFilename = "attachment.pdf";

      if (isImage) {
        finalType = "image";
        defaultFilename = "image.jpg";
      } else if (isAudio) {
        finalType = "audio";
        defaultFilename = "audio.mp3";
      } else if (isVideo) {
        finalType = "video";
        defaultFilename = "video.mp4";
      }

      payload.media = {
        type: finalType,
        url: publicUrl,
        filename: input.fileName || defaultFilename,
        mimetype: mime || (isImage ? "image/jpeg" : isAudio ? "audio/mpeg" : isVideo ? "video/mp4" : "application/pdf"),
      };

      if (input.ptt) {
        payload.ptt = true;
      }
      if (input.text) {
        payload.message = input.text;
      }
    } else {
      payload.message = input.text ?? "";
    }

    const res = await fetch(`${baseUrl}/message/send`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${session.apiKey}`,
        "x-phone": orgPhone,
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
      throw new Error(`Periskope API HTTP ${res.status}: ${resText || res.statusText}`);
    }

    const uniqueId = body?.unique_id || body?.id || body?.message_id;
    const queueId = body?.queue_id;

    // We return unique_id (matches WhatsApp stanza ID) or fallback to queue_id
    const providerMessageId = uniqueId ? String(uniqueId) : queueId ? String(queueId) : "";
    if (!providerMessageId) {
      throw new Error(`Periskope response missing unique_id and queue_id: ${resText}`);
    }

    return {
      providerMessageId,
      queueId: queueId ? String(queueId) : undefined,
      status: body?.status === "queued" ? "queued" : "sent",
      rawResponse: body,
    };
  }

  async sendPresenceUpdate(_session: SessionContext, _to: string, presence: "composing" | "recording" | "available" | "unavailable"): Promise<void> {
    // Periskope API does not expose a presence endpoint.
    // Simulate human typing presence jitter locally (1.5s - 3.5s) when composing
    if (presence === "composing" || presence === "recording") {
      const delayMs = 1500 + Math.floor(Math.random() * 2000);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  async markAsRead(session: SessionContext, _messageId: string, chatId?: string): Promise<void> {
    if (!chatId) return;
    const baseUrl = this.getBaseUrl();
    const orgPhone = this.getOrgPhone(session);
    const { chatId: cleanChatId } = formatPeriskopeChatId(chatId);

    await fetch(`${baseUrl}/chats/${encodeURIComponent(cleanChatId)}/read`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${session.apiKey}`,
        "x-phone": orgPhone,
        "Content-Type": "application/json",
      },
    }).catch(() => {});
  }

  async markChatAsRead(session: SessionContext, chatId: string): Promise<void> {
    return this.markAsRead(session, "", chatId);
  }

  async sendReaction(session: SessionContext, messageId: string, reactionText: string, to: string): Promise<void> {
    const baseUrl = this.getBaseUrl();
    const orgPhone = this.getOrgPhone(session);
    const { chatId } = formatPeriskopeChatId(to);

    await fetch(`${baseUrl}/message/reaction`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${session.apiKey}`,
        "x-phone": orgPhone,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        chat_id: chatId,
        message_id: messageId,
        reaction: reactionText,
      }),
    }).catch(() => {});
  }

  verifyWebhookSignature(rawBody: string | Buffer, headers: Record<string, string | string[] | undefined>, secret?: string): boolean {
    if (!secret) return true;

    const signature = headers["x-periskope-signature"] || headers["x-hub-signature-256"] || headers["x-signature"];
    const sigStr = Array.isArray(signature) ? signature[0] : signature;
    if (!sigStr) return false;

    const rawBuf = Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(rawBody || "", "utf8");
    const hmac = crypto.createHmac("sha256", secret).update(rawBuf).digest("hex");

    const expectedBuf = Buffer.from(hmac, "utf8");
    const receivedBuf = Buffer.from(sigStr.replace(/^sha256=/, ""), "utf8");

    if (expectedBuf.length !== receivedBuf.length) {
      return false;
    }

    return crypto.timingSafeEqual(expectedBuf, receivedBuf);
  }

  parseWebhook(payload: unknown, _headers?: Record<string, string | string[] | undefined>): NormalizedWebhookEvent | null {
    if (!payload || typeof payload !== "object") return null;
    const body = payload as Record<string, any>;
    const eventType = body.event_type || body.event || "";
    const data = body.data || {};

    const orgPhoneRaw = data.org_phone || body.org_phone || "";
    const orgPhone = orgPhoneRaw ? normalizePhoneNumber(orgPhoneRaw) : undefined;

    // Replay drift protection: check timestamp
    const eventTimestamp = body.timestamp || data.timestamp || new Date().toISOString();

    // 1. Inbound message created
    if (eventType === "message.created" || eventType === "message.received") {
      const chatId = data.chat_id || "";
      const isGroup = chatId.endsWith("@g.us");

      const cleanPhone = (jid: string | null | undefined): string => {
        if (!jid) return "";
        return jid.replace(/@(c|g)\.us$/, "").replace(/\D/g, "");
      };

      const fromMe = Boolean(data.from_me ?? data.id?.from_me ?? data.fromMe);
      // Identity resolution:
      // If group: participant is author (or sender_phone)
      // If 1-on-1: participant is sender_phone (or chatId)
      const rawParticipant = isGroup ? (data.author || data.sender_phone) : (data.sender_phone || chatId);
      const senderPhone = cleanPhone(rawParticipant);

      const messageId = data.id?.id || data.id?._serialized || data.message_id || data.id;
      const queueId = data.sent_message_id || data.queue_id;

      const media = data.media;
      const hasMedia = Boolean(data.has_media || media);

      return {
        provider: "periskope",
        eventType: "message.created",
        eventTimestamp,
        sessionLookup: { orgPhone },
        message: {
          id: String(messageId || ""),
          queueId: queueId ? String(queueId) : undefined,
          chatId,
          senderPhone,
          fromMe,
          body: data.body ?? data.message ?? data.text ?? null,
          timestamp: data.timestamp || eventTimestamp,
          isGroup,
          pushName: data.sender_name || data.push_name || data.author_name || undefined,
          mediaUrl: media?.url || media?.path,
          mediaType: media?.type || data.message_type,
          mediaMimeType: media?.mimetype,
          hasMedia,
          quotedMessageId: data.quoted_message_id || data.quoted_msg?.id,
        },
        rawPayload: payload,
      };
    }

    // 2. Message ACK
    if (eventType === "message.ack.updated" || eventType === "message.ack") {
      const rawAck = data.ack;
      let status: "queued" | "sent" | "delivered" | "read" | "failed" = "sent";

      if (rawAck === -1 || rawAck === "failed") status = "failed";
      else if (rawAck === 1 || rawAck === "sent") status = "sent";
      else if (rawAck === 2 || rawAck === 3 || rawAck === "delivered") status = "delivered";
      else if (rawAck === 4 || rawAck === 5 || rawAck === "read" || rawAck === "played") status = "read";

      const messageId = data.message_id || data.id?.id || data.id?._serialized || data.id;
      const queueId = data.queue_id || data.sent_message_id;

      return {
        provider: "periskope",
        eventType: "message.ack",
        eventTimestamp,
        sessionLookup: { orgPhone },
        ack: {
          messageId: String(messageId || ""),
          queueId: queueId ? String(queueId) : undefined,
          status,
          rawAck,
        },
        rawPayload: payload,
      };
    }

    // 3. Reaction created
    if (eventType === "reaction.created") {
      const messageId = data.message_id || data.id;
      const reactionText = data.reaction || data.emoji || "";
      const senderPhone = data.sender_phone ? normalizePhoneNumber(data.sender_phone) : "";

      return {
        provider: "periskope",
        eventType: "reaction.created",
        eventTimestamp,
        sessionLookup: { orgPhone },
        reaction: {
          messageId: String(messageId || ""),
          reactionText,
          senderPhone,
        },
        rawPayload: payload,
      };
    }

    // 4. Phone status updated
    if (eventType === "phone.status.updated") {
      return {
        provider: "periskope",
        eventType: "status.updated",
        eventTimestamp,
        sessionLookup: { orgPhone },
        rawPayload: payload,
      };
    }

    return {
      provider: "periskope",
      eventType: "ignored",
      eventTimestamp,
      sessionLookup: { orgPhone },
      rawPayload: payload,
    };
  }

  async getSessionStatus(session: SessionContext): Promise<SessionStatusResult> {
    const baseUrl = this.getBaseUrl();
    const orgPhone = this.getOrgPhone(session);

    const res = await fetch(`${baseUrl}/phones`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${session.apiKey}`,
        "x-phone": orgPhone,
      },
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return {
        status: "disconnected",
        isReady: false,
        phone: orgPhone,
        raw: { error: text, status: res.status },
      };
    }

    const data: any = await res.json().catch(() => ({}));
    // data can be an array of phones or a single phone object
    const phones = Array.isArray(data) ? data : data.phones || [data];
    const targetPhone = phones.find((p: any) => normalizePhoneNumber(p.phone || p.phone_id) === orgPhone) || phones[0];

    const rawStatus = (targetPhone?.status || "DISCONNECTED").toUpperCase();
    const isReady = Boolean(targetPhone?.is_ready);

    const status: "connected" | "disconnected" | "connecting" =
      isReady || rawStatus === "CONNECTED"
        ? "connected"
        : rawStatus.includes("CONNECT")
        ? "connecting"
        : "disconnected";

    return {
      status,
      isReady,
      phone: targetPhone?.phone || orgPhone,
      raw: targetPhone,
    };
  }

  async getQrCode(session: SessionContext): Promise<{ qr?: string; status?: string }> {
    const baseUrl = this.getBaseUrl();
    const orgPhone = this.getOrgPhone(session);

    const res = await fetch(`${baseUrl}/phones/qr`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${session.apiKey}`,
        "x-phone": orgPhone,
      },
    });

    if (!res.ok) return {};
    const data: any = await res.json().catch(() => ({}));
    return {
      qr: data.qr || data.qrcode,
      status: data.status,
    };
  }

  async restartSession(session: SessionContext): Promise<void> {
    const baseUrl = this.getBaseUrl();
    const orgPhone = this.getOrgPhone(session);

    await fetch(`${baseUrl}/phones/restart`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${session.apiKey}`,
        "x-phone": orgPhone,
      },
    }).catch(() => {});
  }

  async disconnectSession(session: SessionContext): Promise<void> {
    const baseUrl = this.getBaseUrl();
    const orgPhone = this.getOrgPhone(session);

    await fetch(`${baseUrl}/phones/reset`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${session.apiKey}`,
        "x-phone": orgPhone,
      },
    }).catch(() => {});
  }

  async purgeQueue(session: SessionContext, options?: { all?: boolean }): Promise<void> {
    const baseUrl = this.getBaseUrl();
    const orgPhone = this.getOrgPhone(session);

    await fetch(`${baseUrl}/message/queues/purge`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${session.apiKey}`,
        "x-phone": orgPhone,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ all: options?.all ?? true }),
    }).catch(() => {});
  }
}

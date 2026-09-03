import type { WhatsAppProviderType, SessionProviderConfig } from "@wastat/shared";
export type { WhatsAppProviderType, SessionProviderConfig } from "@wastat/shared";

export interface SessionContext {
  id: number;
  provider: WhatsAppProviderType;
  providerSessionId: string;
  apiKey: string; // decrypted API key
  webhookSecret?: string; // decrypted webhook signing secret
  providerConfig?: SessionProviderConfig;
  sessionId?: number;
}

export interface OutboundMessageInput {
  to: string; // phone number digits or group JID (e.g. 120363...@g.us)
  text?: string;
  mediaUrl?: string;
  mediaType?: "image" | "audio" | "video" | "document";
  fileName?: string;
  mimetype?: string;
  ptt?: boolean; // Push-to-Talk voice message
  poll?: {
    name: string;
    options: string[];
    allowMultipleAnswers?: boolean;
  };
  menu?: {
    body: string;
    footer?: string;
    options: Array<{ id: string; title: string }>;
  };
  priority?: 1 | 2; // 1 = 1-on-1 customer reply, 2 = bulk dispatch
}

export interface OutboundMessageResult {
  providerMessageId: string; // downstream WhatsApp stanza ID (e.g. 3EB0... or unique_id)
  queueId?: string;          // Periskope queue_id if queued asynchronously
  status: "sent" | "queued";
  rawResponse?: unknown;
}

export type NormalizedDeliveryStatus = "queued" | "sent" | "delivered" | "read" | "failed";

export interface NormalizedWebhookEvent {
  provider: WhatsAppProviderType;
  eventType: "message.created" | "message.ack" | "reaction.created" | "participant.update" | "status.updated" | "ignored";
  eventTimestamp?: string;
  sessionLookup: {
    providerSessionId?: string; // from route param :providerSessionId
    orgPhone?: string;          // from payload (e.g. 918527184400@c.us)
  };
  message?: {
    id: string;                 // WhatsApp stanza ID (key.id)
    queueId?: string;           // Periskope queue_id / sent_message_id if present
    chatId: string;             // WhatsApp chat JID (e.g. 123@c.us or 123@g.us)
    senderPhone: string;        // Participant E.164 digits
    fromMe: boolean;
    body?: string | null;
    timestamp: string;
    isGroup: boolean;
    pushName?: string;
    mediaUrl?: string;
    mediaType?: string;
    mediaMimeType?: string;
    hasMedia?: boolean;
    quotedMessageId?: string;
  };
  ack?: {
    messageId: string;
    queueId?: string;
    status: NormalizedDeliveryStatus;
    rawAck?: number | string;
  };
  reaction?: {
    messageId: string;
    reactionText: string;
    senderPhone: string;
    emoji?: string;
  };
  rawPayload: unknown;
}

export interface SessionStatusResult {
  status: "connected" | "disconnected" | "connecting";
  isReady: boolean;
  phone?: string;
  raw?: unknown;
}

export interface WhatsAppProviderAdapter {
  readonly provider: WhatsAppProviderType;

  sendMessage(session: SessionContext, input: OutboundMessageInput): Promise<OutboundMessageResult>;
  sendPresenceUpdate(session: SessionContext, to: string, presence: "composing" | "recording" | "available" | "unavailable"): Promise<void>;
  markAsRead(session: SessionContext, messageId: string, chatId?: string): Promise<void>;
  markChatAsRead?(session: SessionContext, chatId: string): Promise<void>;
  sendReaction?(session: SessionContext, messageId: string, reactionText: string, to: string): Promise<void>;

  verifyWebhookSignature(rawBody: string | Buffer, headers: Record<string, string | string[] | undefined>, secret?: string): boolean;
  parseWebhook(payload: unknown, headers?: Record<string, string | string[] | undefined>): NormalizedWebhookEvent | null;

  getSessionStatus(session: SessionContext): Promise<SessionStatusResult>;
  connect?(session: SessionContext): Promise<void>;
  getQrCode?(session: SessionContext): Promise<{ qr?: string; status?: string }>;
  restart?(session: SessionContext): Promise<void>;
  restartSession?(session: SessionContext): Promise<void>;
  disconnect?(session: SessionContext): Promise<void>;
  disconnectSession?(session: SessionContext): Promise<void>;
  registerWebhook?(session: SessionContext, url: string): Promise<void>;
  deleteSession?(session: SessionContext): Promise<void>;
  purgeQueue?(session: SessionContext, options?: { all?: boolean }): Promise<void>;
  listConnectedPhones?(session: { apiKey?: string; baseUrl?: string }): Promise<Array<{ phone: string; phoneId?: string; phoneName?: string; status: string; isReady: boolean }>>;
}

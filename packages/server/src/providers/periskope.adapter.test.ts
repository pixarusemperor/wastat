import { describe, it, expect } from "vitest";
import crypto from "node:crypto";
import { PeriskopeProviderAdapter } from "./periskope.adapter.js";
import type { SessionContext } from "./types.js";

describe("PeriskopeProviderAdapter", () => {
  const adapter = new PeriskopeProviderAdapter();
  const mockSession: SessionContext = {
    id: 1,
    provider: "periskope",
    providerSessionId: "session_periskope_1",
    apiKey: "prsk_test_123456",
    webhookSecret: "whsec_secret_key_123",
    providerConfig: {
      orgPhone: "918527184400",
    },
  };

  describe("verifyWebhookSignature", () => {
    it("verifies valid HMAC-SHA256 signature against raw body", () => {
      const secret = "whsec_secret_key_123";
      const rawBody = JSON.stringify({ event_type: "message.created", data: { text: "Hello" } });
      const signature = crypto.createHmac("sha256", secret).update(Buffer.from(rawBody, "utf8")).digest("hex");

      const isValid = adapter.verifyWebhookSignature(rawBody, {
        "x-periskope-signature": signature,
      }, secret);

      expect(isValid).toBe(true);
    });

    it("rejects invalid or tampered HMAC signature", () => {
      const secret = "whsec_secret_key_123";
      const rawBody = JSON.stringify({ event_type: "message.created", data: { text: "Hello" } });
      const wrongSignature = "bad_signature_deadbeef";

      const isValid = adapter.verifyWebhookSignature(rawBody, {
        "x-periskope-signature": wrongSignature,
      }, secret);

      expect(isValid).toBe(false);
    });

    it("allows verification if no secret is configured", () => {
      expect(adapter.verifyWebhookSignature("{}", {})).toBe(true);
    });
  });

  describe("parseWebhook", () => {
    it("parses 1-on-1 incoming message correctly", () => {
      const payload = {
        event_type: "message.created",
        org_id: "org_abc",
        timestamp: "2026-09-03T10:00:00Z",
        data: {
          chat_id: "919876543210@c.us",
          sender_phone: "919876543210@c.us",
          org_phone: "918527184400@c.us",
          from_me: false,
          body: "Interested in the product",
          sender_name: "Rahul Verma",
          id: { id: "3EB0123456789" },
        },
      };

      const event = adapter.parseWebhook(payload);
      expect(event).not.toBeNull();
      expect(event?.eventType).toBe("message.created");
      expect(event?.sessionLookup.orgPhone).toBe("918527184400");
      expect(event?.message?.id).toBe("3EB0123456789");
      expect(event?.message?.chatId).toBe("919876543210@c.us");
      expect(event?.message?.senderPhone).toBe("919876543210");
      expect(event?.message?.fromMe).toBe(false);
      expect(event?.message?.body).toBe("Interested in the product");
      expect(event?.message?.pushName).toBe("Rahul Verma");
      expect(event?.message?.isGroup).toBe(false);
    });

    it("parses group incoming message with individual participant isolation", () => {
      const payload = {
        event_type: "message.created",
        data: {
          chat_id: "120363024883@g.us",
          sender_phone: "919988776655@c.us",
          author: "919988776655@c.us",
          org_phone: "918527184400@c.us",
          from_me: false,
          body: "Hello group",
          id: { id: "3EB0987654321" },
        },
      };

      const event = adapter.parseWebhook(payload);
      expect(event?.eventType).toBe("message.created");
      expect(event?.message?.isGroup).toBe(true);
      expect(event?.message?.chatId).toBe("120363024883@g.us");
      expect(event?.message?.senderPhone).toBe("919988776655");
    });

    it("extracts queue_id on bot echo message", () => {
      const payload = {
        event_type: "message.created",
        data: {
          chat_id: "919876543210@c.us",
          sender_phone: "918527184400@c.us",
          org_phone: "918527184400@c.us",
          from_me: true,
          body: "Automated greeting from bot",
          id: { id: "3EB055555" },
          sent_message_id: "queue_9999",
        },
      };

      const event = adapter.parseWebhook(payload);
      expect(event?.message?.fromMe).toBe(true);
      expect(event?.message?.id).toBe("3EB055555");
      expect(event?.message?.queueId).toBe("queue_9999");
    });

    it("normalizes delivery acknowledgments (ack: 1, 2, 4)", () => {
      const sentAck = adapter.parseWebhook({
        event_type: "message.ack.updated",
        data: { id: "3EB0111", ack: 1, org_phone: "918527184400" },
      });
      expect(sentAck?.ack?.status).toBe("sent");

      const deliveredAck = adapter.parseWebhook({
        event_type: "message.ack.updated",
        data: { id: "3EB0111", ack: 2, org_phone: "918527184400" },
      });
      expect(deliveredAck?.ack?.status).toBe("delivered");

      const readAck = adapter.parseWebhook({
        event_type: "message.ack.updated",
        data: { id: "3EB0111", ack: 4, org_phone: "918527184400" },
      });
      expect(readAck?.ack?.status).toBe("read");
    });
  });

  describe("listConnectedPhones", () => {
    it("fetches and normalizes connected phones list from Periskope", async () => {
      const origFetch = global.fetch;
      try {
        global.fetch = (async () => ({
          ok: true,
          json: async () => [
            {
              org_phone: "237652474378@c.us",
              phone_id: "phone-gpyjlndjmsqsobrh",
              phone_name: "Safari",
              wa_state: "CONNECTED",
              is_ready: true,
            },
          ],
        })) as any;

        const phones = await adapter.listConnectedPhones({ apiKey: "prsk_test" });
        expect(phones).toHaveLength(1);
        expect(phones[0].phone).toBe("237652474378");
        expect(phones[0].phoneName).toBe("Safari");
        expect(phones[0].status).toBe("CONNECTED");
        expect(phones[0].isReady).toBe(true);
      } finally {
        global.fetch = origFetch;
      }
    });
  });
});

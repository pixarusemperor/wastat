/**
 * Phone number and WhatsApp addressing utilities.
 * Ensures consistent canonicalization across Wasender and Periskope providers.
 */

/**
 * Normalizes an arbitrary phone number or JID string into canonical form:
 * - Group JIDs (ending with '@g.us') are trimmed and preserved.
 * - 1-on-1 contact numbers are stripped of non-digits (e.g. '+1 (555) 234-5678' -> '15552345678').
 */
export function normalizePhoneNumber(input: string): string {
  if (!input) return "";
  const trimmed = input.trim();
  if (trimmed.endsWith("@g.us")) {
    return trimmed;
  }
  // Strip '@c.us' or '@s.whatsapp.net' suffix before stripping non-digits
  const cleanSuffix = trimmed.replace(/@(c\.us|s\.whatsapp\.net)$/, "");
  return cleanSuffix.replace(/\D/g, "");
}

/**
 * Formats a phone number or JID for Periskope REST API:
 * - `chat_id`: strictly requires '[digits]@c.us' for private chats, or '[groupId]@g.us' for groups.
 * - `x-phone`: strictly requires clean country code + phone digits (no '+', no '@c.us').
 */
export function formatPeriskopeChatId(phoneOrJid: string): {
  chatId: string;
  isGroup: boolean;
  phone: string;
} {
  const trimmed = (phoneOrJid || "").trim();
  if (trimmed.endsWith("@g.us")) {
    return {
      chatId: trimmed,
      isGroup: true,
      phone: trimmed,
    };
  }

  const digits = normalizePhoneNumber(trimmed);
  return {
    chatId: `${digits}@c.us`,
    isGroup: false,
    phone: digits,
  };
}

/**
 * Formats a phone number or JID for Wasender API:
 * Accepts clean digits or group JIDs.
 */
export function formatWasenderTo(phoneOrJid: string): string {
  const trimmed = (phoneOrJid || "").trim();
  if (trimmed.endsWith("@g.us")) {
    return trimmed;
  }
  return normalizePhoneNumber(trimmed);
}

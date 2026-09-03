import { describe, it, expect } from "vitest";
import { normalizePhoneNumber, formatPeriskopeChatId, formatWasenderTo } from "./phone.js";

describe("phone addressing & canonicalization", () => {
  it("normalizes phone numbers with international prefixes, dashes, spaces, and brackets", () => {
    expect(normalizePhoneNumber("+1 (555) 234-5678")).toBe("15552345678");
    expect(normalizePhoneNumber("+91 98765-43210")).toBe("919876543210");
    expect(normalizePhoneNumber("919876543210@c.us")).toBe("919876543210");
    expect(normalizePhoneNumber("15552345678@s.whatsapp.net")).toBe("15552345678");
  });

  it("preserves group JIDs intact", () => {
    const groupJid = "120363028347192834@g.us";
    expect(normalizePhoneNumber(groupJid)).toBe(groupJid);
    expect(formatPeriskopeChatId(groupJid)).toEqual({
      chatId: groupJid,
      isGroup: true,
      phone: groupJid,
    });
    expect(formatWasenderTo(groupJid)).toBe(groupJid);
  });

  it("formats 1-on-1 chats for Periskope strictly as [digits]@c.us and digits for x-phone", () => {
    const res = formatPeriskopeChatId("+91 98765-43210");
    expect(res).toEqual({
      chatId: "919876543210@c.us",
      isGroup: false,
      phone: "919876543210",
    });
  });

  it("formats toPhone for Wasender as clean digits", () => {
    expect(formatWasenderTo("+237 676 63 78 53")).toBe("237676637853");
  });
});

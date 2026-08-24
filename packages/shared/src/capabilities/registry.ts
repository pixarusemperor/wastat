/**
 * Wasender API Capability Registry (PRD §5–7).
 * Single Source of Truth for all supported triggers and actions in Wasender.
 */

export interface ProviderTriggerDef {
  id: string;
  name: string;
  category: "message" | "group" | "call" | "contact" | "session";
  description: string;
  event: string;
  icon: string;
  badgeColor: string;
  payloadKeys: string[];
}

export interface ProviderActionDef {
  id: string;
  name: string;
  category: "messaging" | "contact" | "group" | "presence" | "flow";
  description: string;
  icon: string;
  badgeColor: string;
  endpoint: { method: "POST" | "GET" | "PUT" | "DELETE"; path: string };
}

export const WASENDER_TRIGGERS: ProviderTriggerDef[] = [
  {
    id: "trigger_message",
    name: "Message Received (Any)",
    category: "message",
    description: "Fires on any incoming WhatsApp message (private or group).",
    event: "messages.received",
    icon: "⚡",
    badgeColor: "#10b981",
    payloadKeys: ["key.id", "key.remoteJid", "messageBody", "pushName", "messageType"],
  },
  {
    id: "trigger_personal",
    name: "Direct Message Received",
    category: "message",
    description: "Fires only on private 1-on-1 direct messages.",
    event: "messages-personal.received",
    icon: "💬",
    badgeColor: "#059669",
    payloadKeys: ["key.id", "key.remoteJid", "messageBody", "pushName"],
  },
  {
    id: "trigger_group",
    name: "Group Message Received",
    category: "group",
    description: "Fires on messages received in group chats.",
    event: "messages-group.received",
    icon: "👥",
    badgeColor: "#0891b2",
    payloadKeys: ["key.id", "key.remoteJid", "key.participant", "messageBody"],
  },
  {
    id: "trigger_reaction",
    name: "Message Reaction",
    category: "message",
    description: "Fires when a contact reacts to a message with an emoji.",
    event: "messages.reaction",
    icon: "👍",
    badgeColor: "#f59e0b",
    payloadKeys: ["reaction.text", "reaction.key.id", "key.remoteJid"],
  },
  {
    id: "trigger_poll_result",
    name: "Poll Vote Cast",
    category: "message",
    description: "Fires when a user votes in a WhatsApp poll.",
    event: "poll.results",
    icon: "📊",
    badgeColor: "#8b5cf6",
    payloadKeys: ["pollKey", "selectedOptions", "voterJid"],
  },
  {
    id: "trigger_call",
    name: "Incoming Call",
    category: "call",
    description: "Fires on incoming voice or video WhatsApp calls.",
    event: "call",
    icon: "📞",
    badgeColor: "#ef4444",
    payloadKeys: ["callId", "from", "isVideo", "status"],
  },
  {
    id: "trigger_participant",
    name: "Group Member Event",
    category: "group",
    description: "Fires when participants join, leave, or are promoted/demoted.",
    event: "group-participants.update",
    icon: "🚪",
    badgeColor: "#6366f1",
    payloadKeys: ["groupJid", "action", "participants"],
  },
];

export const WASENDER_ACTIONS: ProviderActionDef[] = [
  // Messaging
  {
    id: "send_text",
    name: "Send Text Message",
    category: "messaging",
    description: "Send plain or formatted text message with variable interpolation.",
    icon: "💬",
    badgeColor: "#3b82f6",
    endpoint: { method: "POST", path: "/api/send-message" },
  },
  {
    id: "send_media",
    name: "Send Media File",
    category: "messaging",
    description: "Send image, video, audio, voice note, or document.",
    icon: "🖼️",
    badgeColor: "#8b5cf6",
    endpoint: { method: "POST", path: "/api/send-message" },
  },
  {
    id: "send_menu",
    name: "Send Menu (Numbered Options)",
    category: "messaging",
    description: "Send a numbered interactive WhatsApp text menu with branching handles.",
    icon: "📋",
    badgeColor: "#f59e0b",
    endpoint: { method: "POST", path: "/api/send-message" },
  },
  {
    id: "send_poll",
    name: "Send WhatsApp Native Poll",
    category: "messaging",
    description: "Send an interactive WhatsApp poll with selectable options.",
    icon: "📊",
    badgeColor: "#10b981",
    endpoint: { method: "POST", path: "/api/send-message" },
  },
  {
    id: "send_contact",
    name: "Send Contact Card",
    category: "messaging",
    description: "Send a contact vCard card to the user.",
    icon: "📇",
    badgeColor: "#06b6d4",
    endpoint: { method: "POST", path: "/api/send-message" },
  },
  {
    id: "send_location",
    name: "Send Location Pin",
    category: "messaging",
    description: "Send GPS coordinates, location name, and address.",
    icon: "📍",
    badgeColor: "#ec4899",
    endpoint: { method: "POST", path: "/api/send-message" },
  },
  {
    id: "send_presence",
    name: "Send Presence (Typing / Recording)",
    category: "presence",
    description: "Emulate human presence (typing or recording audio) before replies.",
    icon: "⌨️",
    badgeColor: "#14b8a6",
    endpoint: { method: "POST", path: "/api/send-presence-update" },
  },
  {
    id: "mark_read",
    name: "Mark Message as Read",
    category: "messaging",
    description: "Trigger WhatsApp blue checkmarks on the incoming message.",
    icon: "✓✓",
    badgeColor: "#3b82f6",
    endpoint: { method: "POST", path: "/api/messages/read" },
  },
  {
    id: "react_message",
    name: "React to Message",
    category: "messaging",
    description: "React to the received message with an emoji.",
    icon: "❤️",
    badgeColor: "#f43f5e",
    endpoint: { method: "POST", path: "/api/send-message" },
  },

  // Contact & Groups
  {
    id: "upsert_contact",
    name: "Save / Update Contact",
    category: "contact",
    description: "Save or update name and details in WhatsApp address book.",
    icon: "👤",
    badgeColor: "#0284c7",
    endpoint: { method: "PUT", path: "/api/contacts" },
  },
  {
    id: "block_contact",
    name: "Block Contact",
    category: "contact",
    description: "Block the user on WhatsApp.",
    icon: "🚫",
    badgeColor: "#dc2626",
    endpoint: { method: "POST", path: "/api/contacts/{phone}/block" },
  },
  {
    id: "unblock_contact",
    name: "Unblock Contact",
    category: "contact",
    description: "Unblock a previously blocked contact.",
    icon: "🔓",
    badgeColor: "#16a34a",
    endpoint: { method: "POST", path: "/api/contacts/{phone}/unblock" },
  },
  {
    id: "add_group_participant",
    name: "Add Group Participant",
    category: "group",
    description: "Add user to a designated WhatsApp group.",
    icon: "➕",
    badgeColor: "#4f46e5",
    endpoint: { method: "POST", path: "/api/groups/{groupJid}/participants/add" },
  },
  {
    id: "remove_group_participant",
    name: "Remove Group Participant",
    category: "group",
    description: "Remove user from a WhatsApp group.",
    icon: "➖",
    badgeColor: "#b91c1c",
    endpoint: { method: "POST", path: "/api/groups/{groupJid}/participants/remove" },
  },

  // Flow Logic
  {
    id: "collect_input",
    name: "Collect Input (Variable)",
    category: "flow",
    description: "Prompt user for text/number/choice and save reply into variable.",
    icon: "✍️",
    badgeColor: "#14b8a6",
    endpoint: { method: "POST", path: "/flow/collect" },
  },
  {
    id: "condition",
    name: "Condition (If / Else)",
    category: "flow",
    description: "Branch execution based on variables, text, or profile fields.",
    icon: "🔀",
    badgeColor: "#ea580c",
    endpoint: { method: "POST", path: "/flow/condition" },
  },
  {
    id: "split_test",
    name: "A/B Split Test",
    category: "flow",
    description: "Distribute traffic across weighted variants.",
    icon: "🎲",
    badgeColor: "#4f46e5",
    endpoint: { method: "POST", path: "/flow/split" },
  },
  {
    id: "delay",
    name: "Delay / Wait",
    category: "flow",
    description: "Wait fixed duration or randomized anti-ban jitter.",
    icon: "⏳",
    badgeColor: "#ca8a04",
    endpoint: { method: "POST", path: "/flow/delay" },
  },
  {
    id: "end",
    name: "End Flow",
    category: "flow",
    description: "Gracefully complete workflow execution.",
    icon: "🏁",
    badgeColor: "#475569",
    endpoint: { method: "POST", path: "/flow/end" },
  },
];

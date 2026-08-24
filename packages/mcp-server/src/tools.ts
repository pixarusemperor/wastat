import { z } from "zod";

export const TOOL_DEFINITIONS = [
  {
    name: "wastat_get_system_summary",
    description: "Returns high-level WaStat health summary: connected companion sessions, active funnel contacts, queue status, and 2-hour reply rate.",
    inputSchema: {
      type: "object",
      properties: {},
      required: [],
    },
  },
  {
    name: "wastat_list_stuck_leads",
    description: "Returns leads currently in objection_review or waiting_input past their 2-hour attribution window that require human operator intervention.",
    inputSchema: {
      type: "object",
      properties: {
        limit: { type: "number", description: "Maximum number of leads to return (default: 20)" },
      },
    },
  },
  {
    name: "wastat_send_operator_reply",
    description: "Sends a manual WhatsApp reply to a lead from the companion session and pauses automated bot timers for 24 hours (Human Takeover).",
    inputSchema: {
      type: "object",
      properties: {
        contactId: { type: "number", description: "ID of the contact to message" },
        text: { type: "string", description: "Text content of the message" },
      },
      required: ["contactId", "text"],
    },
  },
  {
    name: "wastat_advance_to_phase_2",
    description: "1-Click advances a qualified lead to Phase 2 (Closing, personalized proposal, payment invoice) and resumes automated flow.",
    inputSchema: {
      type: "object",
      properties: {
        contactId: { type: "number", description: "ID of the contact to advance" },
        notes: { type: "string", description: "Optional transition notes for the CRM audit log" },
      },
      required: ["contactId"],
    },
  },
  {
    name: "wastat_create_private_note",
    description: "Appends an internal team note to a contact conversation thread (never sent to the customer on WhatsApp).",
    inputSchema: {
      type: "object",
      properties: {
        contactId: { type: "number", description: "ID of the contact" },
        body: { type: "string", description: "Internal note body text" },
        author: { type: "string", description: "Author name (e.g. 'operator' or 'buzz-copilot')" },
      },
      required: ["contactId", "body"],
    },
  },
] as const;

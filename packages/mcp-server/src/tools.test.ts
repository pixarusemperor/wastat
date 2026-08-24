import { describe, it, expect } from "vitest";
import { TOOL_DEFINITIONS } from "./tools.js";

describe("WaStat MCP Tool Definitions", () => {
  it("defines all essential tools for Block Buzz and Antigravity CLI", () => {
    const toolNames = TOOL_DEFINITIONS.map((t) => t.name);
    expect(toolNames).toContain("wastat_get_system_summary");
    expect(toolNames).toContain("wastat_list_stuck_leads");
    expect(toolNames).toContain("wastat_send_operator_reply");
    expect(toolNames).toContain("wastat_advance_to_phase_2");
    expect(toolNames).toContain("wastat_create_private_note");
  });

  it("validates required input schemas", () => {
    const replyTool = TOOL_DEFINITIONS.find((t) => t.name === "wastat_send_operator_reply");
    expect(replyTool?.inputSchema.required).toEqual(["contactId", "text"]);

    const advanceTool = TOOL_DEFINITIONS.find((t) => t.name === "wastat_advance_to_phase_2");
    expect(advanceTool?.inputSchema.required).toEqual(["contactId"]);
  });
});

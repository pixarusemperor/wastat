import { describe, it, expect } from "vitest";
import { validateWorkflowGraph } from "./validation.js";

describe("validateWorkflowGraph", () => {
  it("passes for a valid multimedia workflow graph", () => {
    const res = validateWorkflowGraph({
      nodes: [
        {
          nodeKey: "trig_1",
          type: "trigger",
          config: { keywords: ["safari", "vip"] },
          positionX: 0,
          positionY: 0,
        },
        {
          nodeKey: "text_1",
          type: "send_text",
          config: { text: "Hello VIP guest!" },
          positionX: 200,
          positionY: 0,
        },
        {
          nodeKey: "media_1",
          type: "send_media",
          config: { mediaUrl: "https://example.com/villa.jpg", caption: "Sunset Villa" },
          positionX: 400,
          positionY: 0,
        },
      ],
      edges: [
        { sourceKey: "trig_1", targetKey: "text_1" },
        { sourceKey: "text_1", targetKey: "media_1" },
      ],
    });

    expect(res.ok).toBe(true);
    expect(res.errors).toHaveLength(0);
  });

  it("fails when missing a trigger node", () => {
    const res = validateWorkflowGraph({
      nodes: [
        {
          nodeKey: "text_1",
          type: "send_text",
          config: { text: "Hello!" },
          positionX: 0,
          positionY: 0,
        },
      ],
      edges: [],
    });

    expect(res.ok).toBe(false);
    expect(res.errors.some((e) => e.message.includes("trigger node"))).toBe(true);
  });

  it("fails when send_text has empty text", () => {
    const res = validateWorkflowGraph({
      nodes: [
        {
          nodeKey: "trig_1",
          type: "trigger",
          config: { keywords: ["hi"] },
          positionX: 0,
          positionY: 0,
        },
        {
          nodeKey: "text_1",
          type: "send_text",
          config: { text: "" },
          positionX: 200,
          positionY: 0,
        },
      ],
      edges: [{ sourceKey: "trig_1", targetKey: "text_1" }],
    });

    expect(res.ok).toBe(false);
    expect(res.errors.some((e) => e.field === "text")).toBe(true);
  });

  it("fails when edge references non-existent node", () => {
    const res = validateWorkflowGraph({
      nodes: [
        {
          nodeKey: "trig_1",
          type: "trigger",
          config: { keywords: ["hi"] },
          positionX: 0,
          positionY: 0,
        },
      ],
      edges: [{ sourceKey: "trig_1", targetKey: "non_existent_node" }],
    });

    expect(res.ok).toBe(false);
    expect(res.errors.some((e) => e.message.includes("non_existent_node"))).toBe(true);
  });
});

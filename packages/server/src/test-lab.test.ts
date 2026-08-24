import { describe, it, expect, beforeEach } from "vitest";
import Database from "better-sqlite3";
import { readFileSync } from "node:fs";
import { SCENARIO_CATALOG, runVirtualScenario } from "./test-lab.js";
import { createLocalStorage } from "./media.js";

describe("Phase 1: Virtual Edge Case Scenarios Test Suite", () => {
  let db: Database.Database;
  const storage = createLocalStorage("/tmp/wastat-unit-test-media");

  beforeEach(() => {
    db = new Database(":memory:");
    db.exec(readFileSync(new URL("./db/schema.sql", import.meta.url), "utf8"));
  });

  it("lists all 10 edge case scenarios in catalog", () => {
    expect(SCENARIO_CATALOG).toHaveLength(10);
    expect(SCENARIO_CATALOG.map((s) => s.id)).toContain("text_spintax_vars");
    expect(SCENARIO_CATALOG.map((s) => s.id)).toContain("image_media_caption");
    expect(SCENARIO_CATALOG.map((s) => s.id)).toContain("video_media_streaming");
    expect(SCENARIO_CATALOG.map((s) => s.id)).toContain("audio_voice_note");
    expect(SCENARIO_CATALOG.map((s) => s.id)).toContain("document_pdf_attachment");
    expect(SCENARIO_CATALOG.map((s) => s.id)).toContain("interactive_menu_branching");
    expect(SCENARIO_CATALOG.map((s) => s.id)).toContain("condition_logic_split");
    expect(SCENARIO_CATALOG.map((s) => s.id)).toContain("silence_sweeper_2h");
    expect(SCENARIO_CATALOG.map((s) => s.id)).toContain("human_takeover_24h");
    expect(SCENARIO_CATALOG.map((s) => s.id)).toContain("dual_instance_live_e2e");
  });

  it("Scenario 1: Text, Spintax & Variable Interpolation passes virtually", async () => {
    const res = await runVirtualScenario(db, "text_spintax_vars", storage);
    expect(res.status).toBe("passed");
    expect(res.error).toBeUndefined();
  });

  it("Scenario 2: Image Media & Caption passes virtually", async () => {
    const res = await runVirtualScenario(db, "image_media_caption", storage);
    expect(res.status).toBe("passed");
    expect(res.metrics?.mediaMimeType).toBe("image/png");
  });

  it("Scenario 3: MP4 Video Streaming passes virtually", async () => {
    const res = await runVirtualScenario(db, "video_media_streaming", storage);
    expect(res.status).toBe("passed");
    expect(res.metrics?.mediaMimeType).toBe("video/mp4");
  });

  it("Scenario 4: Audio Voice Note with Recording Presence passes virtually", async () => {
    const res = await runVirtualScenario(db, "audio_voice_note", storage);
    expect(res.status).toBe("passed");
    expect(res.metrics?.presenceType).toBe("recording");
  });

  it("Scenario 5: Document & PDF Attachment passes virtually", async () => {
    const res = await runVirtualScenario(db, "document_pdf_attachment", storage);
    expect(res.status).toBe("passed");
    expect(res.metrics?.mediaMimeType).toBe("application/pdf");
  });

  it("Scenario 6: Interactive Menu Branching passes virtually", async () => {
    const res = await runVirtualScenario(db, "interactive_menu_branching", storage);
    if (res.status !== "passed") console.error("Scenario 6 failed:", res.error, res.logs);
    expect(res.status).toBe("passed");
  });

  it("Scenario 7: Condition Logic Split passes virtually", async () => {
    const res = await runVirtualScenario(db, "condition_logic_split", storage);
    if (res.status !== "passed") console.error("Scenario 7 failed:", res.error, res.logs);
    expect(res.status).toBe("passed");
  });

  it("Scenario 8: 2-Hour Silence Followup Sweeper passes virtually", async () => {
    const res = await runVirtualScenario(db, "silence_sweeper_2h", storage);
    if (res.status !== "passed") console.error("Scenario 8 failed:", res.error, res.logs);
    expect(res.status).toBe("passed");
  });

  it("Scenario 9: 24-Hour Operator Human Takeover Guard passes virtually", async () => {
    const res = await runVirtualScenario(db, "human_takeover_24h", storage);
    if (res.status !== "passed") console.error("Scenario 9 failed:", res.error, res.logs);
    expect(res.status).toBe("passed");
  });
});

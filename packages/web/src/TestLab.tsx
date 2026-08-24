import React, { useEffect, useState } from "react";
import { api, type SessionItem, type TestScenario, type TestScenarioResult } from "./api.js";

export function TestLab() {
  const [scenarios, setScenarios] = useState<TestScenario[]>([]);
  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [mode, setMode] = useState<"virtual" | "live">("virtual");
  const [loading, setLoading] = useState(true);
  const [runningId, setRunningId] = useState<string | null>(null);
  const [runningAll, setRunningAll] = useState(false);
  const [results, setResults] = useState<Record<string, TestScenarioResult>>({});
  const [selectedResult, setSelectedResult] = useState<TestScenarioResult | null>(null);

  // Live dual-instance configuration
  const [senderSessionId, setSenderSessionId] = useState<number | "">("");
  const [receiverPhone, setReceiverPhone] = useState<string>("");
  const [customMessage, setCustomMessage] = useState<string>("");

  useEffect(() => {
    Promise.all([
      api.getTestScenarios().then((r) => setScenarios(r.scenarios)).catch(() => []),
      api.listSessions().then((s) => {
        setSessions(s);
        if (s.length > 0) setSenderSessionId(s[0].id);
      }).catch(() => []),
    ]).finally(() => setLoading(false));
  }, []);

  const handleRunScenario = async (scenario: TestScenario) => {
    setRunningId(scenario.id);
    try {
      const res = await api.runTestScenario({
        scenarioId: scenario.id,
        mode,
        senderSessionId: senderSessionId ? Number(senderSessionId) : undefined,
        receiverPhone: receiverPhone || undefined,
        messageText: customMessage || undefined,
      });
      setResults((prev) => ({ ...prev, [scenario.id]: res }));
      setSelectedResult(res);
    } catch (err: any) {
      const failedRes: TestScenarioResult = {
        scenarioId: scenario.id,
        name: scenario.name,
        status: "failed",
        mode,
        durationMs: 0,
        logs: [`[Error] API call failed: ${err.message || String(err)}`],
        error: err.message || String(err),
      };
      setResults((prev) => ({ ...prev, [scenario.id]: failedRes }));
      setSelectedResult(failedRes);
    } finally {
      setRunningId(null);
    }
  };

  const handleRunAll = async () => {
    setRunningAll(true);
    try {
      const res = await api.runAllTestScenarios();
      const newResults: Record<string, TestScenarioResult> = {};
      for (const r of res.results) {
        newResults[r.scenarioId] = r;
      }
      setResults(newResults);
      if (res.results.length > 0) {
        setSelectedResult(res.results[0]);
      }
    } catch (err: any) {
      console.error("Run all failed:", err);
    } finally {
      setRunningAll(false);
    }
  };

  const categories = [
    { key: "media", label: "Media & Attachments Suite", icon: "🖼️" },
    { key: "logic", label: "Workflow Logic & Spintax", icon: "🔀" },
    { key: "timing", label: "Timing & 2h Sweeper", icon: "⏱️" },
    { key: "safety", label: "Human Takeover & Safety", icon: "🛡️" },
    { key: "dual_instance", label: "Dual-Instance Live Testing", icon: "📱" },
  ];

  return (
    <div style={{ padding: "28px", maxWidth: "1280px", margin: "0 auto", color: "#e2e8f0" }}>
      {/* Header Banner */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: "24px",
          gap: "16px",
          flexWrap: "wrap",
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "6px" }}>
            <span style={{ fontSize: "28px" }}>🧪</span>
            <h1 style={{ margin: 0, fontSize: "24px", fontWeight: 700, letterSpacing: "-0.5px" }}>
              Edge Case & Dual-Instance Test Lab
            </h1>
            <span
              style={{
                fontSize: "11px",
                fontWeight: 600,
                padding: "2px 8px",
                borderRadius: "12px",
                backgroundColor: mode === "virtual" ? "rgba(59, 130, 246, 0.2)" : "rgba(16, 185, 129, 0.2)",
                color: mode === "virtual" ? "#60a5fa" : "#34d399",
                border: `1px solid ${mode === "virtual" ? "rgba(59, 130, 246, 0.3)" : "rgba(16, 185, 129, 0.3)"}`,
              }}
            >
              {mode === "virtual" ? "Virtual Simulator (Offline)" : "Live WhatsApp Device-to-Device"}
            </span>
          </div>
          <p style={{ margin: 0, fontSize: "14px", color: "#94a3b8" }}>
            Stress test WhatsApp automations, media delivery (video/image/audio/PDF), spintax interpolation, anti-ban timing, and dual-number orchestration.
          </p>
        </div>

        {/* Mode Selector & Batch Action */}
        <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
          <div
            style={{
              display: "flex",
              backgroundColor: "#1e293b",
              borderRadius: "8px",
              padding: "3px",
              border: "1px solid #334155",
            }}
          >
            <button
              onClick={() => setMode("virtual")}
              style={{
                padding: "6px 14px",
                borderRadius: "6px",
                fontSize: "13px",
                fontWeight: 600,
                border: "none",
                cursor: "pointer",
                backgroundColor: mode === "virtual" ? "#2563eb" : "transparent",
                color: mode === "virtual" ? "#ffffff" : "#94a3b8",
                transition: "all 0.15s ease",
              }}
            >
              🔬 Virtual Simulator
            </button>
            <button
              onClick={() => setMode("live")}
              style={{
                padding: "6px 14px",
                borderRadius: "6px",
                fontSize: "13px",
                fontWeight: 600,
                border: "none",
                cursor: "pointer",
                backgroundColor: mode === "live" ? "#059669" : "transparent",
                color: mode === "live" ? "#ffffff" : "#94a3b8",
                transition: "all 0.15s ease",
              }}
            >
              📱 Real Numbers Lab
            </button>
          </div>

          {mode === "virtual" && (
            <button
              onClick={handleRunAll}
              disabled={runningAll || runningId !== null}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                backgroundColor: "#2563eb",
                color: "#ffffff",
                border: "none",
                borderRadius: "8px",
                padding: "8px 18px",
                fontSize: "13px",
                fontWeight: 600,
                cursor: runningAll ? "not-allowed" : "pointer",
                opacity: runningAll ? 0.7 : 1,
                boxShadow: "0 2px 4px rgba(37, 99, 235, 0.3)",
              }}
            >
              {runningAll ? "⏳ Running All..." : "⚡ Run All Virtual (Zero Risk)"}
            </button>
          )}
        </div>
      </div>

      {/* Live Dual-Instance Config Card */}
      {mode === "live" && (
        <div
          style={{
            backgroundColor: "#0f172a",
            border: "1px solid #334155",
            borderRadius: "12px",
            padding: "20px",
            marginBottom: "24px",
            boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "14px" }}>
            <span style={{ fontSize: "18px" }}>📱</span>
            <h3 style={{ margin: 0, fontSize: "15px", fontWeight: 600, color: "#f8fafc" }}>
              Live Dual-Instance WhatsApp Configuration
            </h3>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "16px" }}>
            <div>
              <label style={{ display: "block", fontSize: "12px", color: "#94a3b8", marginBottom: "6px" }}>
                Session A (Tester Sender)
              </label>
              <select
                value={senderSessionId}
                onChange={(e) => setSenderSessionId(Number(e.target.value))}
                style={{
                  width: "100%",
                  backgroundColor: "#1e293b",
                  border: "1px solid #475569",
                  color: "#f8fafc",
                  padding: "8px 12px",
                  borderRadius: "6px",
                  fontSize: "13px",
                }}
              >
                {sessions.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.status})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: "block", fontSize: "12px", color: "#94a3b8", marginBottom: "6px" }}>
                Session B (Receiver WhatsApp Phone)
              </label>
              <input
                type="text"
                placeholder="+33612345678"
                value={receiverPhone}
                onChange={(e) => setReceiverPhone(e.target.value)}
                style={{
                  width: "100%",
                  backgroundColor: "#1e293b",
                  border: "1px solid #475569",
                  color: "#f8fafc",
                  padding: "8px 12px",
                  borderRadius: "6px",
                  fontSize: "13px",
                }}
              />
            </div>

            <div>
              <label style={{ display: "block", fontSize: "12px", color: "#94a3b8", marginBottom: "6px" }}>
                Custom Diagnostic Test Message
              </label>
              <input
                type="text"
                placeholder="Optional custom trigger text"
                value={customMessage}
                onChange={(e) => setCustomMessage(e.target.value)}
                style={{
                  width: "100%",
                  backgroundColor: "#1e293b",
                  border: "1px solid #475569",
                  color: "#f8fafc",
                  padding: "8px 12px",
                  borderRadius: "6px",
                  fontSize: "13px",
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Main Grid: Scenarios + Diagnostic Inspector */}
      <div style={{ display: "grid", gridTemplateColumns: "1.2fr 0.8fr", gap: "24px" }}>
        {/* Left Column: Categorized Scenario Catalog */}
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          {categories.map((cat) => {
            const catScenarios = scenarios.filter((s) => s.category === cat.key);
            if (catScenarios.length === 0) return null;

            return (
              <div
                key={cat.key}
                style={{
                  backgroundColor: "#0f172a",
                  border: "1px solid #1e293b",
                  borderRadius: "12px",
                  padding: "18px",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "14px" }}>
                  <span>{cat.icon}</span>
                  <h2 style={{ margin: 0, fontSize: "15px", fontWeight: 600, color: "#cbd5e1" }}>
                    {cat.label}
                  </h2>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  {catScenarios.map((sc) => {
                    const result = results[sc.id];
                    const isRunning = runningId === sc.id;
                    const isDisabled = mode === "virtual" && !sc.supportsVirtual;

                    return (
                      <div
                        key={sc.id}
                        onClick={() => result && setSelectedResult(result)}
                        style={{
                          backgroundColor: selectedResult?.scenarioId === sc.id ? "#1e293b" : "#131d31",
                          border: `1px solid ${
                            selectedResult?.scenarioId === sc.id
                              ? "#3b82f6"
                              : result?.status === "passed"
                              ? "rgba(16, 185, 129, 0.3)"
                              : result?.status === "failed"
                              ? "rgba(239, 68, 68, 0.3)"
                              : "#1e293b"
                          }`,
                          borderRadius: "8px",
                          padding: "14px",
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          cursor: result ? "pointer" : "default",
                          transition: "all 0.15s ease",
                        }}
                      >
                        <div style={{ flex: 1, paddingRight: "16px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                            <span style={{ fontSize: "14px", fontWeight: 600, color: "#f1f5f9" }}>
                              {sc.name}
                            </span>
                            {result && (
                              <span
                                style={{
                                  fontSize: "11px",
                                  fontWeight: 700,
                                  padding: "2px 6px",
                                  borderRadius: "4px",
                                  backgroundColor:
                                    result.status === "passed" ? "rgba(16, 185, 129, 0.2)" : "rgba(239, 68, 68, 0.2)",
                                  color: result.status === "passed" ? "#34d399" : "#f87171",
                                }}
                              >
                                {result.status === "passed" ? "✓ PASSED" : "✕ FAILED"}
                              </span>
                            )}
                          </div>
                          <p style={{ margin: 0, fontSize: "12px", color: "#64748b", lineHeight: 1.4 }}>
                            {sc.description}
                          </p>
                        </div>

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRunScenario(sc);
                          }}
                          disabled={isRunning || runningAll || isDisabled}
                          style={{
                            backgroundColor: isRunning ? "#475569" : "#2563eb",
                            color: "#ffffff",
                            border: "none",
                            borderRadius: "6px",
                            padding: "6px 14px",
                            fontSize: "12px",
                            fontWeight: 600,
                            cursor: isRunning || isDisabled ? "not-allowed" : "pointer",
                            opacity: isDisabled ? 0.4 : 1,
                            whiteSpace: "nowrap",
                          }}
                        >
                          {isRunning ? "⏳ Testing..." : "▶ Run Test"}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Right Column: Detailed Diagnostic Inspector & Log Viewer */}
        <div>
          <div
            style={{
              backgroundColor: "#0f172a",
              border: "1px solid #1e293b",
              borderRadius: "12px",
              padding: "20px",
              position: "sticky",
              top: "20px",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ fontSize: "18px" }}>🔍</span>
                <h3 style={{ margin: 0, fontSize: "15px", fontWeight: 600, color: "#f8fafc" }}>
                  Diagnostic Execution Trace
                </h3>
              </div>
              {selectedResult && (
                <span
                  style={{
                    fontSize: "12px",
                    fontWeight: 600,
                    color: selectedResult.status === "passed" ? "#34d399" : "#f87171",
                  }}
                >
                  {selectedResult.durationMs}ms
                </span>
              )}
            </div>

            {selectedResult ? (
              <div>
                {/* Result Summary Box */}
                <div
                  style={{
                    backgroundColor:
                      selectedResult.status === "passed" ? "rgba(16, 185, 129, 0.1)" : "rgba(239, 68, 68, 0.1)",
                    border: `1px solid ${
                      selectedResult.status === "passed" ? "rgba(16, 185, 129, 0.3)" : "rgba(239, 68, 68, 0.3)"
                    }`,
                    borderRadius: "8px",
                    padding: "12px",
                    marginBottom: "16px",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
                    <span style={{ fontWeight: 600, fontSize: "13px", color: "#f8fafc" }}>
                      {selectedResult.name}
                    </span>
                    <span
                      style={{
                        fontSize: "11px",
                        fontWeight: 700,
                        color: selectedResult.status === "passed" ? "#34d399" : "#f87171",
                      }}
                    >
                      {selectedResult.status.toUpperCase()} ({selectedResult.mode})
                    </span>
                  </div>

                  {selectedResult.metrics && (
                    <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", fontSize: "11px", color: "#cbd5e1", marginTop: "8px" }}>
                      {selectedResult.metrics.dispatchedKind && (
                        <span>Type: <b>{selectedResult.metrics.dispatchedKind}</b></span>
                      )}
                      {selectedResult.metrics.mediaMimeType && (
                        <span>Mime: <b>{selectedResult.metrics.mediaMimeType}</b></span>
                      )}
                      {selectedResult.metrics.presenceType && (
                        <span>Presence: <b>{selectedResult.metrics.presenceType}</b></span>
                      )}
                    </div>
                  )}

                  {selectedResult.executionId && (
                    <div style={{ marginTop: "8px" }}>
                      <a
                        href={`#/executions`}
                        style={{ fontSize: "12px", color: "#60a5fa", textDecoration: "none", fontWeight: 600 }}
                      >
                        👉 View Full Trace in Executions Drawer (ID #{selectedResult.executionId})
                      </a>
                    </div>
                  )}
                </div>

                {/* Error Banner */}
                {selectedResult.error && (
                  <div
                    style={{
                      backgroundColor: "rgba(239, 68, 68, 0.15)",
                      border: "1px solid #ef4444",
                      borderRadius: "6px",
                      padding: "10px",
                      marginBottom: "16px",
                      fontSize: "12px",
                      color: "#fca5a5",
                    }}
                  >
                    <b>Error:</b> {selectedResult.error}
                  </div>
                )}

                {/* Console Logs */}
                <div style={{ marginBottom: "12px" }}>
                  <span style={{ fontSize: "12px", fontWeight: 600, color: "#94a3b8" }}>
                    Execution Step Logs:
                  </span>
                  <div
                    style={{
                      backgroundColor: "#020617",
                      border: "1px solid #1e293b",
                      borderRadius: "6px",
                      padding: "12px",
                      marginTop: "6px",
                      fontFamily: "monospace",
                      fontSize: "12px",
                      maxHeight: "260px",
                      overflowY: "auto",
                      display: "flex",
                      flexDirection: "column",
                      gap: "4px",
                    }}
                  >
                    {selectedResult.logs.map((log, idx) => (
                      <div
                        key={idx}
                        style={{
                          color: log.startsWith("[Error]")
                            ? "#f87171"
                            : log.startsWith("[Dispatch]")
                            ? "#60a5fa"
                            : log.startsWith("[Sweeper]")
                            ? "#fbbf24"
                            : "#94a3b8",
                        }}
                      >
                        {log}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ textAlign: "center", padding: "40px 20px", color: "#64748b" }}>
                <span style={{ fontSize: "36px", display: "block", marginBottom: "12px" }}>⚡</span>
                <p style={{ margin: 0, fontSize: "13px" }}>
                  Select or run any scenario to inspect step-level execution logs, anti-ban delays, and media delivery.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

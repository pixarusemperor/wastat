import { useEffect, useState, useCallback } from "react";
import type { WorkflowExecutionSummary, ExecutionEventLog, ExecutionSummaryStats } from "@wastat/shared";

interface SessionOption {
  id: number;
  name: string;
  providerSessionId: string;
  status: string;
}

interface WorkflowOption {
  id: number;
  name: string;
}

interface ExecutionDetail extends WorkflowExecutionSummary {
  events?: ExecutionEventLog[];
  silenceFollowupAt?: string | null;
}

export function ExecutionsPage({ initialExecutionId }: { initialExecutionId?: string | null }) {
  const [executions, setExecutions] = useState<WorkflowExecutionSummary[]>([]);
  const [summary, setSummary] = useState<ExecutionSummaryStats>({
    total: 0,
    running: 0,
    waiting: 0,
    waitingInput: 0,
    completed: 0,
    failed: 0,
    pausedHuman: 0,
  });
  const [sessions, setSessions] = useState<SessionOption[]>([]);
  const [workflows, setWorkflows] = useState<WorkflowOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Filter States
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [sessionFilter, setSessionFilter] = useState<string>("");
  const [workflowFilter, setWorkflowFilter] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Inspector Drawer State
  const [selectedExecutionId, setSelectedExecutionId] = useState<number | null>(
    initialExecutionId ? Number(initialExecutionId) : null
  );
  const [selectedDetail, setSelectedDetail] = useState<ExecutionDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const fetchSummary = useCallback(async () => {
    try {
      const res = await fetch("/api/executions/summary");
      if (res.ok) setSummary(await res.json());
    } catch {}
  }, []);

  const fetchExecutions = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set("status", statusFilter);
      if (sessionFilter) params.set("sessionId", sessionFilter);
      if (workflowFilter) params.set("workflowId", workflowFilter);
      if (searchQuery.trim()) params.set("search", searchQuery.trim());
      params.set("limit", "50");

      const res = await fetch(`/api/executions?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setExecutions(data.executions || []);
      }
    } catch {}
  }, [statusFilter, sessionFilter, workflowFilter, searchQuery]);

  const loadDependencies = useCallback(async () => {
    try {
      const [sessRes, wfRes] = await Promise.all([
        fetch("/api/sessions"),
        fetch("/api/workflows"),
      ]);
      if (sessRes.ok) setSessions(await sessRes.json());
      if (wfRes.ok) setWorkflows(await wfRes.json());
    } catch {}
  }, []);

  const fetchExecutionDetail = useCallback(async (id: number) => {
    setLoadingDetail(true);
    try {
      const res = await fetch(`/api/executions/${id}`);
      if (res.ok) {
        setSelectedDetail(await res.json());
      }
    } catch {
      setSelectedDetail(null);
    } finally {
      setLoadingDetail(false);
    }
  }, []);

  const [retrying, setRetrying] = useState(false);

  const handleRetry = async (id: number) => {
    setRetrying(true);
    try {
      const res = await fetch(`/api/executions/${id}/retry`, { method: "POST" });
      if (res.ok) {
        await Promise.all([fetchExecutionDetail(id), fetchExecutions(), fetchSummary()]);
      } else {
        alert("Failed to retry execution");
      }
    } catch (err) {
      alert(`Error retrying execution: ${err}`);
    } finally {
      setRetrying(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    Promise.all([fetchSummary(), fetchExecutions(), loadDependencies()]).finally(() =>
      setLoading(false)
    );
  }, [fetchSummary, fetchExecutions, loadDependencies]);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      fetchSummary();
      fetchExecutions();
      if (selectedExecutionId) {
        fetchExecutionDetail(selectedExecutionId);
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [autoRefresh, fetchSummary, fetchExecutions, selectedExecutionId, fetchExecutionDetail]);

  useEffect(() => {
    if (selectedExecutionId != null) {
      fetchExecutionDetail(selectedExecutionId);
    } else {
      setSelectedDetail(null);
    }
  }, [selectedExecutionId, fetchExecutionDetail]);

  function getStatusColor(status: string) {
    switch (status) {
      case "running":
        return { bg: "rgba(59, 130, 246, 0.15)", text: "#60a5fa", border: "rgba(59, 130, 246, 0.3)" };
      case "completed":
        return { bg: "rgba(16, 185, 129, 0.15)", text: "#34d399", border: "rgba(16, 185, 129, 0.3)" };
      case "waiting_input":
        return { bg: "rgba(245, 158, 11, 0.15)", text: "#fbbf24", border: "rgba(245, 158, 11, 0.3)" };
      case "paused_human":
        return { bg: "rgba(168, 85, 247, 0.15)", text: "#c084fc", border: "rgba(168, 85, 247, 0.3)" };
      case "failed":
        return { bg: "rgba(239, 68, 68, 0.15)", text: "#f87171", border: "rgba(239, 68, 68, 0.3)" };
      default:
        return { bg: "rgba(156, 163, 175, 0.15)", text: "#9ca3af", border: "rgba(156, 163, 175, 0.3)" };
    }
  }

  function formatTime(isoStr?: string | null) {
    if (!isoStr) return "—";
    try {
      const d = new Date(isoStr);
      return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }) + " " + d.toLocaleDateString();
    } catch {
      return isoStr;
    }
  }

  return (
    <div style={{ padding: "2rem", maxWidth: "1400px", margin: "0 auto" }}>
      {/* Header & Title */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
        <div>
          <h1 style={{ fontSize: "1.75rem", fontWeight: 700, margin: 0, color: "#fff", display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <span>⚡</span> Automation Executions & Traces
          </h1>
          <p style={{ margin: "0.25rem 0 0", color: "#9ca3af", fontSize: "0.9rem" }}>
            Real-time step-by-step audit logs, multi-stage delays, and payload inspection across all WhatsApp numbers.
          </p>
        </div>
        <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
          <label style={{ display: "flex", alignItems: "center", gap: "0.4rem", color: "#d1d5db", fontSize: "0.85rem", cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              style={{ cursor: "pointer" }}
            />
            Live polling (5s)
          </label>
          <button
            onClick={() => {
              fetchSummary();
              fetchExecutions();
              if (selectedExecutionId) fetchExecutionDetail(selectedExecutionId);
            }}
            className="btn"
            style={{ padding: "0.4rem 0.8rem", fontSize: "0.85rem" }}
          >
            ↻ Refresh
          </button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "1rem", marginBottom: "1.5rem" }}>
        <div style={{ background: "#18181b", border: "1px solid #27272a", borderRadius: "8px", padding: "1rem" }}>
          <div style={{ fontSize: "0.8rem", color: "#9ca3af", textTransform: "uppercase", fontWeight: 600 }}>Total Executions</div>
          <div style={{ fontSize: "1.75rem", fontWeight: 700, color: "#fff", marginTop: "0.25rem" }}>{summary.total}</div>
        </div>
        <div style={{ background: "#18181b", border: "1px solid #1e3a8a", borderRadius: "8px", padding: "1rem" }}>
          <div style={{ fontSize: "0.8rem", color: "#60a5fa", textTransform: "uppercase", fontWeight: 600 }}>Running</div>
          <div style={{ fontSize: "1.75rem", fontWeight: 700, color: "#60a5fa", marginTop: "0.25rem" }}>{summary.running}</div>
        </div>
        <div style={{ background: "#18181b", border: "1px solid #78350f", borderRadius: "8px", padding: "1rem" }}>
          <div style={{ fontSize: "0.8rem", color: "#fbbf24", textTransform: "uppercase", fontWeight: 600 }}>Waiting Input (2h)</div>
          <div style={{ fontSize: "1.75rem", fontWeight: 700, color: "#fbbf24", marginTop: "0.25rem" }}>{summary.waitingInput}</div>
        </div>
        <div style={{ background: "#18181b", border: "1px solid #064e3b", borderRadius: "8px", padding: "1rem" }}>
          <div style={{ fontSize: "0.8rem", color: "#34d399", textTransform: "uppercase", fontWeight: 600 }}>Completed</div>
          <div style={{ fontSize: "1.75rem", fontWeight: 700, color: "#34d399", marginTop: "0.25rem" }}>{summary.completed}</div>
        </div>
        <div style={{ background: "#18181b", border: "1px solid #581c87", borderRadius: "8px", padding: "1rem" }}>
          <div style={{ fontSize: "0.8rem", color: "#c084fc", textTransform: "uppercase", fontWeight: 600 }}>Human Takeover</div>
          <div style={{ fontSize: "1.75rem", fontWeight: 700, color: "#c084fc", marginTop: "0.25rem" }}>{summary.pausedHuman}</div>
        </div>
        <div style={{ background: "#18181b", border: "1px solid #7f1d1d", borderRadius: "8px", padding: "1rem" }}>
          <div style={{ fontSize: "0.8rem", color: "#f87171", textTransform: "uppercase", fontWeight: 600 }}>Failed</div>
          <div style={{ fontSize: "1.75rem", fontWeight: 700, color: "#f87171", marginTop: "0.25rem" }}>{summary.failed}</div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div
        style={{
          background: "#18181b",
          border: "1px solid #27272a",
          borderRadius: "8px",
          padding: "1rem",
          display: "flex",
          flexWrap: "wrap",
          gap: "1rem",
          alignItems: "center",
          marginBottom: "1.5rem",
        }}
      >
        <div style={{ flex: 1, minWidth: "200px" }}>
          <input
            type="text"
            placeholder="Search phone, name, trigger text..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: "100%",
              background: "#09090b",
              border: "1px solid #27272a",
              borderRadius: "6px",
              padding: "0.5rem 0.75rem",
              color: "#fff",
              fontSize: "0.85rem",
            }}
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          style={{
            background: "#09090b",
            border: "1px solid #27272a",
            borderRadius: "6px",
            padding: "0.5rem 0.75rem",
            color: "#fff",
            fontSize: "0.85rem",
          }}
        >
          <option value="">All Statuses</option>
          <option value="running">Running</option>
          <option value="waiting_input">Waiting Input</option>
          <option value="completed">Completed</option>
          <option value="paused_human">Paused Human</option>
          <option value="failed">Failed</option>
          <option value="cancelled">Cancelled</option>
        </select>

        <select
          value={sessionFilter}
          onChange={(e) => setSessionFilter(e.target.value)}
          style={{
            background: "#09090b",
            border: "1px solid #27272a",
            borderRadius: "6px",
            padding: "0.5rem 0.75rem",
            color: "#fff",
            fontSize: "0.85rem",
          }}
        >
          <option value="">All WhatsApp Numbers</option>
          {sessions.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name} ({s.providerSessionId})
            </option>
          ))}
        </select>

        <select
          value={workflowFilter}
          onChange={(e) => setWorkflowFilter(e.target.value)}
          style={{
            background: "#09090b",
            border: "1px solid #27272a",
            borderRadius: "6px",
            padding: "0.5rem 0.75rem",
            color: "#fff",
            fontSize: "0.85rem",
          }}
        >
          <option value="">All Workflows</option>
          {workflows.map((w) => (
            <option key={w.id} value={w.id}>
              {w.name}
            </option>
          ))}
        </select>

        {(statusFilter || sessionFilter || workflowFilter || searchQuery) && (
          <button
            onClick={() => {
              setStatusFilter("");
              setSessionFilter("");
              setWorkflowFilter("");
              setSearchQuery("");
            }}
            style={{
              background: "transparent",
              border: "1px dashed #52525b",
              borderRadius: "6px",
              padding: "0.5rem 0.75rem",
              color: "#a1a1aa",
              fontSize: "0.85rem",
              cursor: "pointer",
            }}
          >
            Clear Filters
          </button>
        )}
      </div>

      {/* Main Execution Table */}
      <div style={{ background: "#18181b", border: "1px solid #27272a", borderRadius: "8px", overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "0.875rem" }}>
            <thead>
              <tr style={{ background: "#09090b", borderBottom: "1px solid #27272a", color: "#a1a1aa" }}>
                <th style={{ padding: "0.75rem 1rem" }}>Execution ID</th>
                <th style={{ padding: "0.75rem 1rem" }}>Workflow</th>
                <th style={{ padding: "0.75rem 1rem" }}>WhatsApp Number</th>
                <th style={{ padding: "0.75rem 1rem" }}>Contact</th>
                <th style={{ padding: "0.75rem 1rem" }}>Trigger Message</th>
                <th style={{ padding: "0.75rem 1rem" }}>Status</th>
                <th style={{ padding: "0.75rem 1rem" }}>Steps</th>
                <th style={{ padding: "0.75rem 1rem" }}>Started At</th>
                <th style={{ padding: "0.75rem 1rem", textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && executions.length === 0 ? (
                <tr>
                  <td colSpan={9} style={{ padding: "2rem", textAlign: "center", color: "#71717a" }}>
                    Loading executions...
                  </td>
                </tr>
              ) : executions.length === 0 ? (
                <tr>
                  <td colSpan={9} style={{ padding: "2rem", textAlign: "center", color: "#71717a" }}>
                    No workflow executions match the selected filters.
                  </td>
                </tr>
              ) : (
                executions.map((exec) => {
                  const sc = getStatusColor(exec.status);
                  const isSelected = selectedExecutionId === exec.id;
                  return (
                    <tr
                      key={exec.id}
                      onClick={() => setSelectedExecutionId(exec.id)}
                      style={{
                        borderBottom: "1px solid #27272a",
                        background: isSelected ? "rgba(59, 130, 246, 0.08)" : "transparent",
                        cursor: "pointer",
                        transition: "background 0.15s ease",
                      }}
                      onMouseEnter={(e) => {
                        if (!isSelected) e.currentTarget.style.background = "#202024";
                      }}
                      onMouseLeave={(e) => {
                        if (!isSelected) e.currentTarget.style.background = "transparent";
                      }}
                    >
                      <td style={{ padding: "0.75rem 1rem", fontFamily: "monospace", color: "#60a5fa", fontWeight: 600 }}>
                        #{exec.id}
                      </td>
                      <td style={{ padding: "0.75rem 1rem", fontWeight: 600, color: "#f4f4f5" }}>
                        {exec.workflowName || `Workflow #${exec.workflowId}`}
                      </td>
                      <td style={{ padding: "0.75rem 1rem", color: "#d1d5db" }}>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: "0.3rem" }}>
                          <span style={{ color: "#22c55e" }}>●</span>
                          {exec.sessionName || `Session #${exec.sessionId}`}
                        </span>
                      </td>
                      <td style={{ padding: "0.75rem 1rem", color: "#e4e4e7" }}>
                        <div>{exec.contactName || "Unknown"}</div>
                        <div style={{ fontSize: "0.75rem", color: "#71717a", fontFamily: "monospace" }}>
                          {exec.contactPhone}
                        </div>
                      </td>
                      <td style={{ padding: "0.75rem 1rem", maxWidth: "220px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "#a1a1aa" }}>
                        {exec.triggerText ? `"${exec.triggerText}"` : <span style={{ color: "#52525b" }}>—</span>}
                      </td>
                      <td style={{ padding: "0.75rem 1rem" }}>
                        <span
                          style={{
                            display: "inline-block",
                            padding: "0.2rem 0.5rem",
                            borderRadius: "9999px",
                            fontSize: "0.75rem",
                            fontWeight: 600,
                            background: sc.bg,
                            color: sc.text,
                            border: `1px solid ${sc.border}`,
                          }}
                        >
                          {exec.status.replace("_", " ")}
                        </span>
                      </td>
                      <td style={{ padding: "0.75rem 1rem", color: "#9ca3af", fontSize: "0.8rem" }}>
                        {exec.stepCount ?? 0} events
                      </td>
                      <td style={{ padding: "0.75rem 1rem", color: "#71717a", fontSize: "0.8rem" }}>
                        {formatTime(exec.startedAt)}
                      </td>
                      <td style={{ padding: "0.75rem 1rem", textAlign: "right" }}>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedExecutionId(exec.id);
                          }}
                          style={{
                            background: "#27272a",
                            border: "1px solid #3f3f46",
                            color: "#e4e4e7",
                            padding: "0.3rem 0.6rem",
                            borderRadius: "4px",
                            fontSize: "0.75rem",
                            cursor: "pointer",
                          }}
                        >
                          Inspect Trace 🔍
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Slide-Over Trace Inspector Drawer */}
      {selectedExecutionId != null && (
        <div
          style={{
            position: "fixed",
            top: 0,
            right: 0,
            bottom: 0,
            width: "560px",
            maxWidth: "90vw",
            background: "#121214",
            borderLeft: "1px solid #27272a",
            boxShadow: "-10px 0 25px rgba(0,0,0,0.5)",
            zIndex: 1000,
            display: "flex",
            flexDirection: "column",
          }}
        >
          {/* Drawer Header */}
          <div
            style={{
              padding: "1.25rem 1.5rem",
              borderBottom: "1px solid #27272a",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              background: "#18181b",
            }}
          >
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <span style={{ fontSize: "1.1rem", fontWeight: 700, color: "#fff" }}>
                  Execution #{selectedExecutionId}
                </span>
                {selectedDetail && (
                  <span
                    style={{
                      padding: "0.15rem 0.45rem",
                      borderRadius: "9999px",
                      fontSize: "0.7rem",
                      fontWeight: 600,
                      ...getStatusColor(selectedDetail.status),
                      border: `1px solid ${getStatusColor(selectedDetail.status).border}`,
                    }}
                  >
                    {selectedDetail.status}
                  </span>
                )}
              </div>
              <div style={{ fontSize: "0.8rem", color: "#9ca3af", marginTop: "0.2rem" }}>
                {selectedDetail?.workflowName} • {selectedDetail?.sessionName}
              </div>
            </div>
            <button
              onClick={() => setSelectedExecutionId(null)}
              style={{
                background: "transparent",
                border: "none",
                color: "#a1a1aa",
                fontSize: "1.25rem",
                cursor: "pointer",
                padding: "0.25rem 0.5rem",
              }}
            >
              ✕
            </button>
          </div>

          {/* Drawer Content */}
          <div style={{ flex: 1, overflowY: "auto", padding: "1.5rem" }}>
            {loadingDetail ? (
              <div style={{ textAlign: "center", padding: "3rem 0", color: "#71717a" }}>
                Loading execution trace...
              </div>
            ) : selectedDetail ? (
              <div>
                {/* Meta Overview Cards */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: "0.75rem",
                    marginBottom: "1.5rem",
                  }}
                >
                  <div style={{ background: "#18181b", padding: "0.75rem", borderRadius: "6px", border: "1px solid #27272a" }}>
                    <div style={{ fontSize: "0.75rem", color: "#71717a" }}>Contact</div>
                    <div style={{ fontWeight: 600, color: "#f4f4f5", fontSize: "0.85rem" }}>
                      {selectedDetail.contactName || "Unknown"}
                    </div>
                    <div style={{ fontSize: "0.75rem", color: "#9ca3af", fontFamily: "monospace" }}>
                      {selectedDetail.contactPhone}
                    </div>
                  </div>

                  <div style={{ background: "#18181b", padding: "0.75rem", borderRadius: "6px", border: "1px solid #27272a" }}>
                    <div style={{ fontSize: "0.75rem", color: "#71717a" }}>Timing</div>
                    <div style={{ fontSize: "0.75rem", color: "#d1d5db" }}>
                      Started: {formatTime(selectedDetail.startedAt)}
                    </div>
                    <div style={{ fontSize: "0.75rem", color: "#d1d5db" }}>
                      Finished: {formatTime(selectedDetail.finishedAt)}
                    </div>
                  </div>
                </div>

                {/* Failure Diagnostic Alert Banner */}
                {(selectedDetail.status === "failed" ||
                  selectedDetail.events?.some((e) => e.eventType === "execution.failed" || e.eventType === "job.failed")) && (
                  <div
                    style={{
                      background: "rgba(239, 68, 68, 0.12)",
                      border: "1px solid rgba(239, 68, 68, 0.4)",
                      borderRadius: "8px",
                      padding: "1rem",
                      marginBottom: "1.5rem",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "1rem" }}>
                      <div>
                        <div style={{ color: "#f87171", fontWeight: 700, fontSize: "0.9rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                          <span>🚨 Automation Step Failed</span>
                        </div>
                        {(() => {
                          const failEvt = selectedDetail.events?.find(
                            (e) => e.eventType === "execution.failed" || e.eventType === "job.failed"
                          );
                          const nodeKey = (failEvt?.data as any)?.node_key || selectedDetail.currentNodeKey || "unknown";
                          const errText = (failEvt?.data as any)?.error || "An unexpected error interrupted this workflow step.";
                          const stack = (failEvt?.data as any)?.stack;
                          return (
                            <div style={{ marginTop: "0.5rem", fontSize: "0.8125rem", color: "#fca5a5" }}>
                              <div><strong>Failing Step / Node:</strong> <code style={{ background: "#27272a", padding: "0.1rem 0.3rem", borderRadius: "4px" }}>{nodeKey}</code></div>
                              <div style={{ marginTop: "0.25rem" }}><strong>Error Details:</strong> {errText}</div>
                              {stack && (
                                <details style={{ marginTop: "0.5rem", color: "#d1d5db" }}>
                                  <summary style={{ cursor: "pointer", fontSize: "0.75rem" }}>View Stack Trace</summary>
                                  <pre style={{ background: "#09090b", padding: "0.5rem", borderRadius: "4px", fontSize: "0.7rem", marginTop: "0.25rem", overflowX: "auto" }}>{stack}</pre>
                                </details>
                              )}
                            </div>
                          );
                        })()}
                      </div>
                      <button
                        onClick={() => void handleRetry(selectedDetail.id)}
                        disabled={retrying}
                        style={{
                          background: "#ef4444",
                          color: "#fff",
                          border: "none",
                          borderRadius: "6px",
                          padding: "0.4rem 0.75rem",
                          fontSize: "0.75rem",
                          fontWeight: 600,
                          cursor: "pointer",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {retrying ? "Retrying…" : "🔄 Retry Step"}
                      </button>
                    </div>
                  </div>
                )}

                {/* Inbound Trigger Message Box */}
                {selectedDetail.triggerText && (
                  <div
                    style={{
                      background: "rgba(34, 197, 94, 0.08)",
                      border: "1px solid rgba(34, 197, 94, 0.25)",
                      borderRadius: "6px",
                      padding: "0.75rem 1rem",
                      marginBottom: "1.5rem",
                    }}
                  >
                    <div style={{ fontSize: "0.75rem", color: "#4ade80", fontWeight: 600, marginBottom: "0.25rem" }}>
                      📥 Inbound Trigger Message
                    </div>
                    <div style={{ color: "#fff", fontSize: "0.875rem" }}>
                      "{selectedDetail.triggerText}"
                    </div>
                  </div>
                )}

                {/* Workflow Variables Snapshot */}
                {selectedDetail.vars && Object.keys(selectedDetail.vars).length > 0 && (
                  <div style={{ marginBottom: "1.5rem" }}>
                    <div style={{ fontSize: "0.8rem", color: "#9ca3af", textTransform: "uppercase", fontWeight: 600, marginBottom: "0.5rem" }}>
                      📦 Workflow Variables
                    </div>
                    <pre
                      style={{
                        background: "#09090b",
                        border: "1px solid #27272a",
                        borderRadius: "6px",
                        padding: "0.75rem",
                        fontSize: "0.75rem",
                        color: "#38bdf8",
                        overflowX: "auto",
                        margin: 0,
                      }}
                    >
                      {JSON.stringify(selectedDetail.vars, null, 2)}
                    </pre>
                  </div>
                )}

                {/* Step-by-Step Chronological Event Timeline */}
                <div>
                  <div style={{ fontSize: "0.8rem", color: "#9ca3af", textTransform: "uppercase", fontWeight: 600, marginBottom: "0.75rem" }}>
                    ⏱️ Execution Timeline ({selectedDetail.events?.length || 0} events)
                  </div>

                  <div style={{ position: "relative", paddingLeft: "1.5rem" }}>
                    {/* Vertical Line */}
                    <div
                      style={{
                        position: "absolute",
                        left: "6px",
                        top: "8px",
                        bottom: "8px",
                        width: "2px",
                        background: "#27272a",
                      }}
                    />

                    {selectedDetail.events && selectedDetail.events.length > 0 ? (
                      selectedDetail.events.map((evt, idx) => {
                        let icon = "⚙️";
                        let title = evt.eventType;
                        let badgeColor = "#60a5fa";

                        if (evt.eventType === "trigger.matched") {
                          icon = "🎯";
                          title = "Trigger Matched";
                          badgeColor = "#34d399";
                        } else if (evt.eventType === "read_receipt.sent") {
                          icon = "👀";
                          title = "Blue Ticks (Mark as Read)";
                          badgeColor = "#38bdf8";
                        } else if (evt.eventType === "presence.sent") {
                          icon = "✍️";
                          title = "Typing Presence (Composing)";
                          badgeColor = "#a78bfa";
                        } else if (evt.eventType === "node.entered") {
                          icon = "▶️";
                          title = `Node: ${(evt.data as any)?.type || (evt.data as any)?.node_key}`;
                          badgeColor = "#fbbf24";
                        } else if (evt.eventType === "message.sent") {
                          icon = "📤";
                          title = `Message Sent (${(evt.data as any)?.kind || "text"})`;
                          badgeColor = "#4ade80";
                        } else if (evt.eventType === "condition.evaluated") {
                          icon = "🔀";
                          title = `Condition Evaluated: ${(evt.data as any)?.result ? "TRUE" : "FALSE"}`;
                          badgeColor = (evt.data as any)?.result ? "#34d399" : "#f87171";
                        } else if (evt.eventType === "milestone.reached") {
                          icon = "🏆";
                          title = `Milestone: ${(evt.data as any)?.milestone_key}`;
                          badgeColor = "#f59e0b";
                        } else if (evt.eventType === "execution.completed") {
                          icon = "🏁";
                          title = "Workflow Execution Completed";
                          badgeColor = "#10b981";
                        } else if (evt.eventType === "execution.failed" || evt.eventType === "job.failed") {
                          icon = "🚨";
                          title = `Step Failed: ${(evt.data as any)?.node_key || "unknown"}`;
                          badgeColor = "#ef4444";
                        } else if (evt.eventType === "execution.retried") {
                          icon = "🔄";
                          title = "Execution Retried by Operator";
                          badgeColor = "#38bdf8";
                        } else if (evt.eventType.includes("suppressed")) {
                          icon = "🛑";
                          title = "Execution Suppressed (Human Takeover)";
                          badgeColor = "#c084fc";
                        }

                        return (
                          <div key={evt.id || idx} style={{ position: "relative", marginBottom: "1.25rem" }}>
                            {/* Dot on line */}
                            <div
                              style={{
                                position: "absolute",
                                left: "-1.5rem",
                                top: "2px",
                                width: "14px",
                                height: "14px",
                                borderRadius: "50%",
                                background: "#18181b",
                                border: `2px solid ${badgeColor}`,
                              }}
                            />

                            <div
                              style={{
                                background: "#18181b",
                                border: "1px solid #27272a",
                                borderRadius: "6px",
                                padding: "0.75rem",
                              }}
                            >
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                <span style={{ fontWeight: 600, color: "#f4f4f5", fontSize: "0.85rem", display: "flex", alignItems: "center", gap: "0.35rem" }}>
                                  <span>{icon}</span> {title}
                                </span>
                                <span style={{ fontSize: "0.7rem", color: "#71717a" }}>
                                  {formatTime(evt.createdAt)}
                                </span>
                              </div>

                              {evt.data && Object.keys(evt.data).length > 0 && (
                                <pre
                                  style={{
                                    marginTop: "0.5rem",
                                    marginBottom: 0,
                                    background: "#09090b",
                                    padding: "0.5rem",
                                    borderRadius: "4px",
                                    fontSize: "0.7rem",
                                    color: "#a1a1aa",
                                    overflowX: "auto",
                                  }}
                                >
                                  {JSON.stringify(evt.data, null, 2)}
                                </pre>
                              )}
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <div style={{ color: "#71717a", fontSize: "0.85rem" }}>No events recorded.</div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ textAlign: "center", padding: "3rem 0", color: "#f87171" }}>
                Could not load execution details.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

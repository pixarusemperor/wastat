import { useEffect, useRef, useState } from "react";
import { api, type WorkflowSummary } from "./api.js";
import { Dialog, StatusPill } from "./ui.js";

export function WorkflowList({ onOpen }: { onOpen: (id: string) => void }) {
  const [workflows, setWorkflows] = useState<WorkflowSummary[] | null>(null);
  const [experiments, setExperiments] = useState<Record<number, string>>({});
  const [sessions, setSessions] = useState<Array<{ id: number; name: string; providerSessionId: string }>>([]);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<WorkflowSummary | null>(null);
  const [duplicatingId, setDuplicatingId] = useState<number | null>(null);

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function refresh() {
    setError(null);
    try {
      const [wfList, expList, sessList] = await Promise.all([
        api.listWorkflows(),
        api.listExperiments().catch(() => []),
        api.listSessions().catch(() => []),
      ]);
      setWorkflows(wfList);
      const expMap: Record<number, string> = {};
      for (const e of expList) expMap[e.id] = e.name;
      setExperiments(expMap);
      setSessions(sessList);
    } catch (e) {
      setError(String(e));
    }
  }

  async function handleDuplicate(w: WorkflowSummary) {
    if (duplicatingId) return;
    setDuplicatingId(w.id);
    try {
      const res = await api.duplicateWorkflow(w.id);
      await refresh();
      onOpen(String(res.id));
    } catch (e) {
      alert(`Could not duplicate workflow: ${e}`);
    } finally {
      setDuplicatingId(null);
    }
  }

  async function handleExportAll() {
    try {
      const wfs = await api.listWorkflows();
      const detailed = await Promise.all(wfs.map((w) => api.getWorkflow(String(w.id))));
      const blob = new Blob([JSON.stringify({ version: "wastat_v2", exportedAt: new Date().toISOString(), workflows: detailed }, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `wastat_workflows_backup_${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      alert(`Export failed: ${e}`);
    }
  }

  async function handleImportAll(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      const list = Array.isArray(data) ? data : data.workflows;
      if (!Array.isArray(list)) throw new Error("Invalid backup format");
      for (const item of list) {
        const created = await api.createWorkflow(item.name ?? "Imported Workflow", item.experimentId, item.sessionId);
        await api.saveWorkflow(String(created.id), {
          name: item.name ?? "Imported Workflow",
          description: item.description,
          active: item.active ?? 0,
          sessionId: item.sessionId ?? null,
          experimentId: item.experimentId ?? null,
          nodes: item.nodes ?? [],
          edges: item.edges ?? [],
        });
      }
      alert(`Successfully imported ${list.length} workflow(s)!`);
      await refresh();
    } catch (e) {
      alert(`Import failed: ${e}`);
    } finally {
      e.target.value = "";
    }
  }

  return (
    <main className="page">
      <header className="page-header">
        <div>
          <h1>Workflows</h1>
          <p className="page-subtitle">Automations that reply to incoming WhatsApp messages with human-like delays.</p>
        </div>
        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
          <button className="btn btn-ghost btn-sm" onClick={handleExportAll} title="Export all workflows as JSON">
            📥 Export JSON
          </button>
          <label className="btn btn-ghost btn-sm" style={{ cursor: "pointer" }} title="Import workflows from JSON backup">
            📤 Import JSON
            <input type="file" accept=".json" onChange={handleImportAll} style={{ display: "none" }} />
          </label>
          <button className="btn btn-primary" onClick={() => setCreating(true)}>
            New workflow
          </button>
        </div>
      </header>

      {error && (
        <div className="error-banner" role="alert">
          Couldn't load workflows.
          <button className="btn btn-sm" style={{ marginLeft: "auto" }} onClick={refresh}>
            Retry
          </button>
        </div>
      )}

      {workflows === null && !error && (
        <div aria-busy="true" aria-label="Loading workflows">
          <div className="skeleton" style={{ marginBottom: "0.75rem" }} />
          <div className="skeleton" />
        </div>
      )}

      {workflows?.length === 0 && (
        <div className="card empty-state">
          <div className="empty-state-icon" aria-hidden>
            💬
          </div>
          <h2>No workflows yet</h2>
          <p>Create one, select a WhatsApp number, add a keyword trigger and a reply, then set it live.</p>
          <button className="btn btn-primary" onClick={() => setCreating(true)}>
            Create your first workflow
          </button>
        </div>
      )}

      {workflows !== null && workflows.length > 0 && (
        <ul role="list" className="card" style={{ listStyle: "none", margin: 0, padding: 0 }}>
          {workflows.map((w) => (
            <li key={w.id} className="wf-row" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0.75rem 1rem", borderBottom: "1px solid var(--border-color, #27272a)" }}>
              <a
                href={`#/workflows/${w.id}`}
                className="wf-row-link"
                style={{ flex: 1, textDecoration: "none", display: "flex", alignItems: "center", justifyContent: "space-between", marginRight: "1rem" }}
                onClick={(e) => {
                  e.preventDefault();
                  onOpen(String(w.id));
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
                  <span style={{ fontWeight: 600, color: "#f4f4f5" }}>{w.name}</span>
                  {w.sessionName ? (
                    <span style={{ fontSize: "0.7rem", padding: "0.15rem 0.45rem", borderRadius: "9999px", background: "rgba(34, 197, 94, 0.15)", color: "#4ade80", border: "1px solid rgba(34, 197, 94, 0.3)" }}>
                      📱 {w.sessionName}
                    </span>
                  ) : (
                    <span style={{ fontSize: "0.7rem", padding: "0.15rem 0.45rem", borderRadius: "9999px", background: "rgba(156, 163, 175, 0.15)", color: "#9ca3af", border: "1px solid rgba(156, 163, 175, 0.3)" }}>
                      🌐 All Numbers
                    </span>
                  )}
                  {w.experimentId && experiments[w.experimentId] && (
                    <span className="pill pill-draft" style={{ fontSize: "0.6875rem", padding: "0.125rem 0.5rem" }}>
                      🧪 {experiments[w.experimentId]}
                    </span>
                  )}
                </div>
                <StatusPill active={w.active === 1} />
              </a>
              <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                <button
                  className="btn btn-ghost btn-sm"
                  aria-label={`Duplicate ${w.name}`}
                  disabled={duplicatingId === w.id}
                  onClick={() => handleDuplicate(w)}
                >
                  {duplicatingId === w.id ? "Duplicating…" : "Duplicate"}
                </button>
                <button
                  className="btn btn-ghost btn-danger btn-sm"
                  aria-label={`Delete ${w.name}`}
                  onClick={() => setDeleting(w)}
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* Create workflow */}
      <Dialog open={creating} onClose={() => setCreating(false)} labelledBy="create-wf-title">
        <CreateWorkflowForm
          experiments={experiments}
          sessions={sessions}
          onCancel={() => setCreating(false)}
          onCreated={(id) => {
            setCreating(false);
            onOpen(id);
          }}
        />
      </Dialog>

      {/* Delete confirm */}
      <Dialog open={deleting !== null} onClose={() => setDeleting(null)} labelledBy="delete-wf-title">
        {deleting && (
          <form
            className="modal-body"
            onSubmit={async (e) => {
              e.preventDefault();
              await api.deleteWorkflow(String(deleting.id));
              setDeleting(null);
              void refresh();
            }}
          >
            <p className="modal-title">Delete “{deleting.name}”?</p>
            <p className="page-subtitle" style={{ margin: "0.25rem 0 1.25rem" }}>
              This permanently removes the workflow and its graph. Message history is kept.
            </p>
            <div className="modal-actions">
              <button type="button" className="btn" onClick={() => setDeleting(null)}>
                Cancel
              </button>
              <button type="submit" className="btn btn-danger-solid">
                Delete workflow
              </button>
            </div>
          </form>
        )}
      </Dialog>
    </main>
  );
}

function CreateWorkflowForm({
  experiments,
  sessions,
  onCancel,
  onCreated,
}: {
  experiments: Record<number, string>;
  sessions: Array<{ id: number; name: string; providerSessionId: string }>;
  onCancel: () => void;
  onCreated: (id: string) => void;
}) {
  const [name, setName] = useState("");
  const [sessionId, setSessionId] = useState<string>("");
  const [experimentId, setExperimentId] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 0);
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed || busy) return;
    setBusy(true);
    try {
      const created = await api.createWorkflow(
        trimmed,
        experimentId ? Number(experimentId) : null,
        sessionId ? Number(sessionId) : null,
      );
      onCreated(String(created.id));
    } finally {
      setBusy(false);
    }
  }

  const expEntries = Object.entries(experiments);

  return (
    <form className="modal-body" onSubmit={submit}>
      <p className="modal-title">New workflow</p>
      <p className="page-subtitle" style={{ margin: "0.25rem 0 1.25rem" }}>
        Select which WhatsApp Number will run this automation, and configure humanized replies.
      </p>
      <label className="field-label" htmlFor="wf-name">
        Name
      </label>
      <input
        ref={inputRef}
        id="wf-name"
        className="input"
        placeholder="e.g. Inbound Support / Sales Hook"
        value={name}
        onChange={(e) => setName(e.target.value)}
        required
      />

      <label className="field-label" htmlFor="wf-session" style={{ marginTop: "1rem" }}>
        WhatsApp Number / Session
      </label>
      <select
        id="wf-session"
        className="input"
        value={sessionId}
        onChange={(e) => setSessionId(e.target.value)}
      >
        <option value="">All WhatsApp Numbers (Global)</option>
        {sessions.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name} ({s.providerSessionId})
          </option>
        ))}
      </select>

      {expEntries.length > 0 && (
        <>
          <label className="field-label" htmlFor="wf-exp" style={{ marginTop: "1rem" }}>
            Assign to Experiment (optional)
          </label>
          <select
            id="wf-exp"
            className="input"
            value={experimentId}
            onChange={(e) => setExperimentId(e.target.value)}
          >
            <option value="">None (Standalone)</option>
            {expEntries.map(([id, expName]) => (
              <option key={id} value={id}>
                {expName}
              </option>
            ))}
          </select>
        </>
      )}
      <div className="modal-actions">
        <button type="button" className="btn" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="btn btn-primary" disabled={!name.trim() || busy}>
          {busy ? "Creating…" : "Create workflow"}
        </button>
      </div>
    </form>
  );
}

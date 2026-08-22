import { useEffect, useRef, useState } from "react";
import { api, type WorkflowSummary } from "./api.js";
import { Dialog, StatusPill } from "./ui.js";

export function WorkflowList({ onOpen }: { onOpen: (id: string) => void }) {
  const [workflows, setWorkflows] = useState<WorkflowSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<WorkflowSummary | null>(null);

  async function refresh() {
    setError(null);
    try {
      setWorkflows(await api.listWorkflows());
    } catch (e) {
      setError(String(e));
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  return (
    <main className="page">
      <header className="page-header">
        <div>
          <h1>Workflows</h1>
          <p className="page-subtitle">Automations that reply to incoming WhatsApp messages.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setCreating(true)}>
          New workflow
        </button>
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
          <p>Create one, add a keyword trigger and a reply, then set it live.</p>
          <button className="btn btn-primary" onClick={() => setCreating(true)}>
            Create your first workflow
          </button>
        </div>
      )}

      {workflows !== null && workflows.length > 0 && (
        <ul role="list" className="card" style={{ listStyle: "none", margin: 0, padding: 0 }}>
          {workflows.map((w) => (
            <li key={w.id} className="wf-row">
              <a
                href={`#/workflows/${w.id}`}
                className="wf-row-link"
                onClick={(e) => {
                  e.preventDefault();
                  onOpen(String(w.id));
                }}
              >
                {w.name}
                <StatusPill active={w.active === 1} />
              </a>
              <button
                className="btn btn-ghost btn-danger btn-sm"
                aria-label={`Delete ${w.name}`}
                onClick={() => setDeleting(w)}
              >
                Delete
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* Create workflow */}
      <Dialog open={creating} onClose={() => setCreating(false)} labelledBy="create-wf-title">
        <CreateWorkflowForm
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
  onCancel,
  onCreated,
}: {
  onCancel: () => void;
  onCreated: (id: string) => void;
}) {
  const [name, setName] = useState("");
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
      const created = await api.createWorkflow(trimmed);
      onCreated(String(created.id));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="modal-body" onSubmit={submit}>
      <p className="modal-title">New workflow</p>
      <p className="page-subtitle" style={{ margin: "0.25rem 0 1.25rem" }}>
        It starts with a trigger and an end node — add steps in the editor.
      </p>
      <label className="field-label" htmlFor="wf-name">
        Name
      </label>
      <input
        ref={inputRef}
        id="wf-name"
        className="input"
        placeholder="e.g. Price enquiry follow-up"
        value={name}
        onChange={(e) => setName(e.target.value)}
        required
      />
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

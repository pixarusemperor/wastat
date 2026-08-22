import { useEffect, useRef, useState } from "react";
import { api, type WorkflowSummary } from "./api.js";

function StatusPill({ active }: { active: boolean }) {
  return (
    <span className={`pill ${active ? "pill-active" : "pill-draft"}`}>
      <span className="pill-dot" aria-hidden />
      {active ? "Active" : "Draft"}
    </span>
  );
}

function CreateWorkflowDialog({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const dlg = ref.current;
    if (!dlg) return;
    if (open && !dlg.open) {
      dlg.showModal();
      setName("");
      setTimeout(() => inputRef.current?.focus(), 0);
    } else if (!open && dlg.open) {
      dlg.close();
    }
  }, [open]);

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
    <dialog ref={ref} className="modal" onClose={onClose} aria-labelledby="create-wf-title">
      <form className="modal-body" onSubmit={submit}>
        <p className="modal-title" id="create-wf-title">
          New workflow
        </p>
        <p className="page-subtitle" style={{ marginBottom: "1rem" }}>
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
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={!name.trim() || busy}>
            {busy ? "Creating…" : "Create workflow"}
          </button>
        </div>
      </form>
    </dialog>
  );
}

export function WorkflowList({ onOpen }: { onOpen: (id: string) => void }) {
  const [workflows, setWorkflows] = useState<WorkflowSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<WorkflowSummary | null>(null);

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

  async function remove(wf: WorkflowSummary) {
    await api.deleteWorkflow(String(wf.id));
    setConfirmDelete(null);
    void refresh();
  }

  return (
    <main className="page">
      <header className="page-header">
        <div>
          <h1>Workflows</h1>
          <p className="page-subtitle">Automations that reply to incoming WhatsApp messages.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setDialogOpen(true)}>
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
          <button className="btn btn-primary" onClick={() => setDialogOpen(true)}>
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
                onClick={() => setConfirmDelete(w)}
              >
                Delete
              </button>
            </li>
          ))}
        </ul>
      )}

      <CreateWorkflowDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onCreated={(id) => {
          setDialogOpen(false);
          onOpen(id);
        }}
      />

      <dialog
        className="modal"
        aria-labelledby="delete-wf-title"
        ref={(dlg) => {
          if (confirmDelete && dlg && !dlg.open) dlg.showModal();
        }}
      >
        {confirmDelete && (
          <form
            className="modal-body"
            method="dialog"
            onSubmit={() => void remove(confirmDelete)}
          >
            <p className="modal-title" id="delete-wf-title">
              Delete “{confirmDelete.name}”?
            </p>
            <p className="page-subtitle" style={{ marginTop: "0.25rem", marginBottom: "1.25rem" }}>
              This permanently removes the workflow and its graph. Message history is kept.
            </p>
            <div className="modal-actions">
              <button type="button" className="btn" onClick={() => setConfirmDelete(null)}>
                Cancel
              </button>
              <button type="submit" className="btn btn-danger-solid">
                Delete workflow
              </button>
            </div>
          </form>
        )}
      </dialog>
    </main>
  );
}

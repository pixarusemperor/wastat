import { useEffect, useRef, useState } from "react";
import { api } from "./api.js";
import { Dialog } from "./ui.js";

interface SessionRow {
  id: number;
  name: string;
  providerSessionId: string;
  status: string;
}

export function SessionsPage() {
  const [sessions, setSessions] = useState<SessionRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<SessionRow | null>(null);

  async function refresh() {
    setError(null);
    try {
      setSessions(await api.listSessions());
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
          <h1>WhatsApp sessions</h1>
          <p className="page-subtitle">
            Numbers that send and receive on your behalf. After creating a session here, scan the
            QR code shown in the Wasender dashboard to connect the number.
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setCreating(true)}>
          Add session
        </button>
      </header>

      {error && (
        <div className="error-banner" role="alert">
          Couldn't load sessions.
          <button className="btn btn-sm" style={{ marginLeft: "auto" }} onClick={refresh}>
            Retry
          </button>
        </div>
      )}

      {sessions === null && !error && (
        <div aria-busy="true" aria-label="Loading sessions">
          <div className="skeleton" style={{ marginBottom: "0.75rem" }} />
          <div className="skeleton" />
        </div>
      )}

      {sessions?.length === 0 && (
        <div className="card empty-state">
          <div className="empty-state-icon" aria-hidden>
            📱
          </div>
          <h2>No sessions yet</h2>
          <p>Add a session, then scan the QR code shown by Wasender with WhatsApp.</p>
          <button className="btn btn-primary" onClick={() => setCreating(true)}>
            Add your first session
          </button>
        </div>
      )}

      {sessions !== null && sessions.length > 0 && (
        <ul role="list" className="card" style={{ listStyle: "none", margin: 0, padding: 0 }}>
          {sessions.map((s) => {
            const connected = s.status === "connected";
            return (
              <li key={s.id} className="wf-row" style={{ display: "block" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                  <span style={{ fontWeight: 600 }}>{s.name}</span>
                  <span className={`pill ${connected ? "pill-active" : "pill-draft"}`}>
                    <span className="pill-dot" aria-hidden />
                    {connected ? "Connected" : s.status}
                  </span>
                  <span style={{ flex: 1 }} />
                  <button
                    className="btn btn-ghost btn-danger btn-sm"
                    aria-label={`Delete session ${s.name}`}
                    onClick={() => setDeleting(s)}
                  >
                    Delete
                  </button>
                </div>
                <div style={{ color: "var(--muted)", fontSize: "0.8125rem", marginTop: "0.25rem" }}>
                  Webhook:{" "}
                  <code>{`${window.location.origin}/webhooks/wasender/${s.providerSessionId}`}</code>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {/* Create session */}
      <Dialog open={creating} onClose={() => setCreating(false)} labelledBy="create-session-title">
        <CreateSessionForm
          onCancel={() => setCreating(false)}
          onCreated={() => {
            setCreating(false);
            void refresh();
          }}
        />
      </Dialog>

      {/* Delete confirm */}
      <Dialog
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        labelledBy="delete-session-title"
      >
        {deleting && (
          <form
            className="modal-body"
            onSubmit={async (e) => {
              e.preventDefault();
              await api.deleteSession(deleting.id);
              setDeleting(null);
              void refresh();
            }}
          >
            <p className="modal-title" id="delete-session-title">
              Delete session “{deleting.name}”?
            </p>
            <p className="page-subtitle" style={{ margin: "0.25rem 0 1.25rem" }}>
              The number is deleted on Wasender and locally. This cannot be undone.
            </p>
            <div className="modal-actions">
              <button type="button" className="btn" onClick={() => setDeleting(null)}>
                Cancel
              </button>
              <button type="submit" className="btn btn-danger-solid">
                Delete session
              </button>
            </div>
          </form>
        )}
      </Dialog>
    </main>
  );
}

function CreateSessionForm({
  onCancel,
  onCreated,
}: {
  onCancel: () => void;
  onCreated: () => void;
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
      await api.createSession(trimmed);
      onCreated();
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="modal-body" onSubmit={submit}>
      <p className="modal-title">Add a WhatsApp session</p>
      <p className="page-subtitle" style={{ margin: "0.25rem 0 1.25rem" }}>
        Created on Wasender with its webhook pointed at this app.
      </p>
      <label className="field-label" htmlFor="session-name">
        Session name
      </label>
      <input
        ref={inputRef}
        id="session-name"
        className="input"
        placeholder='e.g. "Sales number"'
        value={name}
        onChange={(e) => setName(e.target.value)}
        required
      />
      <div className="modal-actions">
        <button type="button" className="btn" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="btn btn-primary" disabled={!name.trim() || busy}>
          {busy ? "Creating…" : "Create session"}
        </button>
      </div>
    </form>
  );
}

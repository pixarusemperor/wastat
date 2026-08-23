import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
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
  const [qrSession, setQrSession] = useState<SessionRow | null>(null);
  const [actionBusy, setActionBusy] = useState<number | null>(null);
  const [copiedId, setCopiedId] = useState<number | null>(null);

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

  async function handleCheckStatus(s: SessionRow) {
    setActionBusy(s.id);
    try {
      const res = await api.getSessionStatus(s.id);
      setSessions((prev) =>
        prev?.map((x) => (x.id === s.id ? { ...x, status: res.status } : x)) ?? null,
      );
    } catch (e) {
      setError(String(e));
    } finally {
      setActionBusy(null);
    }
  }

  async function handleRestart(s: SessionRow) {
    if (!confirm(`Restart session "${s.name}" on Wasender?`)) return;
    setActionBusy(s.id);
    try {
      await api.restartSession(s.id);
      await refresh();
    } catch (e) {
      setError(String(e));
    } finally {
      setActionBusy(null);
    }
  }

  async function handleDisconnect(s: SessionRow) {
    if (!confirm(`Disconnect WhatsApp number for "${s.name}"?`)) return;
    setActionBusy(s.id);
    try {
      await api.disconnectSession(s.id);
      await refresh();
    } catch (e) {
      setError(String(e));
    } finally {
      setActionBusy(null);
    }
  }

  function copyWebhook(id: number, providerSessionId: string) {
    const url = `${window.location.origin}/webhooks/wasender/${providerSessionId}`;
    void navigator.clipboard.writeText(url);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  return (
    <main className="page">
      <header className="page-header">
        <div>
          <h1>WhatsApp sessions</h1>
          <p className="page-subtitle">
            Numbers that send and receive on your behalf. Connect your WhatsApp numbers via in-app
            QR code scanning.
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setCreating(true)}>
          Add session
        </button>
      </header>

      {error && (
        <div className="error-banner" role="alert">
          {error}
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
          <p>Add a session, then scan the in-app QR code with WhatsApp.</p>
          <button className="btn btn-primary" onClick={() => setCreating(true)}>
            Add your first session
          </button>
        </div>
      )}

      {sessions !== null && sessions.length > 0 && (
        <ul role="list" className="card" style={{ listStyle: "none", margin: 0, padding: 0 }}>
          {sessions.map((s) => {
            const isConnected = s.status === "connected";
            const isConnecting = s.status === "connecting" || s.status === "need_scan";
            const isBusy = actionBusy === s.id;

            return (
              <li key={s.id} className="wf-row" style={{ display: "block", padding: "1.25rem" }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.75rem",
                    flexWrap: "wrap",
                  }}
                >
                  <span style={{ fontWeight: 600, fontSize: "1.0625rem" }}>{s.name}</span>
                  <span
                    className={`pill ${
                      isConnected ? "pill-active" : isConnecting ? "pill-draft" : "pill-session"
                    }`}
                  >
                    <span className="pill-dot" aria-hidden />
                    {s.status.toUpperCase()}
                  </span>
                  <span style={{ color: "var(--muted)", fontSize: "0.8125rem" }}>
                    ID: {s.providerSessionId}
                  </span>
                  <span style={{ flex: 1 }} />

                  {/* Actions */}
                  {!isConnected ? (
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={() => setQrSession(s)}
                      disabled={isBusy}
                    >
                      Connect / QR Code
                    </button>
                  ) : (
                    <>
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => void handleRestart(s)}
                        disabled={isBusy}
                        title="Restart connection on Wasender"
                      >
                        {isBusy ? "Restarting…" : "Restart"}
                      </button>
                      <button
                        className="btn btn-ghost btn-danger btn-sm"
                        onClick={() => void handleDisconnect(s)}
                        disabled={isBusy}
                        title="Disconnect WhatsApp connection"
                      >
                        Disconnect
                      </button>
                    </>
                  )}

                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => void handleCheckStatus(s)}
                    disabled={isBusy}
                    title="Refresh status from Wasender"
                  >
                    Sync
                  </button>

                  <button
                    className="btn btn-ghost btn-danger btn-sm"
                    aria-label={`Delete session ${s.name}`}
                    onClick={() => setDeleting(s)}
                    disabled={isBusy}
                  >
                    Delete
                  </button>
                </div>

                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.5rem",
                    color: "var(--muted)",
                    fontSize: "0.8125rem",
                    marginTop: "0.75rem",
                    background: "var(--surface-sunken)",
                    padding: "0.375rem 0.625rem",
                    borderRadius: "var(--radius-sm)",
                  }}
                >
                  <span style={{ fontWeight: 500 }}>Webhook URL:</span>
                  <code style={{ fontSize: "0.75rem", flex: 1, wordBreak: "break-all" }}>
                    {`${window.location.origin}/webhooks/wasender/${s.providerSessionId}`}
                  </code>
                  <button
                    className="btn btn-ghost btn-sm"
                    style={{ padding: "0.125rem 0.5rem", fontSize: "0.75rem" }}
                    onClick={() => copyWebhook(s.id, s.providerSessionId)}
                  >
                    {copiedId === s.id ? "✓ Copied" : "Copy"}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {/* QR Code Modal */}
      <Dialog
        open={qrSession !== null}
        onClose={() => {
          setQrSession(null);
          void refresh();
        }}
        labelledBy="qr-modal-title"
      >
        {qrSession && (
          <QrCodeModal
            session={qrSession}
            onConnected={() => {
              setQrSession(null);
              void refresh();
            }}
            onClose={() => {
              setQrSession(null);
              void refresh();
            }}
          />
        )}
      </Dialog>

      {/* Create session */}
      <Dialog open={creating} onClose={() => setCreating(false)} labelledBy="create-session-title">
        <CreateSessionForm
          onCancel={() => setCreating(false)}
          onCreated={(created) => {
            setCreating(false);
            void refresh();
            if (created) {
              setQrSession({
                id: created.id,
                name: created.name,
                providerSessionId: created.providerSessionId,
                status: created.status,
              });
            }
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

function QrCodeModal({
  session,
  onConnected,
  onClose,
}: {
  session: SessionRow;
  onConnected: () => void;
  onClose: () => void;
}) {
  const [qrSvg, setQrSvg] = useState<string | null>(null);
  const [status, setStatus] = useState<string>(session.status);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let pollTimer: ReturnType<typeof setInterval>;

    async function loadQr() {
      setLoading(true);
      setError(null);
      try {
        // First initialize connection
        await api.connectSession(session.id).catch(() => {});

        // Fetch QR code string
        const res = await api.getSessionQr(session.id);
        if (cancelled) return;

        if (res.qrCode) {
          const svgString = await QRCode.toString(res.qrCode, {
            type: "svg",
            margin: 2,
            width: 240,
          });
          if (!cancelled) setQrSvg(svgString);
        } else {
          setError("QR code not ready yet. Please try again in a few seconds.");
        }
      } catch (err) {
        if (!cancelled) setError("Failed to load QR code. Ensure Wasender PAT is active.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadQr();

    // Poll status every 3 seconds
    pollTimer = setInterval(async () => {
      try {
        const s = await api.getSessionStatus(session.id);
        if (cancelled) return;
        setStatus(s.status);
        if (s.status === "connected") {
          clearInterval(pollTimer);
          setTimeout(onConnected, 1200);
        }
      } catch {}
    }, 3000);

    return () => {
      cancelled = true;
      clearInterval(pollTimer);
    };
  }, [session.id, onConnected]);

  return (
    <div className="modal-body" style={{ textAlign: "center" }}>
      <p className="modal-title" id="qr-modal-title">
        Connect “{session.name}”
      </p>
      <p className="page-subtitle" style={{ margin: "0.25rem 0 1rem" }}>
        Scan this QR code with WhatsApp on your phone.
      </p>

      <div
        style={{
          minHeight: 240,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          margin: "1rem auto",
        }}
      >
        {loading && <div className="skeleton" style={{ width: 240, height: 240 }} />}

        {error && !loading && (
          <div className="error-banner" style={{ display: "block" }}>
            <p style={{ margin: 0 }}>{error}</p>
          </div>
        )}

        {qrSvg && !loading && status !== "connected" && (
          <div
            style={{
              padding: "0.75rem",
              background: "#fff",
              borderRadius: "var(--radius-md)",
              boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
              display: "inline-block",
            }}
            dangerouslySetInnerHTML={{ __html: qrSvg }}
          />
        )}

        {status === "connected" && (
          <div style={{ padding: "2rem 1rem" }}>
            <div style={{ fontSize: "3rem" }}>🎉</div>
            <h3 style={{ margin: "0.5rem 0", color: "var(--accent)" }}>Connected!</h3>
            <p style={{ color: "var(--muted)", margin: 0 }}>WhatsApp session is now active.</p>
          </div>
        )}
      </div>

      <div
        style={{
          background: "var(--surface-sunken)",
          padding: "0.75rem",
          borderRadius: "var(--radius-sm)",
          fontSize: "0.8125rem",
          color: "var(--muted)",
          textAlign: "left",
          margin: "1rem 0",
        }}
      >
        <ol style={{ margin: 0, paddingLeft: "1.25rem" }}>
          <li>Open WhatsApp on your mobile phone</li>
          <li>Go to Settings &gt; Linked Devices</li>
          <li>Tap Link a Device and point camera at the QR code</li>
        </ol>
      </div>

      <div className="modal-actions">
        <button type="button" className="btn" onClick={onClose}>
          {status === "connected" ? "Done" : "Close"}
        </button>
      </div>
    </div>
  );
}

function CreateSessionForm({
  onCancel,
  onCreated,
}: {
  onCancel: () => void;
  onCreated: (created?: {
    id: number;
    providerSessionId: string;
    name: string;
    status: string;
  }) => void;
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
      const created = await api.createSession(trimmed);
      onCreated({
        id: created.id,
        providerSessionId: created.providerSessionId,
        name: trimmed,
        status: "disconnected",
      });
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
        <button type="button" className="btn" onClick={() => onCancel()}>
          Cancel
        </button>
        <button type="submit" className="btn btn-primary" disabled={!name.trim() || busy}>
          {busy ? "Creating…" : "Create & Connect"}
        </button>
      </div>
    </form>
  );
}

import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { api, type SessionItem, type DiscoveredPhone } from "./api.js";
import { Dialog } from "./ui.js";

type SessionRow = SessionItem;

export function SessionsPage() {
  const [sessions, setSessions] = useState<SessionRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [editingSession, setEditingSession] = useState<SessionRow | null>(null);
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

  async function handleSyncWebhook(s: SessionRow) {
    setActionBusy(s.id);
    try {
      const targetUrl =
        s.webhookUrl ||
        (s.provider === "periskope"
          ? `${window.location.origin}/webhooks/periskope`
          : `${window.location.origin}/webhooks/wasender/${s.providerSessionId}`);
      await api.syncSessionWebhook(s.id, targetUrl);
      const providerLabel = s.provider === "periskope" ? "Periskope" : "Wasender";
      alert(`Webhook auto-configured successfully on ${providerLabel} for "${s.name}"!`);
    } catch (e) {
      alert(`Failed to auto-configure webhook: ${e}`);
    } finally {
      setActionBusy(null);
    }
  }

  function copyWebhook(id: number, url: string) {
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
            const isPeriskope = s.provider === "periskope";
            const webhookUrl =
              s.webhookUrl ||
              (isPeriskope
                ? `${window.location.origin}/webhooks/periskope`
                : `${window.location.origin}/webhooks/wasender/${s.providerSessionId}`);

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
                  <span
                    className="pill"
                    style={{
                      background: isPeriskope ? "rgba(99, 102, 241, 0.15)" : "rgba(16, 185, 129, 0.15)",
                      color: isPeriskope ? "var(--primary-focus, #6366f1)" : "var(--accent, #10b981)",
                      fontWeight: 600,
                    }}
                  >
                    {isPeriskope ? "Periskope" : "Wasender"}
                  </span>
                  {s.providerConfig?.keyType === "individual" ? (
                    <span
                      className="pill"
                      style={{
                        background: "rgba(245, 158, 11, 0.15)",
                        color: "#f59e0b",
                        fontSize: "0.75rem",
                        fontWeight: 600,
                      }}
                      title="Single-number dedicated API key"
                    >
                      Individual Key
                    </span>
                  ) : (
                    <span
                      className="pill"
                      style={{
                        background: "rgba(6, 182, 212, 0.15)",
                        color: "#06b6d4",
                        fontSize: "0.75rem",
                        fontWeight: 600,
                      }}
                      title="Multi-number account/organization API key"
                    >
                      Multi-Number
                    </span>
                  )}
                  <span style={{ color: "var(--muted)", fontSize: "0.8125rem" }}>
                    {isPeriskope ? `Phone: ${s.providerSessionId}` : `ID: ${s.providerSessionId}`}
                  </span>
                  {s.apiKeyMasked && (
                    <span
                      style={{
                        color: "var(--muted)",
                        fontSize: "0.8125rem",
                        background: "var(--surface-sunken)",
                        padding: "0.125rem 0.375rem",
                        borderRadius: "var(--radius-sm)",
                      }}
                      title="Masked provider API key"
                    >
                      🔑 {s.apiKeyMasked}
                    </span>
                  )}
                  <span style={{ flex: 1 }} />

                  {/* Actions */}
                  {!isConnected ? (
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={() => setQrSession(s)}
                      disabled={isBusy}
                    >
                      {isPeriskope ? "Check / Connect" : "Connect / QR Code"}
                    </button>
                  ) : (
                    <>
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => void handleRestart(s)}
                        disabled={isBusy}
                        title={`Restart connection on ${isPeriskope ? "Periskope" : "Wasender"}`}
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
                    onClick={() => setEditingSession(s)}
                    disabled={isBusy}
                    title="Edit session details & API key"
                  >
                    Edit
                  </button>

                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => void handleCheckStatus(s)}
                    disabled={isBusy}
                    title="Refresh status from provider"
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
                    {webhookUrl}
                  </code>
                  <button
                    className="btn btn-ghost btn-sm"
                    style={{ padding: "0.125rem 0.5rem", fontSize: "0.75rem" }}
                    onClick={() => copyWebhook(s.id, webhookUrl)}
                  >
                    {copiedId === s.id ? "✓ Copied" : "Copy"}
                  </button>
                  <button
                    className="btn btn-primary btn-sm"
                    style={{ padding: "0.125rem 0.5rem", fontSize: "0.75rem" }}
                    disabled={actionBusy === s.id}
                    onClick={() => void handleSyncWebhook(s)}
                    title={`Auto-register this webhook URL in ${isPeriskope ? "Periskope" : "Wasender"}`}
                  >
                    {actionBusy === s.id
                      ? "Configuring…"
                      : isPeriskope
                      ? "⚡ Auto-Set in Periskope"
                      : "⚡ Auto-Set in Wasender"}
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
            if (created && created.provider !== "periskope") {
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

      {/* Edit session */}
      <Dialog
        open={editingSession !== null}
        onClose={() => setEditingSession(null)}
        labelledBy="edit-session-title"
      >
        {editingSession && (
          <EditSessionModal
            session={editingSession}
            onCancel={() => setEditingSession(null)}
            onSaved={() => {
              setEditingSession(null);
              void refresh();
            }}
          />
        )}
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
  onCreated: (created?: SessionItem) => void;
}) {
  const [provider, setProvider] = useState<"wasender" | "periskope">("periskope");
  const [keyType, setKeyType] = useState<"multi_number" | "individual">("multi_number");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [individualApiKey, setIndividualApiKey] = useState("");
  const [webhookSecret, setWebhookSecret] = useState("");
  const [fetchingPhones, setFetchingPhones] = useState(false);
  const [discoveredPhones, setDiscoveredPhones] = useState<DiscoveredPhone[]>([]);
  const [selectedPhoneIndex, setSelectedPhoneIndex] = useState<number>(-1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 0);
  }, [provider, keyType]);

  async function fetchPhones() {
    if (!apiKey.trim()) {
      setError(
        provider === "periskope"
          ? "Please enter your Periskope Organization API Key first to fetch connected numbers."
          : "Please enter your Wasender Account PAT first to fetch numbers.",
      );
      return;
    }
    setError(null);
    setFetchingPhones(true);
    try {
      const res = await api.listProviderPhones(provider, apiKey.trim());
      setDiscoveredPhones(res.phones);
      if (res.phones.length > 0) {
        setSelectedPhoneIndex(0);
        const p0 = res.phones[0];
        setPhone(p0.phone);
        if (!name) setName(p0.phoneName || `WhatsApp ${p0.phone}`);
        if (p0.apiKey) setIndividualApiKey(p0.apiKey);
      } else {
        setError(`No connected numbers found for this ${provider === "periskope" ? "Periskope" : "Wasender"} account.`);
      }
    } catch (err) {
      setError(`Could not fetch numbers: ${err}`);
    } finally {
      setFetchingPhones(false);
    }
  }

  function handleSelectPhone(index: number) {
    setSelectedPhoneIndex(index);
    const p = discoveredPhones[index];
    if (p) {
      setPhone(p.phone);
      setName(p.phoneName || `WhatsApp ${p.phone}`);
      if (p.apiKey) setIndividualApiKey(p.apiKey);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName || busy) return;
    setError(null);
    setBusy(true);

    try {
      const activeKey = keyType === "individual"
        ? (individualApiKey.trim() || apiKey.trim())
        : (individualApiKey.trim() || apiKey.trim());

      const isDiscoveredReady = selectedPhoneIndex >= 0 && Boolean(discoveredPhones[selectedPhoneIndex]?.isReady);

      const created = await api.createSession({
        name: trimmedName,
        provider,
        phone: phone.trim() || undefined,
        apiKey: activeKey || undefined,
        webhookSecret: webhookSecret.trim() || undefined,
        status: isDiscoveredReady ? "connected" : undefined,
        providerConfig: {
          keyType,
          orgPhone: phone.trim(),
          multiNumberKey: keyType === "multi_number" ? apiKey.trim() : undefined,
        },
      });
      onCreated(created);
    } catch (err) {
      setError(String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="modal-body" onSubmit={submit}>
      <p className="modal-title">Add a WhatsApp session</p>
      <p className="page-subtitle" style={{ margin: "0.25rem 0 1rem" }}>
        Configure single-number or multi-number sessions across Wasender and Periskope.
      </p>

      {error && (
        <div className="error-banner" style={{ marginBottom: "1rem" }}>
          {error}
        </div>
      )}

      {/* Provider Selector Tabs */}
      <div
        style={{
          display: "flex",
          gap: "0.5rem",
          background: "var(--surface-sunken)",
          padding: "0.25rem",
          borderRadius: "var(--radius-sm)",
          marginBottom: "1rem",
        }}
      >
        <button
          type="button"
          className={`btn btn-sm ${provider === "periskope" ? "btn-primary" : "btn-ghost"}`}
          style={{ flex: 1 }}
          onClick={() => {
            setProvider("periskope");
            setDiscoveredPhones([]);
            setSelectedPhoneIndex(-1);
          }}
        >
          Periskope
        </button>
        <button
          type="button"
          className={`btn btn-sm ${provider === "wasender" ? "btn-primary" : "btn-ghost"}`}
          style={{ flex: 1 }}
          onClick={() => {
            setProvider("wasender");
            setDiscoveredPhones([]);
            setSelectedPhoneIndex(-1);
          }}
        >
          Wasender
        </button>
      </div>

      {/* Key Scope: Multi-Number (Org/Account Key) vs Individual Per-Number Key */}
      <div style={{ marginBottom: "1rem" }}>
        <label className="field-label" style={{ marginBottom: "0.375rem" }}>
          API Key Type
        </label>
        <div
          style={{
            display: "flex",
            gap: "0.5rem",
            background: "var(--surface-sunken)",
            padding: "0.25rem",
            borderRadius: "var(--radius-sm)",
          }}
        >
          <button
            type="button"
            className={`btn btn-sm ${keyType === "multi_number" ? "btn-primary" : "btn-ghost"}`}
            style={{ flex: 1, fontSize: "0.8125rem" }}
            onClick={() => setKeyType("multi_number")}
          >
            🏢 Multi-Number (Account Key)
          </button>
          <button
            type="button"
            className={`btn btn-sm ${keyType === "individual" ? "btn-primary" : "btn-ghost"}`}
            style={{ flex: 1, fontSize: "0.8125rem" }}
            onClick={() => setKeyType("individual")}
          >
            📱 Individual (Single Number Key)
          </button>
        </div>
      </div>

      {/* Mode A: Multi-Number Account Key with Auto-Discovery */}
      {keyType === "multi_number" && (
        <div
          style={{
            background: "var(--surface-sunken)",
            border: "1px solid var(--border-subtle, rgba(255,255,255,0.08))",
            padding: "0.875rem",
            borderRadius: "var(--radius-sm)",
            marginBottom: "1rem",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.375rem" }}>
            <label className="field-label" htmlFor="multi-account-key" style={{ margin: 0 }}>
              {provider === "periskope" ? "Periskope Organization API Key" : "Wasender Account PAT"}
            </label>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              style={{ fontSize: "0.75rem", fontWeight: 600 }}
              disabled={fetchingPhones || !apiKey.trim()}
              onClick={fetchPhones}
            >
              {fetchingPhones ? "Fetching…" : "🔍 Discover Numbers"}
            </button>
          </div>
          <input
            id="multi-account-key"
            type="text"
            className="input"
            placeholder={provider === "periskope" ? "sk_periskope_... or prsk_..." : "wasender_pat_..."}
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            required
          />

          {discoveredPhones.length > 0 && (
            <div style={{ marginTop: "0.75rem" }}>
              <label className="field-label" htmlFor="discovered-number-select">
                Select Connected Number ({discoveredPhones.length} found)
              </label>
              <select
                id="discovered-number-select"
                className="input"
                value={selectedPhoneIndex}
                onChange={(e) => handleSelectPhone(Number(e.target.value))}
              >
                {discoveredPhones.map((p, idx) => (
                  <option key={p.phone || idx} value={idx}>
                    {p.phoneName ? `${p.phoneName} — ` : ""}{p.phone} ({p.status || "READY"})
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      )}

      {/* Session Name */}
      <label className="field-label" htmlFor="session-name">
        Session Name
      </label>
      <input
        ref={inputRef}
        id="session-name"
        className="input"
        placeholder='e.g. "Dubai Sales Desk"'
        value={name}
        onChange={(e) => setName(e.target.value)}
        required
      />

      {/* Mode B: Individual Per-Number Key */}
      {keyType === "individual" && (
        <>
          <label className="field-label" htmlFor="individual-api-key" style={{ marginTop: "0.75rem" }}>
            {provider === "periskope" ? "Periskope Dedicated Phone API Key" : "Wasender Session API Key"}
          </label>
          <input
            id="individual-api-key"
            type="text"
            className="input"
            placeholder="Paste individual API key for this specific number..."
            value={individualApiKey}
            onChange={(e) => setIndividualApiKey(e.target.value)}
            required
          />

          <label className="field-label" htmlFor="phone-number" style={{ marginTop: "0.75rem" }}>
            WhatsApp Phone Number (with country code)
          </label>
          <input
            id="phone-number"
            className="input"
            placeholder="+1234567890"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            required
          />
        </>
      )}

      {/* Phone Number Display / Edit for Multi-Number Mode */}
      {keyType === "multi_number" && (
        <>
          <label className="field-label" htmlFor="bound-phone" style={{ marginTop: "0.75rem" }}>
            Assigned Phone Number
          </label>
          <input
            id="bound-phone"
            className="input"
            placeholder={provider === "periskope" ? "+1234567890" : "Auto-detected or enter manually"}
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            required={provider === "periskope"}
          />
        </>
      )}

      {/* Webhook Secret */}
      <label className="field-label" htmlFor="session-webhook-secret" style={{ marginTop: "0.75rem" }}>
        Webhook Signing Secret (Optional HMAC verification)
      </label>
      <input
        id="session-webhook-secret"
        type="text"
        className="input"
        placeholder="whsec_..."
        value={webhookSecret}
        onChange={(e) => setWebhookSecret(e.target.value)}
      />

      <div className="modal-actions" style={{ marginTop: "1.25rem" }}>
        <button type="button" className="btn" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="btn btn-primary" disabled={!name.trim() || busy}>
          {busy ? "Saving…" : "Save & Connect Session"}
        </button>
      </div>
    </form>
  );
}

function EditSessionModal({
  session,
  onCancel,
  onSaved,
}: {
  session: SessionRow;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(session.name);
  const [keyType, setKeyType] = useState<"multi_number" | "individual">(
    session.providerConfig?.keyType === "individual" ? "individual" : "multi_number"
  );
  const [apiKey, setApiKey] = useState("");
  const [phone, setPhone] = useState(session.providerSessionId || "");
  const [webhookSecret, setWebhookSecret] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || busy) return;
    setError(null);
    setBusy(true);

    try {
      await api.patchSession(session.id, {
        name: name.trim(),
        providerSessionId: phone.trim() || undefined,
        apiKey: apiKey.trim() || undefined,
        webhookSecret: webhookSecret.trim() || undefined,
        providerConfig: {
          ...(session.providerConfig || {}),
          keyType,
          orgPhone: phone.trim(),
        },
      });
      onSaved();
    } catch (err) {
      setError(String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="modal-body" onSubmit={submit}>
      <p className="modal-title">Edit Session</p>
      <p className="page-subtitle" style={{ margin: "0.25rem 0 1rem" }}>
        Update credentials or session settings. Active workflows remain unaffected.
      </p>

      {error && (
        <div className="error-banner" style={{ marginBottom: "1rem" }}>
          {error}
        </div>
      )}

      {/* Key Scope */}
      <div style={{ marginBottom: "1rem" }}>
        <label className="field-label" style={{ marginBottom: "0.375rem" }}>
          API Key Scope
        </label>
        <div
          style={{
            display: "flex",
            gap: "0.5rem",
            background: "var(--surface-sunken)",
            padding: "0.25rem",
            borderRadius: "var(--radius-sm)",
          }}
        >
          <button
            type="button"
            className={`btn btn-sm ${keyType === "multi_number" ? "btn-primary" : "btn-ghost"}`}
            style={{ flex: 1, fontSize: "0.8125rem" }}
            onClick={() => setKeyType("multi_number")}
          >
            🏢 Multi-Number Key
          </button>
          <button
            type="button"
            className={`btn btn-sm ${keyType === "individual" ? "btn-primary" : "btn-ghost"}`}
            style={{ flex: 1, fontSize: "0.8125rem" }}
            onClick={() => setKeyType("individual")}
          >
            📱 Individual Per-Number Key
          </button>
        </div>
      </div>

      <label className="field-label" htmlFor="edit-session-name">
        Session Name
      </label>
      <input
        id="edit-session-name"
        className="input"
        value={name}
        onChange={(e) => setName(e.target.value)}
        required
      />

      <label className="field-label" htmlFor="edit-session-phone" style={{ marginTop: "0.75rem" }}>
        Phone Number / Identifier
      </label>
      <input
        id="edit-session-phone"
        className="input"
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        required
      />

      <label className="field-label" htmlFor="edit-session-api-key" style={{ marginTop: "0.75rem" }}>
        Update API Key {session.apiKeyMasked && `(Current: ${session.apiKeyMasked})`}
      </label>
      <input
        id="edit-session-api-key"
        type="text"
        className="input"
        placeholder="Leave blank to keep existing key"
        value={apiKey}
        onChange={(e) => setApiKey(e.target.value)}
      />

      <label className="field-label" htmlFor="edit-session-secret" style={{ marginTop: "0.75rem" }}>
        Update Webhook Secret {session.webhookSecretMasked && `(Current: ${session.webhookSecretMasked})`}
      </label>
      <input
        id="edit-session-secret"
        type="text"
        className="input"
        placeholder="Leave blank to keep existing secret"
        value={webhookSecret}
        onChange={(e) => setWebhookSecret(e.target.value)}
      />

      <div className="modal-actions" style={{ marginTop: "1.25rem" }}>
        <button type="button" className="btn" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="btn btn-primary" disabled={busy || !name.trim()}>
          {busy ? "Saving…" : "Save Changes"}
        </button>
      </div>
    </form>
  );
}

import { useCallback, useEffect, useState } from "react";
import { api, type ChatMessage, type Conversation } from "./api.js";
import { Dialog } from "./ui.js";

export function InboxPage() {
  const [conversations, setConversations] = useState<Conversation[] | null>(null);
  const [selected, setSelected] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [simulating, setSimulating] = useState(false);

  const loadConversations = useCallback(async () => {
    try {
      const list = await api.conversations();
      setConversations(list);
      setError(null);
      return list;
    } catch (e) {
      setError(String(e));
      return [];
    }
  }, []);

  useEffect(() => {
    void loadConversations();
    const t = setInterval(() => void loadConversations(), 8_000); // light live refresh
    return () => clearInterval(t);
  }, [loadConversations]);

  useEffect(() => {
    if (!selected) return;
    void api.messages(selected.contactId).then(setMessages);
    const msgTimer = setInterval(() => {
      void api.messages(selected.contactId).then(setMessages);
    }, 4_000);
    return () => clearInterval(msgTimer);
  }, [selected]);

  async function select(c: Conversation) {
    setSelected(c);
    await loadConversations();
    setMessages(await api.messages(c.contactId));
  }

  return (
    <main className="inbox-page">
      <header
        className="page-header"
        style={{ padding: "1.5rem 1.25rem 0", maxWidth: 960, marginInline: "auto" }}
      >
        <div>
          <h1>Inbox & Attribution</h1>
          <p className="page-subtitle">
            Live WhatsApp message threads with automated workflow and experiment attribution.
          </p>
        </div>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <button className="btn btn-sm btn-primary" onClick={() => setSimulating(true)}>
            Simulate Message
          </button>
          <button className="btn btn-sm" onClick={() => void loadConversations()}>
            Refresh
          </button>
        </div>
      </header>

      {error && (
        <div style={{ maxWidth: 960, margin: "1rem auto 0", padding: "0 1.25rem" }}>
          <div className="error-banner" role="alert">
            Couldn't load conversations.
          </div>
        </div>
      )}

      {conversations !== null && conversations.length === 0 && (
        <div
          className="card empty-state"
          style={{ maxWidth: 960, margin: "1rem auto", padding: "4rem 1rem" }}
        >
          <div className="empty-state-icon" aria-hidden>
            📭
          </div>
          <h2>No conversations yet</h2>
          <p>Incoming WhatsApp messages will appear here once a session receives one.</p>
          <button
            className="btn btn-primary"
            style={{ marginTop: "1rem" }}
            onClick={() => setSimulating(true)}
          >
            Simulate a test message
          </button>
        </div>
      )}

      {conversations !== null && conversations.length > 0 && (
        <div className="inbox-layout">
          <ul role="list" className="card convo-list">
            {conversations.map((c) => (
              <li key={c.contactId}>
                <button
                  className={`convo-item ${
                    selected?.contactId === c.contactId ? "convo-item-active" : ""
                  }`}
                  onClick={() => void select(c)}
                >
                  <span className="convo-name">{c.name || c.phone}</span>
                  <span className="convo-preview">{c.lastMessage ?? "…"}</span>
                </button>
              </li>
            ))}
          </ul>

          <section className="card thread" aria-label="Message thread">
            {!selected ? (
              <p className="thread-placeholder">Select a conversation to read it.</p>
            ) : (
              <>
                <div className="thread-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span>{selected.name || selected.phone}</span>
                  <button
                    className="btn btn-ghost btn-sm"
                    style={{ fontSize: "0.75rem" }}
                    onClick={() => void api.messages(selected.contactId).then(setMessages)}
                  >
                    Sync
                  </button>
                </div>
                <div className="thread-body">
                  {messages.length === 0 && (
                    <p className="thread-placeholder">No messages in this thread.</p>
                  )}
                  {messages.map((m) => {
                    const isOut = m.direction === "out";

                    return (
                      <div key={m.id} className={`bubble-row ${isOut ? "bubble-out" : ""}`}>
                        <div
                          className={`bubble ${isOut ? "bubble-mine" : "bubble-theirs"}`}
                          style={{ maxWidth: "80%" }}
                        >
                          {/* Metadata badge for outbound messages from workflows */}
                          {isOut && m.workflowName && (
                            <div
                              style={{
                                fontSize: "0.6875rem",
                                fontWeight: 600,
                                opacity: 0.85,
                                marginBottom: "0.25rem",
                                display: "flex",
                                alignItems: "center",
                                gap: "0.375rem",
                                flexWrap: "wrap",
                              }}
                            >
                              <span>⚡ {m.workflowName}</span>
                              {m.experimentName && <span>🧪 {m.experimentName}</span>}
                            </div>
                          )}

                          {/* Attribution badge for inbound replies */}
                          {!isOut && m.repliedWorkflowName && (
                            <div
                              style={{
                                fontSize: "0.6875rem",
                                fontWeight: 600,
                                color: "var(--accent)",
                                background: "var(--surface-sunken)",
                                padding: "0.125rem 0.375rem",
                                borderRadius: "4px",
                                marginBottom: "0.375rem",
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "0.25rem",
                              }}
                            >
                              <span>↩ Replied to: {m.repliedWorkflowName}</span>
                              {m.repliedExperimentName && <span>({m.repliedExperimentName})</span>}
                            </div>
                          )}

                          <div>{m.text ?? `[${m.messageType}]`}</div>

                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "flex-end",
                              gap: "0.25rem",
                              marginTop: "0.25rem",
                            }}
                          >
                            <span className="bubble-time">
                              {new Date(m.timestamp).toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </span>
                            {isOut && <span style={{ fontSize: "0.6875rem" }}>✓</span>}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </section>
        </div>
      )}

      {/* Workflow Simulator Modal */}
      <Dialog
        open={simulating}
        onClose={() => setSimulating(false)}
        labelledBy="sim-modal-title"
      >
        <SimulatorModal
          onClose={() => setSimulating(false)}
          onSuccess={async (contactId) => {
            setSimulating(false);
            const list = await loadConversations();
            const target = list.find((c) => c.contactId === contactId);
            if (target) {
              setSelected(target);
              setMessages(await api.messages(target.contactId));
            }
          }}
        />
      </Dialog>
    </main>
  );
}

function SimulatorModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: (contactId: number) => Promise<void>;
}) {
  const [phone, setPhone] = useState("+1234567890");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ matched: boolean; executionId?: number } | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim() || busy) return;
    setBusy(true);
    try {
      const res = await api.simulateMessage({
        phone: phone.trim(),
        text: text.trim(),
      });
      setResult(res);
      setTimeout(() => {
        void onSuccess(res.contactId);
      }, 1000);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="modal-body" onSubmit={handleSubmit}>
      <p className="modal-title" id="sim-modal-title">
        Simulate Inbound Message
      </p>
      <p className="page-subtitle" style={{ margin: "0.25rem 0 1.25rem" }}>
        Simulates an incoming WhatsApp webhook message to test keyword triggers, automated workflow
        replies, and attribution.
      </p>

      <label className="field-label" htmlFor="sim-phone">
        Sender Phone Number
      </label>
      <input
        id="sim-phone"
        className="input"
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        required
      />

      <label className="field-label" htmlFor="sim-text" style={{ marginTop: "0.75rem" }}>
        Incoming Message Text
      </label>
      <textarea
        id="sim-text"
        className="textarea"
        rows={3}
        placeholder='e.g. "I want to know the pricing"'
        value={text}
        onChange={(e) => setText(e.target.value)}
        required
      />

      {result && (
        <div
          style={{
            marginTop: "0.75rem",
            padding: "0.625rem",
            borderRadius: "var(--radius-sm)",
            background: result.matched ? "var(--accent-soft)" : "var(--surface-sunken)",
            fontSize: "0.8125rem",
            color: result.matched ? "var(--accent)" : "var(--muted)",
          }}
        >
          {result.matched
            ? `✓ Matched active workflow! Execution #${result.executionId} started.`
            : "ℹ Message stored, no active workflow matched keywords."}
        </div>
      )}

      <div className="modal-actions">
        <button type="button" className="btn" onClick={onClose}>
          Cancel
        </button>
        <button type="submit" className="btn btn-primary" disabled={!text.trim() || busy}>
          {busy ? "Sending…" : "Send Simulated Message"}
        </button>
      </div>
    </form>
  );
}

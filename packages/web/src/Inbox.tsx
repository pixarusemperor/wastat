import { useCallback, useEffect, useState } from "react";
import { api, type ChatMessage, type Conversation } from "./api.js";
import { Dialog } from "./ui.js";

export function InboxPage() {
  const [conversations, setConversations] = useState<Conversation[] | null>(null);
  const [selected, setSelected] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [simulating, setSimulating] = useState(false);

  // Customer 360 & Private Notes state
  const [activeTab, setActiveTab] = useState<"messages" | "notes">("messages");
  const [contactProfile, setContactProfile] = useState<{
    id: number;
    phone: string;
    name: string | null;
    funnelPhase: string;
    botStatus: string;
    botPausedUntil: string | null;
    attributes: Record<string, { value: string; updatedAt: string }>;
    tags: string[];
  } | null>(null);
  const [notes, setNotes] = useState<Array<{ id: number; contactId: number; author: string; body: string; createdAt: string }>>([]);
  const [newNote, setNewNote] = useState("");
  const [manualText, setManualText] = useState("");
  const [sendingManual, setSendingManual] = useState(false);

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

  const loadSelectedDetails = useCallback(async (contactId: number) => {
    try {
      const [msgList, profile, noteList] = await Promise.all([
        api.messages(contactId),
        api.getContact(contactId),
        api.listNotes(contactId),
      ]);
      setMessages(msgList);
      setContactProfile(profile);
      setNotes(noteList);
    } catch (err) {
      console.error(err);
    }
  }, []);

  useEffect(() => {
    if (!selected) return;
    void loadSelectedDetails(selected.contactId);
    const msgTimer = setInterval(() => {
      void loadSelectedDetails(selected.contactId);
    }, 4_000);
    return () => clearInterval(msgTimer);
  }, [selected, loadSelectedDetails]);

  async function select(c: Conversation) {
    setSelected(c);
    await loadConversations();
    await loadSelectedDetails(c.contactId);
  }

  async function toggleBotStatus() {
    if (!selected || !contactProfile) return;
    const newStatus = contactProfile.botStatus === "paused_human" ? "active" : "paused_human";
    const res = await api.updateBotStatus(selected.contactId, newStatus);
    setContactProfile((prev) => prev ? { ...prev, botStatus: res.botStatus, botPausedUntil: res.botPausedUntil } : null);
  }

  async function handleAdvancePhase() {
    if (!selected) return;
    const res = await api.advancePhase(selected.contactId);
    setContactProfile((prev) => prev ? { ...prev, funnelPhase: res.funnelPhase, botStatus: "active" } : null);
    await loadSelectedDetails(selected.contactId);
  }

  async function handleAddNote(e: React.FormEvent) {
    e.preventDefault();
    if (!selected || !newNote.trim()) return;
    await api.createNote(selected.contactId, newNote.trim());
    setNewNote("");
    setNotes(await api.listNotes(selected.contactId));
  }

  async function handleSendManual(e: React.FormEvent) {
    e.preventDefault();
    if (!selected || !manualText.trim() || sendingManual) return;
    setSendingManual(true);
    try {
      await api.sendManualMessage(selected.contactId, manualText.trim());
      setManualText("");
      await loadSelectedDetails(selected.contactId);
    } finally {
      setSendingManual(false);
    }
  }

  return (
    <main className="inbox-page">
      <header
        className="page-header"
        style={{ padding: "1.5rem 1.25rem 0", maxWidth: 1200, marginInline: "auto" }}
      >
        <div>
          <h1>Inbox & Customer 360</h1>
          <p className="page-subtitle">
            Live WhatsApp message threads with automated workflow attribution, Customer 360 attributes, private team notes, and human takeover guard.
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
        <div style={{ maxWidth: 1200, margin: "1rem auto 0", padding: "0 1.25rem" }}>
          <div className="error-banner" role="alert">
            Couldn't load conversations.
          </div>
        </div>
      )}

      {conversations !== null && conversations.length === 0 && (
        <div
          className="card empty-state"
          style={{ maxWidth: 1200, margin: "1rem auto", padding: "4rem 1rem" }}
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
        <div className="inbox-layout" style={{ maxWidth: 1200, margin: "1rem auto", display: "grid", gridTemplateColumns: "280px 1fr 300px", gap: "1rem", alignItems: "start" }}>
          {/* Conversation List */}
          <ul role="list" className="card convo-list" style={{ maxHeight: "calc(100vh - 200px)", overflowY: "auto" }}>
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

          {/* Main Thread & Notes */}
          <section className="card thread" aria-label="Message thread" style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 200px)" }}>
            {!selected ? (
              <p className="thread-placeholder">Select a conversation to read it.</p>
            ) : (
              <>
                <div className="thread-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--border)", padding: "0.75rem 1rem" }}>
                  <div>
                    <strong style={{ fontSize: "1rem" }}>{selected.name || selected.phone}</strong>
                    <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.25rem" }}>
                      <span className={`badge ${contactProfile?.botStatus === "paused_human" ? "badge-warning" : "badge-success"}`} style={{ fontSize: "0.6875rem" }}>
                        {contactProfile?.botStatus === "paused_human" ? "🛑 Bot Paused (Human Takeover)" : "🤖 Bot Active"}
                      </span>
                      <span className="badge badge-neutral" style={{ fontSize: "0.6875rem" }}>
                        Phase: {contactProfile?.funnelPhase ?? "unassigned"}
                      </span>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: "0.5rem" }}>
                    <div className="tab-group" style={{ display: "inline-flex", background: "var(--surface-sunken)", padding: "2px", borderRadius: "6px" }}>
                      <button
                        className={`btn btn-xs ${activeTab === "messages" ? "btn-primary" : "btn-ghost"}`}
                        onClick={() => setActiveTab("messages")}
                      >
                        💬 Messages
                      </button>
                      <button
                        className={`btn btn-xs ${activeTab === "notes" ? "btn-primary" : "btn-ghost"}`}
                        onClick={() => setActiveTab("notes")}
                      >
                        📝 Internal Notes ({notes.length})
                      </button>
                    </div>
                  </div>
                </div>

                {/* Tab: Messages */}
                {activeTab === "messages" && (
                  <>
                    <div className="thread-body" style={{ flex: 1, overflowY: "auto", padding: "1rem" }}>
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
                              {/* Metadata badge for outbound messages */}
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

                    {/* Manual Chat Input */}
                    <form onSubmit={handleSendManual} style={{ padding: "0.75rem 1rem", borderTop: "1px solid var(--border)", display: "flex", gap: "0.5rem" }}>
                      <input
                        className="input"
                        placeholder="Type manual reply (pauses bot for 24h)..."
                        value={manualText}
                        onChange={(e) => setManualText(e.target.value)}
                        style={{ flex: 1 }}
                      />
                      <button type="submit" className="btn btn-primary" disabled={!manualText.trim() || sendingManual}>
                        {sendingManual ? "Sending…" : "Send"}
                      </button>
                    </form>
                  </>
                )}

                {/* Tab: Private Team Notes */}
                {activeTab === "notes" && (
                  <div style={{ display: "flex", flexDirection: "column", height: "100%", padding: "1rem" }}>
                    <div style={{ flex: 1, overflowY: "auto" }}>
                      {notes.length === 0 && (
                        <p className="thread-placeholder">No internal notes for this contact yet.</p>
                      )}
                      {notes.map((n) => (
                        <div key={n.id} style={{ background: "var(--surface-sunken)", padding: "0.75rem", borderRadius: "6px", marginBottom: "0.5rem" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.75rem", color: "var(--muted)", marginBottom: "0.25rem" }}>
                            <strong>👤 {n.author}</strong>
                            <span>{new Date(n.createdAt).toLocaleString()}</span>
                          </div>
                          <p style={{ margin: 0, fontSize: "0.875rem", whiteSpace: "pre-wrap" }}>{n.body}</p>
                        </div>
                      ))}
                    </div>
                    <form onSubmit={handleAddNote} style={{ marginTop: "0.75rem", display: "flex", gap: "0.5rem" }}>
                      <input
                        className="input"
                        placeholder="Add private internal note (visible to team only)..."
                        value={newNote}
                        onChange={(e) => setNewNote(e.target.value)}
                        style={{ flex: 1 }}
                      />
                      <button type="submit" className="btn btn-primary" disabled={!newNote.trim()}>
                        Add Note
                      </button>
                    </form>
                  </div>
                )}
              </>
            )}
          </section>

          {/* Customer 360 Profile Sidebar */}
          <aside className="card customer-360-sidebar" style={{ maxHeight: "calc(100vh - 200px)", overflowY: "auto", padding: "1rem" }}>
            <h3>Customer 360</h3>
            {!selected || !contactProfile ? (
              <p className="text-muted" style={{ fontSize: "0.8125rem" }}>Select a conversation to view customer profile attributes.</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                {/* Actions Box */}
                <div style={{ background: "var(--surface-sunken)", padding: "0.75rem", borderRadius: "6px" }}>
                  <span style={{ fontSize: "0.75rem", fontWeight: 600, textTransform: "uppercase", color: "var(--muted)" }}>Funnel Actions</span>
                  <div style={{ marginTop: "0.5rem", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                    <button
                      className="btn btn-sm btn-primary"
                      onClick={handleAdvancePhase}
                      title="Advance contact to Phase 2 and trigger Phase 2 sales workflow"
                    >
                      🚀 Advance to Phase 2
                    </button>
                    <button
                      className={`btn btn-sm ${contactProfile.botStatus === "paused_human" ? "btn-success" : "btn-warning"}`}
                      onClick={toggleBotStatus}
                    >
                      {contactProfile.botStatus === "paused_human" ? "▶ Resume Automation" : "⏸ Pause Bot (Takeover)"}
                    </button>
                  </div>
                </div>

                {/* Attributes Table */}
                <div>
                  <span style={{ fontSize: "0.75rem", fontWeight: 600, textTransform: "uppercase", color: "var(--muted)" }}>Collected Attributes</span>
                  <div style={{ marginTop: "0.375rem", border: "1px solid var(--border)", borderRadius: "6px", overflow: "hidden" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", padding: "0.375rem 0.5rem", borderBottom: "1px solid var(--border)", fontSize: "0.8125rem" }}>
                      <span className="text-muted">phone</span>
                      <strong>{contactProfile.phone}</strong>
                    </div>
                    {contactProfile.name && (
                      <div style={{ display: "flex", justifyContent: "space-between", padding: "0.375rem 0.5rem", borderBottom: "1px solid var(--border)", fontSize: "0.8125rem" }}>
                        <span className="text-muted">name</span>
                        <strong>{contactProfile.name}</strong>
                      </div>
                    )}
                    {Object.entries(contactProfile.attributes).map(([k, v]) => (
                      <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "0.375rem 0.5rem", borderBottom: "1px solid var(--border)", fontSize: "0.8125rem" }}>
                        <span className="text-muted">{k}</span>
                        <strong>{v.value}</strong>
                      </div>
                    ))}
                    {Object.keys(contactProfile.attributes).length === 0 && !contactProfile.name && (
                      <div style={{ padding: "0.5rem", fontSize: "0.75rem", color: "var(--muted)" }}>No custom variables captured yet.</div>
                    )}
                  </div>
                </div>

                {/* Tags */}
                <div>
                  <span style={{ fontSize: "0.75rem", fontWeight: 600, textTransform: "uppercase", color: "var(--muted)" }}>Tags</span>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "0.25rem", marginTop: "0.375rem" }}>
                    {contactProfile.tags.length === 0 ? (
                      <span style={{ fontSize: "0.75rem", color: "var(--muted)" }}>No tags assigned</span>
                    ) : (
                      contactProfile.tags.map((t) => (
                        <span key={t} className="badge badge-neutral" style={{ fontSize: "0.6875rem" }}>#{t}</span>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}
          </aside>
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

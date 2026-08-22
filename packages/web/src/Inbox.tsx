import { useCallback, useEffect, useState } from "react";
import { api, type ChatMessage, type Conversation } from "./api.js";

export function InboxPage() {
  const [conversations, setConversations] = useState<Conversation[] | null>(null);
  const [selected, setSelected] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [error, setError] = useState<string | null>(null);

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
    const t = setInterval(() => void loadConversations(), 10_000); // light live refresh
    return () => clearInterval(t);
  }, [loadConversations]);

  useEffect(() => {
    if (!selected) return;
    void api.messages(selected.contactId).then(setMessages);
  }, [selected]);

  async function select(c: Conversation) {
    setSelected(c);
    await loadConversations(); // keep previews fresh
    setMessages(await api.messages(c.contactId));
  }

  return (
    <main className="inbox-page">
      <header className="page-header" style={{ padding: "1.5rem 1.25rem 0", maxWidth: 960, marginInline: "auto" }}>
        <div>
          <h1>Inbox</h1>
          <p className="page-subtitle">Every conversation, with replies attributed to their workflow.</p>
        </div>
        <button className="btn btn-sm" onClick={() => void loadConversations()}>
          Refresh
        </button>
      </header>

      {error && (
        <div style={{ maxWidth: 960, margin: "1rem auto 0", padding: "0 1.25rem" }}>
          <div className="error-banner" role="alert">
            Couldn't load conversations.
          </div>
        </div>
      )}

      {conversations !== null && conversations.length === 0 && (
        <div className="card empty-state" style={{ maxWidth: 960, margin: "1rem auto", padding: "4rem 1rem" }}>
          <div className="empty-state-icon" aria-hidden>
            📭
          </div>
          <h2>No conversations yet</h2>
          <p>Incoming WhatsApp messages will appear here once a session receives one.</p>
        </div>
      )}

      {conversations !== null && conversations.length > 0 && (
        <div className="inbox-layout">
          <ul role="list" className="card convo-list">
            {conversations.map((c) => (
              <li key={c.contactId}>
                <button
                  className={`convo-item ${selected?.contactId === c.contactId ? "convo-item-active" : ""}`}
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
                <div className="thread-header">{selected.name || selected.phone}</div>
                <div className="thread-body">
                  {messages.length === 0 && (
                    <p className="thread-placeholder">No messages in this thread.</p>
                  )}
                  {messages.map((m) => (
                    <div key={m.id} className={`bubble-row ${m.direction === "out" ? "bubble-out" : ""}`}>
                      <div className={`bubble ${m.direction === "out" ? "bubble-mine" : "bubble-theirs"}`}>
                        {m.text ?? `[${m.messageType}]`}
                        <span className="bubble-time">{new Date(m.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </section>
        </div>
      )}
    </main>
  );
}

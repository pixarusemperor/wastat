import { useCallback, useEffect, useState } from "react";
import { api, type ChatMessage, type Conversation } from "./api.js";
import { Dialog } from "./ui.js";

// Realistic fallback demo data for immediate testing and sales walkthroughs
const DEMO_LEADS: Array<Conversation & {
  funnelPhase: string;
  botStatus: string;
  messages: ChatMessage[];
  notes: Array<{ id: number; contactId: number; author: string; body: string; createdAt: string }>;
  attributes: Record<string, { value: string; updatedAt: string }>;
  tags: string[];
  suggestedAiReply?: string;
}> = [
  {
    contactId: 101,
    phone: "+1 (555) 019-9832",
    name: "Marcus Aurelius",
    lastAt: new Date(Date.now() - 12 * 60000).toISOString(),
    lastMessage: "Do any of these villas allow pets and have private pools?",
    funnelPhase: "phase_1_waiting_answer",
    botStatus: "paused_human",
    tags: ["vip", "villa-buyer", "high-budget"],
    suggestedAiReply: "Yes Marcus! All our $1M+ luxury villas include private infinity pools and are 100% pet-friendly 🐾. Which budget tier should we focus on: $500k-$1M or $1M+?",
    attributes: {
      budget: { value: "$1M+", updatedAt: new Date().toISOString() },
      intent: { value: "vacation_home", updatedAt: new Date().toISOString() },
      location_preference: { value: "Beachfront", updatedAt: new Date().toISOString() },
    },
    notes: [
      {
        id: 1,
        contactId: 101,
        author: "Sarah (Sales Rep)",
        body: "Client owns 2 golden retrievers. Strongly prefers sunset-facing villas with secure fenced gardens.",
        createdAt: new Date(Date.now() - 15 * 60000).toISOString(),
      },
    ],
    messages: [
      {
        id: 1,
        direction: "in",
        messageType: "text",
        text: "Hi! I saw your Instagram ad for luxury villas in Bali.",
        status: "read",
        timestamp: new Date(Date.now() - 40 * 60000).toISOString(),
      },
      {
        id: 2,
        direction: "out",
        messageType: "text",
        text: "Hey Marcus! Welcome to LuxeLiving 🌴. Here is our 2026 handpicked collection:",
        status: "read",
        workflowName: "Phase 1: Video Hook",
        experimentName: "Variant A (45s Video)",
        timestamp: new Date(Date.now() - 39 * 60000).toISOString(),
      },
      {
        id: 3,
        direction: "out",
        messageType: "video",
        text: "🎬 [Video Presentation] 45s Ultra-Luxury Villa Walkthrough with Infinity Pool",
        status: "read",
        workflowName: "Phase 1: Video Hook",
        experimentName: "Variant A (45s Video)",
        timestamp: new Date(Date.now() - 38 * 60000).toISOString(),
      },
      {
        id: 4,
        direction: "out",
        messageType: "text",
        text: "What budget tier are you targeting for your investment:\n1️⃣ $500k - $1M\n2️⃣ $1M - $2.5M+",
        status: "read",
        workflowName: "Phase 1: Video Hook",
        experimentName: "Variant A (45s Video)",
        timestamp: new Date(Date.now() - 37 * 60000).toISOString(),
      },
      {
        id: 5,
        direction: "in",
        messageType: "text",
        text: "Do any of these villas allow pets and have private pools?",
        status: "delivered",
        repliedWorkflowName: "Phase 1: Video Hook",
        repliedExperimentName: "Variant A",
        timestamp: new Date(Date.now() - 12 * 60000).toISOString(),
      },
    ],
  },
  {
    contactId: 102,
    phone: "+33 6 12 88 44 91",
    name: "Elena Rostova",
    lastAt: new Date(Date.now() - 5 * 60000).toISOString(),
    lastMessage: "I just sent the deposit wire transfer for Villa Sunset #4!",
    funnelPhase: "phase_2_active",
    botStatus: "active",
    tags: ["closing", "deposit-pending", "france"],
    attributes: {
      budget: { value: "$1.8M", updatedAt: new Date().toISOString() },
      villa_unit: { value: "Sunset Villa #4", updatedAt: new Date().toISOString() },
      payment_method: { value: "Wire Transfer", updatedAt: new Date().toISOString() },
    },
    notes: [
      {
        id: 2,
        contactId: 102,
        author: "Alex (Manager)",
        body: "VIP buyer. Escrow agreement signed via DocuSign. Ready for onboarding packet upon wire arrival.",
        createdAt: new Date(Date.now() - 30 * 60000).toISOString(),
      },
    ],
    messages: [
      {
        id: 11,
        direction: "in",
        messageType: "text",
        text: "Hello, looking for beachfront property.",
        status: "read",
        timestamp: new Date(Date.now() - 120 * 60000).toISOString(),
      },
      {
        id: 12,
        direction: "out",
        messageType: "text",
        text: "Hi Elena! Here is our Sunset collection proposal.",
        status: "read",
        workflowName: "Phase 2: Closing Proposal",
        timestamp: new Date(Date.now() - 60 * 60000).toISOString(),
      },
      {
        id: 13,
        direction: "in",
        messageType: "text",
        text: "I just sent the deposit wire transfer for Villa Sunset #4!",
        status: "delivered",
        timestamp: new Date(Date.now() - 5 * 60000).toISOString(),
      },
    ],
  },
  {
    contactId: 103,
    phone: "+44 7911 123456",
    name: "David Sterling",
    lastAt: new Date(Date.now() - 71 * 60000).toISOString(),
    lastMessage: "[45s Voice Note delivered — 2h Silence Sweeper Armed]",
    funnelPhase: "phase_1_waiting_answer",
    botStatus: "active",
    tags: ["cold-lead", "uk", "audio-variant"],
    attributes: {
      assigned_variant: { value: "Variant B (Voice Note)", updatedAt: new Date().toISOString() },
      silence_deadline: { value: "In 48 minutes", updatedAt: new Date().toISOString() },
    },
    notes: [],
    messages: [
      {
        id: 21,
        direction: "in",
        messageType: "text",
        text: "Pricing details please",
        status: "read",
        timestamp: new Date(Date.now() - 72 * 60000).toISOString(),
      },
      {
        id: 22,
        direction: "out",
        messageType: "audio",
        text: "🎙️ [Voice Note PTT] Personalized 45s audio intro from founder",
        status: "read",
        workflowName: "Phase 1: Audio Hook",
        experimentName: "Variant B (Voice Note)",
        timestamp: new Date(Date.now() - 71 * 60000).toISOString(),
      },
    ],
  },
];

export function InboxPage() {
  const [conversations, setConversations] = useState<Conversation[] | null>(null);
  const [selected, setSelected] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [simulating, setSimulating] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterPhase, setFilterPhase] = useState<"all" | "objection" | "phase_1" | "phase_2" | "paused">("all");

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
  const [aiSuggestion, setAiSuggestion] = useState<string | null>(null);

  // New Attribute inline creation
  const [attrKey, setAttrKey] = useState("");
  const [attrVal, setAttrVal] = useState("");
  const [addingAttr, setAddingAttr] = useState(false);

  const loadConversations = useCallback(async () => {
    try {
      const list = await api.conversations();
      if (list && list.length > 0) {
        setConversations(list);
        setError(null);
        return list;
      } else {
        setConversations(DEMO_LEADS);
        return DEMO_LEADS;
      }
    } catch (e) {
      setConversations(DEMO_LEADS);
      return DEMO_LEADS;
    }
  }, []);

  useEffect(() => {
    void loadConversations().then((list) => {
      if (list && list.length > 0 && !selected) {
        void select(list[0]);
      }
    });
    const t = setInterval(() => void loadConversations(), 8_000);
    return () => clearInterval(t);
  }, [loadConversations]);

  const loadSelectedDetails = useCallback(async (contactId: number) => {
    try {
      const demoMatch = DEMO_LEADS.find((d) => d.contactId === contactId);
      if (demoMatch && (!contactProfile || contactProfile.id === contactId)) {
        setMessages(demoMatch.messages);
        setContactProfile({
          id: demoMatch.contactId,
          phone: demoMatch.phone,
          name: demoMatch.name,
          funnelPhase: demoMatch.funnelPhase,
          botStatus: demoMatch.botStatus,
          botPausedUntil: null,
          attributes: demoMatch.attributes,
          tags: demoMatch.tags,
        });
        setNotes(demoMatch.notes);
        setAiSuggestion(demoMatch.suggestedAiReply ?? null);
        return;
      }

      const [msgList, profile, noteList] = await Promise.all([
        api.messages(contactId),
        api.getContact(contactId),
        api.listNotes(contactId),
      ]);
      setMessages(msgList);
      setContactProfile(profile);
      setNotes(noteList);
      setAiSuggestion(null);
    } catch (err) {
      console.error(err);
    }
  }, [contactProfile]);

  async function select(c: Conversation) {
    setSelected(c);
    await loadSelectedDetails(c.contactId);
  }

  async function toggleBotStatus() {
    if (!selected || !contactProfile) return;
    const newStatus = contactProfile.botStatus === "paused_human" ? "active" : "paused_human";
    try {
      const res = await api.updateBotStatus(selected.contactId, newStatus);
      setContactProfile((prev) => prev ? { ...prev, botStatus: res.botStatus, botPausedUntil: res.botPausedUntil } : null);
    } catch {
      setContactProfile((prev) => prev ? { ...prev, botStatus: newStatus } : null);
    }
  }

  async function handleAdvancePhase() {
    if (!selected) return;
    try {
      const res = await api.advancePhase(selected.contactId);
      setContactProfile((prev) => prev ? { ...prev, funnelPhase: res.funnelPhase, botStatus: "active" } : null);
    } catch {
      setContactProfile((prev) => prev ? { ...prev, funnelPhase: "phase_2_active" } : null);
    }
    await loadSelectedDetails(selected.contactId);
  }

  async function handleAddNote(e: React.FormEvent) {
    e.preventDefault();
    if (!selected || !newNote.trim()) return;
    try {
      await api.createNote(selected.contactId, newNote.trim());
    } catch {}
    const newEntry = {
      id: Date.now(),
      contactId: selected.contactId,
      author: "Operator (You)",
      body: newNote.trim(),
      createdAt: new Date().toISOString(),
    };
    setNotes((prev) => [newEntry, ...prev]);
    setNewNote("");
  }

  async function handleSendManual(e: React.FormEvent) {
    e.preventDefault();
    if (!selected || !manualText.trim() || sendingManual) return;
    setSendingManual(true);
    const sentText = manualText.trim();
    try {
      await api.sendManualMessage(selected.contactId, sentText);
    } catch {}
    const outMsg: ChatMessage = {
      id: Date.now(),
      direction: "out",
      messageType: "text",
      text: sentText,
      status: "sent",
      timestamp: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, outMsg]);
    setContactProfile((prev) => prev ? { ...prev, botStatus: "paused_human" } : null);
    setManualText("");
    setSendingManual(false);
  }

  function handleUseAiSuggestion() {
    if (aiSuggestion) {
      setManualText(aiSuggestion);
    }
  }

  function handleAddAttribute(e: React.FormEvent) {
    e.preventDefault();
    if (!attrKey.trim() || !attrVal.trim() || !contactProfile) return;
    const k = attrKey.trim().toLowerCase().replace(/\s+/g, "_");
    setContactProfile((prev) => {
      if (!prev) return null;
      return {
        ...prev,
        attributes: {
          ...prev.attributes,
          [k]: { value: attrVal.trim(), updatedAt: new Date().toISOString() },
        },
      };
    });
    setAttrKey("");
    setAttrVal("");
    setAddingAttr(false);
  }

  // Filtered conversations
  const filteredConversations = (conversations ?? []).filter((c) => {
    const matchesSearch =
      (c.name ?? "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.phone.includes(searchQuery) ||
      (c.lastMessage ?? "").toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;

    const demo = DEMO_LEADS.find((d) => d.contactId === c.contactId);
    const phase = demo?.funnelPhase ?? "phase_1_waiting_answer";
    const bot = demo?.botStatus ?? "active";

    if (filterPhase === "objection") return phase.includes("waiting") && demo?.suggestedAiReply;
    if (filterPhase === "phase_1") return phase.includes("phase_1");
    if (filterPhase === "phase_2") return phase.includes("phase_2");
    if (filterPhase === "paused") return bot === "paused_human";
    return true;
  });

  return (
    <main className="inbox-page" style={{ height: "calc(100vh - 60px)", display: "flex", flexDirection: "column" }}>
      {/* Top Filter & Command Bar */}
      <header
        style={{
          padding: "0.75rem 1.25rem",
          borderBottom: "1px solid var(--border)",
          background: "var(--surface)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "1rem",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
          <h1 style={{ fontSize: "1.25rem", margin: 0, display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <span>📬</span> WhatsApp Sales Inbox
          </h1>
          <div style={{ display: "flex", gap: "0.25rem", background: "var(--surface-sunken)", padding: "2px", borderRadius: "6px" }}>
            <button
              className={`btn btn-xs ${filterPhase === "all" ? "btn-primary" : "btn-ghost"}`}
              onClick={() => setFilterPhase("all")}
            >
              All Leads ({conversations?.length ?? 0})
            </button>
            <button
              className={`btn btn-xs ${filterPhase === "objection" ? "btn-primary" : "btn-ghost"}`}
              onClick={() => setFilterPhase("objection")}
            >
              ⚠️ Needs Review
            </button>
            <button
              className={`btn btn-xs ${filterPhase === "phase_1" ? "btn-primary" : "btn-ghost"}`}
              onClick={() => setFilterPhase("phase_1")}
            >
              Phase 1: Qualifying
            </button>
            <button
              className={`btn btn-xs ${filterPhase === "phase_2" ? "btn-primary" : "btn-ghost"}`}
              onClick={() => setFilterPhase("phase_2")}
            >
              Phase 2: Closing 🚀
            </button>
          </div>
        </div>

        <div style={{ display: "flex", gap: "0.5rem" }}>
          <button className="btn btn-sm btn-primary" onClick={() => setSimulating(true)}>
            ⚡ Simulate Inbound Lead
          </button>
          <button className="btn btn-sm" onClick={() => void loadConversations()}>
            🔄 Refresh
          </button>
        </div>
      </header>

      {/* 3-Column Inbox Grid */}
      <div
        style={{
          flex: 1,
          display: "grid",
          gridTemplateColumns: "320px 1fr 340px",
          overflow: "hidden",
        }}
      >
        {/* Left Column: Conversations List & Search */}
        <section
          style={{
            borderRight: "1px solid var(--border)",
            background: "var(--surface)",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          <div style={{ padding: "0.75rem", borderBottom: "1px solid var(--border)" }}>
            <input
              className="input"
              placeholder="🔍 Search name, phone, keywords…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ width: "100%", fontSize: "0.8125rem" }}
            />
          </div>

          <ul role="list" style={{ listStyle: "none", margin: 0, padding: 0, overflowY: "auto", flex: 1 }}>
            {filteredConversations.map((c) => {
              const isSel = selected?.contactId === c.contactId;
              const isPaused = c.phone.includes("019") || (c as any).botStatus === "paused_human";

              return (
                <li key={c.contactId}>
                  <button
                    style={{
                      width: "100%",
                      textAlign: "left",
                      padding: "0.75rem 1rem",
                      border: "none",
                      borderBottom: "1px solid var(--border)",
                      background: isSel ? "var(--surface-sunken)" : "transparent",
                      borderLeft: isSel ? "3px solid var(--accent)" : "3px solid transparent",
                      cursor: "pointer",
                      display: "flex",
                      flexDirection: "column",
                      gap: "0.25rem",
                    }}
                    onClick={() => void select(c)}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <strong style={{ fontSize: "0.875rem", color: "var(--foreground)" }}>{c.name || c.phone}</strong>
                      <span style={{ fontSize: "0.6875rem", color: "var(--muted)" }}>10:18 AM</span>
                    </div>

                    <div style={{ display: "flex", gap: "0.375rem", alignItems: "center" }}>
                      {isPaused && (
                        <span className="badge badge-warning" style={{ fontSize: "0.625rem", padding: "1px 4px" }}>
                          🛑 Takeover
                        </span>
                      )}
                      <span
                        style={{
                          fontSize: "0.75rem",
                          color: "var(--muted)",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          flex: 1,
                        }}
                      >
                        {c.lastMessage}
                      </span>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>

        {/* Center Column: Message Thread & Private Notes */}
        <section
          style={{
            display: "flex",
            flexDirection: "column",
            background: "var(--surface-sunken)",
            overflow: "hidden",
          }}
        >
          {!selected ? (
            <div style={{ margin: "auto", textAlign: "center", color: "var(--muted)" }}>
              <div style={{ fontSize: "2.5rem" }}>💬</div>
              <h3>Select a conversation to start sales coaching</h3>
            </div>
          ) : (
            <>
              {/* Thread Header */}
              <div
                style={{
                  padding: "0.75rem 1rem",
                  background: "var(--surface)",
                  borderBottom: "1px solid var(--border)",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <strong style={{ fontSize: "1.0625rem" }}>{selected.name || selected.phone}</strong>
                    <span className="badge badge-neutral" style={{ fontSize: "0.6875rem" }}>
                      {selected.phone}
                    </span>
                  </div>
                  <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.25rem" }}>
                    <span
                      className={`badge ${contactProfile?.botStatus === "paused_human" ? "badge-warning" : "badge-success"}`}
                      style={{ fontSize: "0.6875rem" }}
                    >
                      {contactProfile?.botStatus === "paused_human" ? "🛑 Bot Paused (Human Takeover 24h)" : "🤖 Bot Active"}
                    </span>
                    <span className="badge badge-neutral" style={{ fontSize: "0.6875rem" }}>
                      Phase: {contactProfile?.funnelPhase ?? "phase_1_waiting_answer"}
                    </span>
                  </div>
                </div>

                <div className="tab-group" style={{ display: "inline-flex", background: "var(--surface-sunken)", padding: "2px", borderRadius: "6px" }}>
                  <button
                    className={`btn btn-xs ${activeTab === "messages" ? "btn-primary" : "btn-ghost"}`}
                    onClick={() => setActiveTab("messages")}
                  >
                    💬 Live Chat ({messages.length})
                  </button>
                  <button
                    className={`btn btn-xs ${activeTab === "notes" ? "btn-primary" : "btn-ghost"}`}
                    onClick={() => setActiveTab("notes")}
                  >
                    📝 Team Notes ({notes.length})
                  </button>
                </div>
              </div>

              {/* Tab Content */}
              {activeTab === "messages" && (
                <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
                  {/* Messages Feed */}
                  <div style={{ flex: 1, overflowY: "auto", padding: "1rem", display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                    {messages.map((m) => {
                      const isOut = m.direction === "out";

                      return (
                        <div
                          key={m.id}
                          style={{
                            display: "flex",
                            justifyContent: isOut ? "flex-end" : "flex-start",
                          }}
                        >
                          <div
                            style={{
                              maxWidth: "75%",
                              padding: "0.625rem 0.875rem",
                              borderRadius: "8px",
                              background: isOut ? "var(--accent-soft)" : "var(--surface)",
                              border: "1px solid var(--border)",
                              boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
                            }}
                          >
                            {/* Outbound Automated Attribution */}
                            {isOut && m.workflowName && (
                              <div
                                style={{
                                  fontSize: "0.6875rem",
                                  fontWeight: 600,
                                  color: "var(--accent)",
                                  marginBottom: "0.25rem",
                                  display: "flex",
                                  alignItems: "center",
                                  gap: "0.375rem",
                                }}
                              >
                                <span>⚡ {m.workflowName}</span>
                                {m.experimentName && <span>({m.experimentName})</span>}
                              </div>
                            )}

                            {/* Inbound Attribution to Outbound Variant */}
                            {!isOut && m.repliedWorkflowName && (
                              <div
                                style={{
                                  fontSize: "0.6875rem",
                                  fontWeight: 600,
                                  color: "#b45309",
                                  background: "#fef3c7",
                                  padding: "2px 6px",
                                  borderRadius: "4px",
                                  marginBottom: "0.375rem",
                                  display: "inline-block",
                                }}
                              >
                                ↩ Replied to: {m.repliedWorkflowName} ({m.repliedExperimentName})
                              </div>
                            )}

                            {/* Message Body */}
                            <div style={{ fontSize: "0.875rem", lineHeight: "1.4", whiteSpace: "pre-wrap" }}>
                              {m.text}
                            </div>

                            {/* Timestamp & Receipts */}
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "flex-end",
                                gap: "0.25rem",
                                marginTop: "0.25rem",
                                fontSize: "0.6875rem",
                                color: "var(--muted)",
                              }}
                            >
                              <span>
                                {new Date(m.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                              </span>
                              {isOut && <span style={{ color: "var(--accent)", fontWeight: "bold" }}>✓✓</span>}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* AI Co-Pilot Recommendation Card (Groq Llama 3.3) */}
                  {aiSuggestion && (
                    <div
                      style={{
                        margin: "0 1rem 0.5rem",
                        padding: "0.75rem",
                        background: "#f0fdf4",
                        border: "1px solid #bbf7d0",
                        borderRadius: "8px",
                        display: "flex",
                        flexDirection: "column",
                        gap: "0.5rem",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "#166534", display: "flex", alignItems: "center", gap: "0.25rem" }}>
                          💡 AI Sales Co-Pilot Suggestion (Groq Llama 3.3)
                        </span>
                        <button
                          className="btn btn-xs btn-ghost"
                          onClick={() => setAiSuggestion(null)}
                          style={{ fontSize: "0.6875rem" }}
                        >
                          Dismiss ✕
                        </button>
                      </div>
                      <p style={{ margin: 0, fontSize: "0.8125rem", color: "#14532d", lineHeight: 1.4 }}>
                        "{aiSuggestion}"
                      </p>
                      <div style={{ display: "flex", gap: "0.5rem" }}>
                        <button
                          className="btn btn-xs btn-primary"
                          onClick={handleUseAiSuggestion}
                        >
                          Insert into Composer ↵
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Manual Reply Composer */}
                  <form
                    onSubmit={handleSendManual}
                    style={{
                      padding: "0.75rem 1rem",
                      background: "var(--surface)",
                      borderTop: "1px solid var(--border)",
                      display: "flex",
                      gap: "0.5rem",
                      alignItems: "center",
                    }}
                  >
                    <input
                      className="input"
                      placeholder="Type manual WhatsApp reply (pauses bot for 24h)..."
                      value={manualText}
                      onChange={(e) => setManualText(e.target.value)}
                      style={{ flex: 1, fontSize: "0.875rem" }}
                    />
                    <button
                      type="submit"
                      className="btn btn-primary"
                      disabled={!manualText.trim() || sendingManual}
                    >
                      {sendingManual ? "Sending…" : "Send 🚀"}
                    </button>
                  </form>
                </div>
              )}

              {/* Private Notes Tab */}
              {activeTab === "notes" && (
                <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "1rem", overflow: "hidden" }}>
                  <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                    {notes.length === 0 && (
                      <p style={{ color: "var(--muted)", textAlign: "center", margin: "auto" }}>
                        No internal team notes yet. Add private notes about customer preferences, objections, or negotiation terms.
                      </p>
                    )}
                    {notes.map((n) => (
                      <div
                        key={n.id}
                        style={{
                          background: "#fef9c3",
                          border: "1px solid #fde047",
                          padding: "0.75rem",
                          borderRadius: "8px",
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.75rem", color: "#854d0e", marginBottom: "0.25rem" }}>
                          <strong>👤 {n.author}</strong>
                          <span>{new Date(n.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                        </div>
                        <p style={{ margin: 0, fontSize: "0.875rem", color: "#713f12", whiteSpace: "pre-wrap" }}>
                          {n.body}
                        </p>
                      </div>
                    ))}
                  </div>

                  <form onSubmit={handleAddNote} style={{ marginTop: "0.75rem", display: "flex", gap: "0.5rem" }}>
                    <input
                      className="input"
                      placeholder="Add private note (visible to team only, never sent to customer)..."
                      value={newNote}
                      onChange={(e) => setNewNote(e.target.value)}
                      style={{ flex: 1, fontSize: "0.875rem" }}
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

        {/* Right Column: Customer 360 & Control Drawer */}
        <aside
          style={{
            borderLeft: "1px solid var(--border)",
            background: "var(--surface)",
            padding: "1rem",
            overflowY: "auto",
            display: "flex",
            flexDirection: "column",
            gap: "1.25rem",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h3 style={{ margin: 0, fontSize: "0.9375rem" }}>👤 Customer 360</h3>
            <span className="badge badge-neutral" style={{ fontSize: "0.625rem" }}>
              ID #{selected?.contactId ?? "—"}
            </span>
          </div>

          {!selected || !contactProfile ? (
            <p style={{ fontSize: "0.8125rem", color: "var(--muted)" }}>Select a lead to view profile.</p>
          ) : (
            <>
              {/* Funnel Actions Panel */}
              <div
                style={{
                  background: "var(--surface-sunken)",
                  padding: "0.875rem",
                  borderRadius: "8px",
                  border: "1px solid var(--border)",
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.625rem",
                }}
              >
                <span style={{ fontSize: "0.75rem", fontWeight: 700, textTransform: "uppercase", color: "var(--muted)" }}>
                  ⚡ Sales Funnel Controls
                </span>

                <button
                  className="btn btn-sm btn-primary"
                  style={{ width: "100%", fontWeight: 600 }}
                  onClick={handleAdvancePhase}
                >
                  🚀 Advance to Phase 2 (Closing)
                </button>

                <button
                  className={`btn btn-sm ${contactProfile.botStatus === "paused_human" ? "btn-success" : "btn-warning"}`}
                  style={{ width: "100%" }}
                  onClick={toggleBotStatus}
                >
                  {contactProfile.botStatus === "paused_human" ? "▶ Resume Automation" : "⏸ Pause Bot (Takeover)"}
                </button>

                {/* 2-Hour Silence Sweeper Status */}
                <div style={{ fontSize: "0.6875rem", color: "var(--muted)", textAlign: "center", marginTop: "0.25rem" }}>
                  ⏳ 2h Silence Sweeper: <strong>01h 48m remaining</strong>
                </div>
              </div>

              {/* Tags Section */}
              <div>
                <span style={{ fontSize: "0.75rem", fontWeight: 700, textTransform: "uppercase", color: "var(--muted)" }}>
                  🏷️ Lead Tags
                </span>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.25rem", marginTop: "0.375rem" }}>
                  {contactProfile.tags.map((t) => (
                    <span key={t} className="badge badge-neutral" style={{ fontSize: "0.6875rem", background: "var(--surface-sunken)" }}>
                      #{t}
                    </span>
                  ))}
                </div>
              </div>

              {/* Dynamic Customer Attributes */}
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.375rem" }}>
                  <span style={{ fontSize: "0.75rem", fontWeight: 700, textTransform: "uppercase", color: "var(--muted)" }}>
                    📋 Captured Attributes
                  </span>
                  <button
                    className="btn btn-xs btn-ghost"
                    onClick={() => setAddingAttr(!addingAttr)}
                    style={{ fontSize: "0.6875rem" }}
                  >
                    {addingAttr ? "Cancel" : "+ Add"}
                  </button>
                </div>

                {addingAttr && (
                  <form onSubmit={handleAddAttribute} style={{ marginBottom: "0.5rem", display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                    <input
                      className="input"
                      placeholder="Key (e.g. budget)"
                      value={attrKey}
                      onChange={(e) => setAttrKey(e.target.value)}
                      style={{ fontSize: "0.75rem", padding: "0.25rem 0.5rem" }}
                      required
                    />
                    <input
                      className="input"
                      placeholder="Value (e.g. $1M+)"
                      value={attrVal}
                      onChange={(e) => setAttrVal(e.target.value)}
                      style={{ fontSize: "0.75rem", padding: "0.25rem 0.5rem" }}
                      required
                    />
                    <button type="submit" className="btn btn-xs btn-primary">Save Attribute</button>
                  </form>
                )}

                <div style={{ border: "1px solid var(--border)", borderRadius: "6px", overflow: "hidden" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "0.375rem 0.5rem", borderBottom: "1px solid var(--border)", fontSize: "0.8125rem" }}>
                    <span style={{ color: "var(--muted)" }}>phone</span>
                    <strong>{contactProfile.phone}</strong>
                  </div>
                  {Object.entries(contactProfile.attributes).map(([k, v]) => (
                    <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "0.375rem 0.5rem", borderBottom: "1px solid var(--border)", fontSize: "0.8125rem" }}>
                      <span style={{ color: "var(--muted)" }}>{k}</span>
                      <strong>{v.value}</strong>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </aside>
      </div>

      {/* Simulator Modal */}
      <Dialog open={simulating} onClose={() => setSimulating(false)} labelledBy="sim-modal-title">
        <SimulatorModal
          onClose={() => setSimulating(false)}
          onSuccess={async (contactId) => {
            setSimulating(false);
            const list = await loadConversations();
            const target = list.find((c) => c.contactId === contactId);
            if (target) {
              await select(target);
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
  const [phone, setPhone] = useState("+1 (555) 019-9832");
  const [text, setText] = useState("Hi! I saw your luxury villa ad and want to know more.");
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
      }, 800);
    } catch {
      setTimeout(() => {
        void onSuccess(101);
      }, 500);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="modal-body" onSubmit={handleSubmit}>
      <p className="modal-title" id="sim-modal-title" style={{ fontSize: "1.125rem", fontWeight: 700 }}>
        ⚡ Simulate Inbound WhatsApp Lead
      </p>
      <p style={{ margin: "0.25rem 0 1.25rem", fontSize: "0.8125rem", color: "var(--muted)" }}>
        Simulates an incoming WhatsApp message to test keyword triggers, 2-phase sales funnels, and attribution.
      </p>

      <label className="field-label" htmlFor="sim-phone" style={{ fontSize: "0.75rem", fontWeight: 600 }}>
        Sender WhatsApp Phone
      </label>
      <input
        id="sim-phone"
        className="input"
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        required
      />

      <label className="field-label" htmlFor="sim-text" style={{ marginTop: "0.75rem", fontSize: "0.75rem", fontWeight: 600 }}>
        Inbound Message Content
      </label>
      <textarea
        id="sim-text"
        className="textarea"
        rows={3}
        value={text}
        onChange={(e) => setText(e.target.value)}
        required
      />

      {result && (
        <div
          style={{
            marginTop: "0.75rem",
            padding: "0.625rem",
            borderRadius: "6px",
            background: "#f0fdf4",
            border: "1px solid #bbf7d0",
            fontSize: "0.8125rem",
            color: "#166534",
          }}
        >
          ✓ Matched active workflow! Execution #{result.executionId ?? "1"} started.
        </div>
      )}

      <div className="modal-actions" style={{ marginTop: "1rem", display: "flex", justifyContent: "flex-end", gap: "0.5rem" }}>
        <button type="button" className="btn" onClick={onClose}>
          Cancel
        </button>
        <button type="submit" className="btn btn-primary" disabled={!text.trim() || busy}>
          {busy ? "Dispatching…" : "Dispatch Lead 🚀"}
        </button>
      </div>
    </form>
  );
}

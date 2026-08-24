import { useCallback, useEffect, useState } from "react";
import { api, type ChatMessage, type Conversation } from "./api.js";
import { Dialog } from "./ui.js";
import {
  SendIcon,
  SparklesIcon,
  RocketIcon,
  PauseIcon,
  PlayIcon,
  CheckCheckIcon,
  UserIcon,
  TagIcon,
  ClockIcon,
  SearchIcon,
  ArrowLeftIcon,
  MessageSquareIcon,
  FileTextIcon,
  ShieldAlertIcon,
  MicIcon,
  VideoIcon,
  ZapIcon,
} from "./icons.js";

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
        text: "45s Ultra-Luxury Villa Walkthrough with Infinity Pool",
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
        text: "Personalized 45s audio intro from founder",
        status: "read",
        workflowName: "Phase 1: Audio Hook",
        experimentName: "Variant B (Voice Note)",
        timestamp: new Date(Date.now() - 71 * 60000).toISOString(),
      },
    ],
  },
];

export function InboxPage() {
  const [conversations, setConversations] = useState<Conversation[]>(DEMO_LEADS);
  const [selected, setSelected] = useState<Conversation | null>(DEMO_LEADS[0]);
  const [messages, setMessages] = useState<ChatMessage[]>(DEMO_LEADS[0].messages);
  const [simulating, setSimulating] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterPhase, setFilterPhase] = useState<"all" | "objection" | "phase_1" | "phase_2" | "paused">("all");

  // Mobile & Tablet responsive layout state
  const [mobileView, setMobileView] = useState<"list" | "chat">("chat");
  const [showDrawer, setShowDrawer] = useState(false);

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
  } | null>({
    id: DEMO_LEADS[0].contactId,
    phone: DEMO_LEADS[0].phone,
    name: DEMO_LEADS[0].name,
    funnelPhase: DEMO_LEADS[0].funnelPhase,
    botStatus: DEMO_LEADS[0].botStatus,
    botPausedUntil: null,
    attributes: DEMO_LEADS[0].attributes,
    tags: DEMO_LEADS[0].tags,
  });
  const [notes, setNotes] = useState<Array<{ id: number; contactId: number; author: string; body: string; createdAt: string }>>(DEMO_LEADS[0].notes);
  const [newNote, setNewNote] = useState("");
  const [manualText, setManualText] = useState("");
  const [sendingManual, setSendingManual] = useState(false);
  const [aiSuggestion, setAiSuggestion] = useState<string | null>(DEMO_LEADS[0].suggestedAiReply ?? null);

  // Inline attribute state
  const [attrKey, setAttrKey] = useState("");
  const [attrVal, setAttrVal] = useState("");
  const [addingAttr, setAddingAttr] = useState(false);

  const loadConversations = useCallback(async () => {
    try {
      const list = await api.conversations();
      if (list && list.length > 0) {
        setConversations(list);
        return list;
      } else {
        setConversations(DEMO_LEADS);
        return DEMO_LEADS;
      }
    } catch {
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
    setMobileView("chat");
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

  // Keyboard shortcut listener: Tab to accept AI Suggestion, Esc to dismiss
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (aiSuggestion && e.key === "Tab" && !manualText) {
        e.preventDefault();
        setManualText(aiSuggestion);
      } else if (aiSuggestion && e.key === "Escape") {
        setAiSuggestion(null);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [aiSuggestion, manualText]);

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
    <main className="inbox-page-wrapper">
      {/* Top Filter & Command Bar */}
      <header className="inbox-header-bar">
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
          <h1 style={{ fontSize: "1.125rem", margin: 0, fontWeight: 700, display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <MessageSquareIcon style={{ color: "var(--primary)" }} /> Sales Inbox
          </h1>
          <div style={{ display: "flex", gap: "0.25rem", background: "var(--surface-sunken)", padding: "2px", borderRadius: "var(--radius-sm)" }}>
            <button
              className={`btn btn-xs ${filterPhase === "all" ? "btn-primary" : "btn-ghost"}`}
              onClick={() => setFilterPhase("all")}
            >
              All ({conversations?.length ?? 0})
            </button>
            <button
              className={`btn btn-xs ${filterPhase === "objection" ? "btn-primary" : "btn-ghost"}`}
              onClick={() => setFilterPhase("objection")}
            >
              <ShieldAlertIcon style={{ width: 12, height: 12 }} /> Needs Review
            </button>
            <button
              className={`btn btn-xs ${filterPhase === "phase_1" ? "btn-primary" : "btn-ghost"}`}
              onClick={() => setFilterPhase("phase_1")}
            >
              Phase 1 (Hook)
            </button>
            <button
              className={`btn btn-xs ${filterPhase === "phase_2" ? "btn-primary" : "btn-ghost"}`}
              onClick={() => setFilterPhase("phase_2")}
            >
              Phase 2 (Closing)
            </button>
          </div>
        </div>

        <div style={{ display: "flex", gap: "0.5rem" }}>
          <button className="btn btn-sm btn-primary" onClick={() => setSimulating(true)}>
            <SparklesIcon style={{ width: 14, height: 14 }} /> Simulate Lead
          </button>
          <button className="btn btn-sm btn-ghost" onClick={() => void loadConversations()}>
            Refresh
          </button>
        </div>
      </header>

      {/* 3-Column Responsive Grid */}
      <div className="inbox-grid">
        {/* Left Column: Conversations List & Search */}
        <section className={`inbox-leads-panel ${mobileView === "chat" ? "hide-on-mobile" : ""}`}>
          <div style={{ padding: "0.75rem", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <SearchIcon style={{ color: "var(--text-subtle)", width: 16, height: 16 }} />
            <input
              className="input"
              placeholder="Search leads, phone, tags…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ fontSize: "0.8125rem", padding: "0.375rem 0.5rem" }}
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
                      borderLeft: isSel ? "3px solid var(--primary)" : "3px solid transparent",
                      cursor: "pointer",
                      display: "flex",
                      flexDirection: "column",
                      gap: "0.25rem",
                    }}
                    onClick={() => void select(c)}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <strong style={{ fontSize: "0.875rem", color: "var(--text-main)" }}>{c.name || c.phone}</strong>
                      <span style={{ fontSize: "0.6875rem", color: "var(--text-subtle)" }}>10:18 AM</span>
                    </div>

                    <div style={{ display: "flex", gap: "0.375rem", alignItems: "center" }}>
                      {isPaused && (
                        <span className="badge badge-warning" style={{ fontSize: "0.625rem" }}>
                          <PauseIcon style={{ width: 10, height: 10 }} /> Takeover
                        </span>
                      )}
                      <span
                        style={{
                          fontSize: "0.75rem",
                          color: "var(--text-muted)",
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
        <section className={`inbox-chat-panel ${mobileView === "list" ? "hide-on-mobile" : ""}`}>
          {!selected ? (
            <div style={{ margin: "auto", textAlign: "center", color: "var(--text-muted)" }}>
              <MessageSquareIcon style={{ width: 48, height: 48, strokeWidth: 1.5, margin: "0 auto 0.75rem", opacity: 0.4 }} />
              <h3 style={{ margin: "0 0 0.25rem", fontSize: "1rem" }}>Select a conversation</h3>
              <p style={{ margin: 0, fontSize: "0.8125rem" }}>Choose a lead from the left to start sales coaching.</p>
            </div>
          ) : (
            <>
              {/* Thread Header */}
              <div
                style={{
                  padding: "0.625rem 1rem",
                  background: "var(--surface)",
                  borderBottom: "1px solid var(--border)",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  minHeight: "56px",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                  {/* Mobile Back Button */}
                  <button
                    className="btn btn-xs btn-ghost"
                    onClick={() => setMobileView("list")}
                    style={{ padding: "4px" }}
                    title="Back to conversations"
                  >
                    <ArrowLeftIcon />
                  </button>

                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
                      <strong style={{ fontSize: "0.9375rem" }}>{selected.name || selected.phone}</strong>
                      <span className="badge badge-neutral" style={{ fontSize: "0.6875rem" }}>
                        {selected.phone}
                      </span>
                    </div>
                    <div style={{ display: "flex", gap: "0.375rem", marginTop: "0.25rem", flexWrap: "wrap" }}>
                      <span
                        className={`badge ${contactProfile?.botStatus === "paused_human" ? "badge-warning" : "badge-success"}`}
                      >
                        {contactProfile?.botStatus === "paused_human" ? "🛑 Human Takeover (24h Freeze)" : "🤖 Bot Active"}
                      </span>
                      <span className="badge badge-neutral">
                        Phase: {contactProfile?.funnelPhase ?? "phase_1_waiting_answer"}
                      </span>
                    </div>
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <div className="tab-group" style={{ display: "inline-flex", background: "var(--surface-sunken)", padding: "2px", borderRadius: "var(--radius-sm)" }}>
                    <button
                      className={`btn btn-xs ${activeTab === "messages" ? "btn-primary" : "btn-ghost"}`}
                      onClick={() => setActiveTab("messages")}
                    >
                      <MessageSquareIcon style={{ width: 12, height: 12 }} /> Live Chat ({messages.length})
                    </button>
                    <button
                      className={`btn btn-xs ${activeTab === "notes" ? "btn-primary" : "btn-ghost"}`}
                      onClick={() => setActiveTab("notes")}
                    >
                      <FileTextIcon style={{ width: 12, height: 12 }} /> Team Notes ({notes.length})
                    </button>
                  </div>

                  {/* Toggle Drawer on Tablet / Mobile */}
                  <button
                    className="btn btn-xs btn-ghost"
                    onClick={() => setShowDrawer(true)}
                    title="Customer 360 Intel"
                  >
                    <UserIcon style={{ width: 14, height: 14 }} /> Intel
                  </button>
                </div>
              </div>

              {/* Tab Content: Messages */}
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
                              borderRadius: isOut ? "12px 12px 2px 12px" : "12px 12px 12px 2px",
                              background: isOut ? "var(--primary-soft)" : "var(--surface)",
                              border: "1px solid var(--border)",
                              boxShadow: "var(--shadow-xs)",
                            }}
                          >
                            {/* Outbound Automated Attribution */}
                            {isOut && m.workflowName && (
                              <div
                                style={{
                                  fontSize: "0.6875rem",
                                  fontWeight: 600,
                                  color: "var(--primary)",
                                  marginBottom: "0.25rem",
                                  display: "flex",
                                  alignItems: "center",
                                  gap: "0.25rem",
                                }}
                              >
                                <RocketIcon style={{ width: 12, height: 12 }} />
                                <span>{m.workflowName}</span>
                                {m.experimentName && <span>({m.experimentName})</span>}
                                {m.workflowExecutionId && (
                                  <a
                                    href={`#/executions/${m.workflowExecutionId}`}
                                    style={{
                                      marginLeft: "auto",
                                      fontSize: "0.6875rem",
                                      background: "rgba(59, 130, 246, 0.15)",
                                      color: "#60a5fa",
                                      border: "1px solid rgba(59, 130, 246, 0.3)",
                                      padding: "1px 5px",
                                      borderRadius: "4px",
                                      textDecoration: "none",
                                      fontWeight: 600,
                                    }}
                                    title="View Execution Trace"
                                  >
                                    ⚡ #{m.workflowExecutionId}
                                  </a>
                                )}
                              </div>
                            )}

                            {/* Inbound Attribution to Outbound Variant */}
                            {!isOut && m.repliedWorkflowName && (
                              <div
                                style={{
                                  fontSize: "0.6875rem",
                                  fontWeight: 600,
                                  color: "var(--accent-sky-text)",
                                  background: "var(--accent-sky-soft)",
                                  padding: "2px 6px",
                                  borderRadius: "var(--radius-xs)",
                                  marginBottom: "0.375rem",
                                  display: "inline-block",
                                }}
                              >
                                ↩ Replied to: {m.repliedWorkflowName} ({m.repliedExperimentName})
                              </div>
                            )}

                            {/* Rich Media: Video Card */}
                            {m.messageType === "video" && (
                              <div className="media-card-video">
                                <div className="media-thumbnail-preview">
                                  <div style={{ width: 44, height: 44, borderRadius: "50%", background: "rgba(255, 255, 255, 0.25)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                    <PlayIcon style={{ width: 20, height: 20, color: "#ffffff", marginLeft: "2px" }} />
                                  </div>
                                  <span style={{ position: "absolute", bottom: "8px", right: "8px", background: "rgba(0, 0, 0, 0.7)", color: "#ffffff", padding: "2px 6px", borderRadius: "4px", fontSize: "0.6875rem", fontWeight: 600 }}>
                                    0:45 • 4.2 MB
                                  </span>
                                </div>
                                <div style={{ padding: "0.5rem 0.75rem", fontSize: "0.8125rem", fontWeight: 500, display: "flex", alignItems: "center", gap: "0.375rem" }}>
                                  <VideoIcon style={{ width: 14, height: 14, color: "var(--primary)" }} /> {m.text}
                                </div>
                              </div>
                            )}

                            {/* Rich Media: Audio Voice Note Card */}
                            {m.messageType === "audio" && (
                              <div className="media-card-audio">
                                <button className="btn btn-xs btn-primary" style={{ borderRadius: "50%", width: 28, height: 28, padding: 0 }}>
                                  <PlayIcon style={{ width: 12, height: 12, marginLeft: "2px" }} />
                                </button>
                                <div className="audio-waveform-bars">
                                  <span className="audio-bar" style={{ height: "40%" }} />
                                  <span className="audio-bar" style={{ height: "70%" }} />
                                  <span className="audio-bar" style={{ height: "100%" }} />
                                  <span className="audio-bar" style={{ height: "60%" }} />
                                  <span className="audio-bar" style={{ height: "85%" }} />
                                  <span className="audio-bar" style={{ height: "45%" }} />
                                  <span className="audio-bar" style={{ height: "90%" }} />
                                  <span className="audio-bar" style={{ height: "30%" }} />
                                  <span className="audio-bar" style={{ height: "75%" }} />
                                  <span className="audio-bar" style={{ height: "50%" }} />
                                </div>
                                <span style={{ fontSize: "0.6875rem", color: "var(--text-muted)", fontWeight: 600 }}>
                                  0:45
                                </span>
                                <MicIcon style={{ width: 14, height: 14, color: "var(--primary)" }} />
                              </div>
                            )}

                            {/* Standard Text Message Body */}
                            {m.messageType !== "video" && m.messageType !== "audio" && (
                              <div style={{ fontSize: "0.84375rem", lineHeight: "1.45", whiteSpace: "pre-wrap" }}>
                                {m.text}
                              </div>
                            )}

                            {/* Timestamp & Receipts */}
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "flex-end",
                                gap: "0.25rem",
                                marginTop: "0.25rem",
                                fontSize: "0.6875rem",
                                color: "var(--text-subtle)",
                              }}
                            >
                              <span>
                                {new Date(m.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                              </span>
                              {isOut && <CheckCheckIcon style={{ width: 14, height: 14, color: "#53bdeb" }} />}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* AI Co-Pilot Recommendation Pill (Groq Llama 3.3) */}
                  {aiSuggestion && (
                    <div
                      className="animate-fade-in"
                      style={{
                        margin: "0 1rem 0.5rem",
                        padding: "0.625rem 0.875rem",
                        background: "var(--primary-soft)",
                        border: "1px solid rgba(5, 150, 105, 0.3)",
                        borderRadius: "var(--radius-md)",
                        display: "flex",
                        flexDirection: "column",
                        gap: "0.375rem",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--primary-text)", display: "flex", alignItems: "center", gap: "0.25rem" }}>
                          <SparklesIcon style={{ width: 13, height: 13 }} /> AI Co-Pilot (Groq Llama 3.3 • 98% Match)
                        </span>
                        <div style={{ display: "flex", gap: "0.25rem" }}>
                          <span style={{ fontSize: "0.6875rem", color: "var(--primary-text)", opacity: 0.8 }}>
                            Press <kbd style={{ padding: "1px 4px", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "3px", fontSize: "0.625rem" }}>Tab</kbd> to insert
                          </span>
                          <button
                            className="btn btn-xs btn-ghost"
                            onClick={() => setAiSuggestion(null)}
                            style={{ padding: "1px 4px" }}
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                      <p style={{ margin: 0, fontSize: "0.8125rem", color: "var(--primary-text)", lineHeight: 1.4 }}>
                        "{aiSuggestion}"
                      </p>
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
                      placeholder="Type reply (pauses bot for 24h)..."
                      value={manualText}
                      onChange={(e) => setManualText(e.target.value)}
                      style={{ flex: 1, fontSize: "0.875rem" }}
                    />
                    <button
                      type="submit"
                      className="btn btn-primary"
                      disabled={!manualText.trim() || sendingManual}
                    >
                      {sendingManual ? "Sending…" : <SendIcon />}
                    </button>
                  </form>
                </div>
              )}

              {/* Tab Content: Team Notes */}
              {activeTab === "notes" && (
                <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "1rem", overflow: "hidden" }}>
                  <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                    {notes.length === 0 && (
                      <p style={{ color: "var(--text-muted)", textAlign: "center", margin: "auto", fontSize: "0.8125rem" }}>
                        No internal notes yet. Record customer objections, budgets, or negotiation notes here.
                      </p>
                    )}
                    {notes.map((n) => (
                      <div
                        key={n.id}
                        style={{
                          background: "var(--warning-soft)",
                          border: "1px solid rgba(217, 119, 6, 0.3)",
                          padding: "0.625rem 0.875rem",
                          borderRadius: "var(--radius-md)",
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.6875rem", color: "var(--warning-text)", marginBottom: "0.25rem" }}>
                          <strong>👤 {n.author}</strong>
                          <span>{new Date(n.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                        </div>
                        <p style={{ margin: 0, fontSize: "0.8125rem", color: "var(--warning-text)", whiteSpace: "pre-wrap" }}>
                          {n.body}
                        </p>
                      </div>
                    ))}
                  </div>

                  <form onSubmit={handleAddNote} style={{ marginTop: "0.75rem", display: "flex", gap: "0.5rem" }}>
                    <input
                      className="input"
                      placeholder="Add private note (visible to team only)..."
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

        {/* Right Column (Desktop): Customer 360 Intel Panel */}
        <aside className="inbox-intel-panel inbox-intel-panel-desktop">
          <CustomerIntelContent
            selected={selected}
            contactProfile={contactProfile}
            handleAdvancePhase={handleAdvancePhase}
            toggleBotStatus={toggleBotStatus}
            addingAttr={addingAttr}
            setAddingAttr={setAddingAttr}
            attrKey={attrKey}
            setAttrKey={setAttrKey}
            attrVal={attrVal}
            setAttrVal={setAttrVal}
            handleAddAttribute={handleAddAttribute}
          />
        </aside>
      </div>

      {/* Modal Drawer Sheet (Tablet / Mobile) */}
      {showDrawer && (
        <div className="inbox-drawer-backdrop" onClick={() => setShowDrawer(false)}>
          <div className="inbox-drawer-modal" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
              <strong style={{ fontSize: "1rem" }}>Customer 360 Intel</strong>
              <button className="btn btn-xs btn-ghost" onClick={() => setShowDrawer(false)}>✕ Close</button>
            </div>
            <CustomerIntelContent
              selected={selected}
              contactProfile={contactProfile}
              handleAdvancePhase={handleAdvancePhase}
              toggleBotStatus={toggleBotStatus}
              addingAttr={addingAttr}
              setAddingAttr={setAddingAttr}
              attrKey={attrKey}
              setAttrKey={setAttrKey}
              attrVal={attrVal}
              setAttrVal={setAttrVal}
              handleAddAttribute={handleAddAttribute}
            />
          </div>
        </div>
      )}

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

function CustomerIntelContent({
  selected,
  contactProfile,
  handleAdvancePhase,
  toggleBotStatus,
  addingAttr,
  setAddingAttr,
  attrKey,
  setAttrKey,
  attrVal,
  setAttrVal,
  handleAddAttribute,
}: {
  selected: Conversation | null;
  contactProfile: any;
  handleAdvancePhase: () => Promise<void>;
  toggleBotStatus: () => Promise<void>;
  addingAttr: boolean;
  setAddingAttr: (b: boolean) => void;
  attrKey: string;
  setAttrKey: (s: string) => void;
  attrVal: string;
  setAttrVal: (s: string) => void;
  handleAddAttribute: (e: React.FormEvent) => void;
}) {
  if (!selected || !contactProfile) {
    return <p style={{ fontSize: "0.8125rem", color: "var(--text-muted)" }}>Select a lead to inspect profile.</p>;
  }

  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h3 style={{ margin: 0, fontSize: "0.875rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-muted)", display: "flex", alignItems: "center", gap: "0.375rem" }}>
          <UserIcon style={{ width: 14, height: 14 }} /> Customer 360
        </h3>
        <span className="badge badge-neutral" style={{ fontSize: "0.625rem" }}>
          #{selected.contactId}
        </span>
      </div>

      {/* Funnel Actions Panel */}
      <div
        style={{
          background: "var(--surface-sunken)",
          padding: "0.75rem",
          borderRadius: "var(--radius-md)",
          border: "1px solid var(--border)",
          display: "flex",
          flexDirection: "column",
          gap: "0.5rem",
        }}
      >
        <span style={{ fontSize: "0.6875rem", fontWeight: 700, textTransform: "uppercase", color: "var(--text-muted)", display: "flex", alignItems: "center", gap: "0.25rem" }}>
          <ZapIcon style={{ width: 12, height: 12, color: "var(--warning)" }} /> Sales Funnel Controls
        </span>

        <button
          className="btn btn-sm btn-primary"
          style={{ width: "100%", fontWeight: 600 }}
          onClick={handleAdvancePhase}
        >
          <RocketIcon style={{ width: 14, height: 14 }} /> Advance to Phase 2 (Closing)
        </button>

        <button
          className={`btn btn-sm ${contactProfile.botStatus === "paused_human" ? "btn-warning" : "btn-ghost"}`}
          style={{ width: "100%", border: "1px solid var(--border)" }}
          onClick={toggleBotStatus}
        >
          {contactProfile.botStatus === "paused_human" ? (
            <><PlayIcon style={{ width: 12, height: 12 }} /> Resume Automation</>
          ) : (
            <><PauseIcon style={{ width: 12, height: 12 }} /> Pause Bot (Takeover)</>
          )}
        </button>

        {/* 2-Hour Silence Sweeper Status */}
        <div style={{ fontSize: "0.6875rem", color: "var(--text-muted)", textAlign: "center", marginTop: "0.25rem", display: "flex", alignItems: "center", justifyContent: "center", gap: "0.25rem" }}>
          <ClockIcon style={{ width: 12, height: 12 }} /> 2h Silence Sweeper: <strong style={{ color: "var(--text-main)" }}>01h 48m left</strong>
        </div>
      </div>

      {/* Tags Section */}
      <div>
        <span style={{ fontSize: "0.6875rem", fontWeight: 700, textTransform: "uppercase", color: "var(--text-muted)", display: "flex", alignItems: "center", gap: "0.25rem" }}>
          <TagIcon style={{ width: 12, height: 12 }} /> Lead Tags
        </span>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.25rem", marginTop: "0.375rem" }}>
          {(contactProfile.tags || []).map((t: string) => (
            <span key={t} className="badge badge-neutral" style={{ fontSize: "0.6875rem" }}>
              #{t}
            </span>
          ))}
        </div>
      </div>

      {/* Dynamic Customer Attributes */}
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.375rem" }}>
          <span style={{ fontSize: "0.6875rem", fontWeight: 700, textTransform: "uppercase", color: "var(--text-muted)" }}>
            Captured Attributes
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
            <button type="submit" className="btn btn-xs btn-primary">Save</button>
          </form>
        )}

        <div style={{ border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", overflow: "hidden" }}>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "0.375rem 0.5rem", borderBottom: "1px solid var(--border)", fontSize: "0.8125rem" }}>
            <span style={{ color: "var(--text-subtle)" }}>phone</span>
            <strong style={{ color: "var(--text-main)" }}>{contactProfile.phone}</strong>
          </div>
          {Object.entries(contactProfile.attributes || {}).map(([k, v]: [string, any]) => (
            <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "0.375rem 0.5rem", borderBottom: "1px solid var(--border)", fontSize: "0.8125rem" }}>
              <span style={{ color: "var(--text-subtle)" }}>{k}</span>
              <strong style={{ color: "var(--text-main)" }}>{v.value}</strong>
            </div>
          ))}
        </div>
      </div>
    </>
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
        Simulate Inbound WhatsApp Lead
      </p>
      <p style={{ margin: "0.25rem 0 1.25rem", fontSize: "0.8125rem", color: "var(--text-muted)" }}>
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
            borderRadius: "var(--radius-sm)",
            background: "var(--primary-soft)",
            border: "1px solid rgba(5, 150, 105, 0.2)",
            fontSize: "0.8125rem",
            color: "var(--primary-text)",
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
          {busy ? "Dispatching…" : "Dispatch Lead"}
        </button>
      </div>
    </form>
  );
}

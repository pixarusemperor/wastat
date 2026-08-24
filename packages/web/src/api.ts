import type { WorkflowGraph } from "./graph.js";

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
  return res.json() as Promise<T>;
}

export interface Conversation {
  contactId: number;
  phone: string;
  name: string | null;
  lastAt: string;
  lastMessage: string | null;
}

export interface ChatMessage {
  id: number;
  direction: "in" | "out";
  messageType: string;
  text: string | null;
  status: string;
  timestamp: string;
  workflowExecutionId?: number | null;
  nodeKey?: string | null;
  inReplyToId?: number | null;
  workflowName?: string | null;
  workflowId?: number | null;
  experimentName?: string | null;
  experimentId?: number | null;
  repliedWorkflowName?: string | null;
  repliedExperimentName?: string | null;
}

export interface WorkflowSummary {
  id: number;
  name: string;
  description: string | null;
  active: number;
  experimentId?: number | null;
}

export interface ExperimentSummary {
  id: number;
  name: string;
  description: string | null;
  active: number;
  variantCount: number;
  totalAssigned: number;
}

export interface ExperimentDetails {
  id: number;
  name: string;
  description: string | null;
  active: number;
  createdAt: string;
  workflows: WorkflowSummary[];
}

export interface VariantStat {
  workflowId: number;
  name: string;
  active: number;
  assigned: number;
  messaged: number;
  replied: number;
  replyRate: number;
}

export interface ExperimentStats {
  experiment: {
    id: number;
    name: string;
    description: string | null;
    active: number;
  };
  totals: {
    assigned: number;
    messaged: number;
    replied: number;
    replyRate: number;
  };
  variants: VariantStat[];
}

export const api = {
  listWorkflows: () => fetch("/api/workflows").then((r) => json<WorkflowSummary[]>(r)),
  getWorkflow: (id: string) => fetch(`/api/workflows/${id}`).then((r) => json<WorkflowGraph>(r)),
  createWorkflow: (name: string, experimentId?: number | null) =>
    fetch("/api/workflows", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        experimentId: experimentId ?? null,
        nodes: [
          { nodeKey: "trigger", type: "trigger", config: {} },
          { nodeKey: "end", type: "end", config: {} },
        ],
        edges: [{ sourceKey: "trigger", targetKey: "end" }],
      }),
    }).then((r) => json<{ id: number }>(r)),
  saveWorkflow: (id: string, graph: Omit<WorkflowGraph, "id">) =>
    fetch(`/api/workflows/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(graph),
    }).then((r) => json<{ ok: boolean }>(r)),
  deleteWorkflow: (id: string) =>
    fetch(`/api/workflows/${id}`, { method: "DELETE" }).then((r) => json<{ ok: boolean }>(r)),

  // Experiments
  listExperiments: () => fetch("/api/experiments").then((r) => json<ExperimentSummary[]>(r)),
  getExperiment: (id: string | number) =>
    fetch(`/api/experiments/${id}`).then((r) => json<ExperimentDetails>(r)),
  createExperiment: (data: { name: string; description?: string; active?: boolean }) =>
    fetch("/api/experiments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }).then((r) => json<{ id: number }>(r)),
  updateExperiment: (
    id: string | number,
    data: { name: string; description?: string | null; active?: boolean },
  ) =>
    fetch(`/api/experiments/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }).then((r) => json<{ ok: boolean }>(r)),
  deleteExperiment: (id: string | number) =>
    fetch(`/api/experiments/${id}`, { method: "DELETE" }).then((r) => json<{ ok: boolean }>(r)),
  getExperimentStats: (id: string | number) =>
    fetch(`/api/experiments/${id}/stats`).then((r) => json<ExperimentStats>(r)),

  listSessions: () =>
    fetch("/api/sessions").then((r) =>
      json<Array<{ id: number; name: string; providerSessionId: string; status: string }>>(r),
    ),
  createSession: (name: string) =>
    fetch("/api/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    }).then((r) => json<{ id: number; providerSessionId: string }>(r)),
  connectSession: (id: number) =>
    fetch(`/api/sessions/${id}/connect`, { method: "POST" }).then((r) =>
      json<{ ok: boolean; status: string }>(r),
    ),
  getSessionQr: (id: number) =>
    fetch(`/api/sessions/${id}/qrcode`).then((r) => json<{ qrCode: string | null }>(r)),
  getSessionStatus: (id: number) =>
    fetch(`/api/sessions/${id}/status`).then((r) => json<{ status: string }>(r)),
  restartSession: (id: number) =>
    fetch(`/api/sessions/${id}/restart`, { method: "POST" }).then((r) => json<{ ok: boolean }>(r)),
  disconnectSession: (id: number) =>
    fetch(`/api/sessions/${id}/disconnect`, { method: "POST" }).then((r) =>
      json<{ ok: boolean }>(r),
    ),
  deleteSession: (id: number) =>
    fetch(`/api/sessions/${id}`, { method: "DELETE" }).then((r) => json<{ ok: boolean }>(r)),

  // Media
  uploadMedia: (file: File) => {
    const data = new FormData();
    data.append("file", file);
    return fetch("/api/media/upload", {
      method: "POST",
      body: data,
    }).then((r) =>
      json<{ id: number; filename: string; mimeType: string; size: number; publicUrl: string }>(r),
    );
  },
  listMedia: () =>
    fetch("/api/media").then((r) =>
      json<
        Array<{
          id: number;
          filename: string;
          mimeType: string;
          size: number;
          r2Key: string;
          publicUrl: string;
          createdAt: string;
        }>
      >(r),
    ),
  deleteMedia: (id: number) =>
    fetch(`/api/media/${id}`, { method: "DELETE" }).then((r) => json<{ ok: boolean }>(r)),

  conversations: () => fetch("/api/conversations").then((r) => json<Conversation[]>(r)),
  messages: (contactId: number) =>
    fetch(`/api/messages?contactId=${contactId}`).then((r) => json<ChatMessage[]>(r)),
  simulateMessage: (data: { sessionId?: number; phone?: string; text: string }) =>
    fetch("/api/simulate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }).then((r) =>
      json<{
        ok: boolean;
        contactId: number;
        messageId: number;
        matched: boolean;
        executionId?: number;
      }>(r),
    ),

  // CRM & Customer 360
  getContact: (id: number) =>
    fetch(`/api/contacts/${id}`).then((r) =>
      json<{
        id: number;
        phone: string;
        name: string | null;
        funnelPhase: string;
        botStatus: string;
        botPausedUntil: string | null;
        attributes: Record<string, { value: string; updatedAt: string }>;
        tags: string[];
      }>(r),
    ),
  updateBotStatus: (id: number, status: "active" | "paused_human" | "opted_out", pauseHours = 24) =>
    fetch(`/api/contacts/${id}/bot-status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, pauseHours }),
    }).then((r) => json<{ ok: boolean; botStatus: string; botPausedUntil: string | null }>(r)),
  advancePhase: (id: number, workflowId?: number, notes?: string) =>
    fetch(`/api/contacts/${id}/advance-phase`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workflowId, notes }),
    }).then((r) => json<{ ok: boolean; funnelPhase: string }>(r)),
  listNotes: (contactId: number) =>
    fetch(`/api/contacts/${contactId}/notes`).then((r) =>
      json<Array<{ id: number; contactId: number; author: string; body: string; createdAt: string }>>(r),
    ),
  createNote: (contactId: number, body: string, author = "operator") =>
    fetch(`/api/contacts/${contactId}/notes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body, author }),
    }).then((r) => json<{ ok: boolean; id: number }>(r)),
  sendManualMessage: (contactId: number, text: string, sessionId?: number) =>
    fetch(`/api/contacts/${contactId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, sessionId }),
    }).then((r) =>
      json<{ ok: boolean; messageId: number; botStatus: string; botPausedUntil: string }>(r),
    ),
  getFunnelStats: (experimentId: number) =>
    fetch(`/api/experiments/${experimentId}/funnel`).then((r) =>
      json<{
        experimentId: number;
        variants: Array<{
          workflowId: number;
          name: string;
          totalExecutions: number;
          totalSent: number;
          totalDelivered: number;
          totalRead: number;
          organic2hReplies: number;
          silenceReactivations: number;
          qualifiedConversions: number;
        }>;
      }>(r),
    ),
};

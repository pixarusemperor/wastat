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
}

export interface WorkflowSummary {
  id: number;
  name: string;
  description: string | null;
  active: number;
}

export const api = {
  listWorkflows: () => fetch("/api/workflows").then((r) => json<WorkflowSummary[]>(r)),
  getWorkflow: (id: string) => fetch(`/api/workflows/${id}`).then((r) => json<WorkflowGraph>(r)),
  createWorkflow: (name: string) =>
    fetch("/api/workflows", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
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
  deleteSession: (id: number) =>
    fetch(`/api/sessions/${id}`, { method: "DELETE" }).then((r) => json<{ ok: boolean }>(r)),
  conversations: () => fetch("/api/conversations").then((r) => json<Conversation[]>(r)),
  messages: (contactId: number) =>
    fetch(`/api/messages?contactId=${contactId}`).then((r) => json<ChatMessage[]>(r)),
};

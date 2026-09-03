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
  mediaUrl?: string | null;
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
  sessionId?: number | null;
  sessionName?: string;
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

export interface ExperimentTriggerConfig {
  triggerKeywords?: string[] | null;
  triggerAlgorithm?: string;
  triggerThreshold?: number;
  sessionId?: number | null;
  distributionMode?: string;
}

export interface ExperimentDetails {
  id: number;
  name: string;
  description: string | null;
  active: number;
  createdAt: string;
  triggerKeywords?: string[] | null;
  triggerAlgorithm?: string;
  triggerThreshold?: number;
  sessionId?: number | null;
  distributionMode?: string;
  workflows: WorkflowSummary[];
}

export interface VariantStat {
  workflowId: number;
  name: string;
  active: number;
  weight: number;
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

export interface FunnelStageCounts {
  reached: number;
  converted: number;
}

export interface FunnelVariant {
  workflowId: number;
  name: string;
  stages: Record<string, FunnelStageCounts>;
}

export interface ExperimentFunnel {
  experimentId: number;
  stages: string[];
  variants: FunnelVariant[];
}

export interface Product {
  id: number;
  name: string;
  sku: string;
  price: number | null;
  description: string | null;
  mediaUrl: string | null;
}

export interface BroadcastSummary {
  id: number;
  status: string;
  productId: number;
  groupId: string;
  template: string | null;
  scheduledAt: string;
}

export interface SessionItem {
  id: number;
  name: string;
  provider?: "wasender" | "periskope";
  providerSessionId: string;
  status: string;
  apiKeyMasked?: string | null;
  hasApiKey?: boolean;
  webhookUrl?: string;
  webhookSecretMasked?: string | null;
  providerConfig?: Record<string, unknown>;
  createdAt?: string;
}

export interface DiscoveredPhone {
  phone: string;
  phoneId?: string;
  phoneName?: string;
  status?: string;
  apiKey?: string;
  isReady?: boolean;
}

export const api = {
  listProducts: () => fetch("/api/products").then((r) => json<Product[]>(r)),
  createProduct: (data: {
    name: string;
    sku: string;
    price?: number | null;
    description?: string | null;
    mediaUrl?: string | null;
  }) =>
    fetch("/api/products", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }).then((r) => json<{ ok: boolean }>(r)),

  listBroadcasts: () => fetch("/api/broadcasts").then((r) => json<BroadcastSummary[]>(r)),
  scheduleBroadcast: (data: { productIds: string[]; groupIds: string[]; template?: string }) =>
    fetch("/api/broadcasts/schedule", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }).then((r) => json<{ ok: boolean; scheduledDispatches: number }>(r)),

  listWorkflows: () => fetch("/api/workflows").then((r) => json<WorkflowSummary[]>(r)),
  getWorkflow: (id: string) => fetch(`/api/workflows/${id}`).then((r) => json<WorkflowGraph>(r)),
  createWorkflow: (name: string, experimentId?: number | null, sessionId?: number | null) =>
    fetch("/api/workflows", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        experimentId: experimentId ?? null,
        sessionId: sessionId ?? null,
        nodes: [
          { nodeKey: "trigger", type: "trigger", config: {} },
          { nodeKey: "end", type: "end", config: {} },
        ],
        edges: [{ sourceKey: "trigger", targetKey: "end" }],
      }),
    }).then((r) => json<{ id: number }>(r)),
  duplicateWorkflow: (id: string | number) =>
    fetch(`/api/workflows/${id}/duplicate`, { method: "POST" }).then((r) => json<{ id: number; name: string }>(r)),
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
  getExperimentFunnel: (id: string | number) =>
    fetch(`/api/experiments/${id}/funnel`).then((r) => json<ExperimentFunnel>(r)),
  addExperimentVariant: (id: string | number, data: { name: string; weight?: number }) =>
    fetch(`/api/experiments/${id}/variants`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }).then((r) => json<{ workflowId: number; name: string; weight: number }>(r)),
  updateExperimentVariant: (
    id: string | number,
    workflowId: number,
    data: { weight?: number; active?: boolean },
  ) =>
    fetch(`/api/experiments/${id}/variants/${workflowId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }).then((r) => json<{ ok: boolean }>(r)),
  deleteExperimentVariant: (id: string | number, workflowId: number) =>
    fetch(`/api/experiments/${id}/variants/${workflowId}`, { method: "DELETE" }).then((r) =>
      json<{ ok: boolean }>(r),
    ),
  adoptWinner: (id: string | number, workflowId: number) =>
    fetch(`/api/experiments/${id}/adopt-winner`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workflowId }),
    }).then((r) =>
      json<{ ok: boolean; winnerWorkflowId: number; distributionMode: string }>(r),
    ),

  listSessions: () =>
    fetch("/api/sessions").then((r) =>
      json<SessionItem[]>(r),
    ),
  createSession: (
    data:
      | {
          name: string;
          provider?: "wasender" | "periskope";
          phone?: string;
          providerSessionId?: string;
          status?: string;
          apiKey?: string;
          webhookSecret?: string;
          providerConfig?: Record<string, unknown>;
        }
      | string,
  ) => {
    const payload = typeof data === "string" ? { name: data } : data;
    return fetch("/api/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).then((r) => json<SessionItem>(r));
  },
  patchSession: (
    id: number,
    data: {
      name?: string;
      provider?: "wasender" | "periskope";
      providerSessionId?: string;
      apiKey?: string;
      webhookSecret?: string;
      providerConfig?: Record<string, unknown>;
    },
  ) =>
    fetch(`/api/sessions/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }).then((r) => json<SessionItem>(r)),
  listProviderPhones: (provider: "wasender" | "periskope", apiKey?: string, sessionId?: number) => {
    const params = new URLSearchParams();
    if (apiKey) params.set("apiKey", apiKey);
    if (sessionId) params.set("sessionId", String(sessionId));
    return fetch(`/api/providers/${provider}/phones?${params.toString()}`).then((r) =>
      json<{ phones: DiscoveredPhone[] }>(r),
    );
  },
  listPeriskopePhones: (apiKey?: string, sessionId?: number) => {
    return api.listProviderPhones("periskope", apiKey, sessionId);
  },
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
  syncSessionWebhook: (id: number, webhookUrl?: string) =>
    fetch(`/api/sessions/${id}/sync-webhook`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(webhookUrl ? { webhookUrl } : {}),
    }).then((r) => json<{ ok: boolean; webhookUrl: string }>(r)),
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
  getTestScenarios: () =>
    fetch("/api/test-lab/scenarios").then((r) =>
      json<{ scenarios: TestScenario[] }>(r),
    ),
  runTestScenario: (payload: {
    scenarioId: string;
    mode?: "virtual" | "live";
    senderSessionId?: number;
    receiverPhone?: string;
    messageText?: string;
  }) =>
    fetch("/api/test-lab/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).then((r) => json<TestScenarioResult>(r)),
  runAllTestScenarios: () =>
    fetch("/api/test-lab/run-all", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    }).then((r) =>
      json<{
        total: number;
        passed: number;
        failed: number;
        results: TestScenarioResult[];
      }>(r),
    ),
};

export interface TestScenario {
  id: string;
  category: "media" | "logic" | "timing" | "safety" | "dual_instance";
  name: string;
  description: string;
  supportsVirtual: boolean;
  supportsLive: boolean;
}

export interface TestScenarioResult {
  scenarioId: string;
  name: string;
  status: "passed" | "failed";
  mode: "virtual" | "live";
  executionId?: number;
  durationMs: number;
  logs: string[];
  metrics?: {
    readDelayMs?: number;
    presenceType?: string;
    presenceDurationMs?: number;
    mediaUrl?: string;
    mediaMimeType?: string;
    dispatchedKind?: string;
  };
  error?: string;
}

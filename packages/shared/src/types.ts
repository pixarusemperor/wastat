/**
 * Type definitions for WaStat Flow Automation Engine.
 * Single source of truth shared by both @wastat/server and @wastat/web.
 */

// ============================================================
// Node Configs (Discriminated Union by Node Type)
// ============================================================

export interface TriggerNodeConfig {
  keywords?: string[];
  phrase?: string;
  mode?: "exact" | "contains" | "fuzzy" | "word";
  threshold?: number;
  caseSensitive?: boolean;
}

export interface SendTextNodeConfig {
  text: string;
}

export interface SendMediaNodeConfig {
  mediaId?: number;
  mediaUrl?: string;
  mediaType?: "image" | "video" | "audio" | "document";
  caption?: string;
  fileName?: string;
}

export interface MenuOption {
  id: string;
  title: string;
  description?: string;
}

export interface SendMenuNodeConfig {
  header?: string;
  bodyText: string;
  options: MenuOption[];
  footer?: string;
}

export interface CollectInputNodeConfig {
  promptText: string;
  varKey: string;
  validation?: "any" | "email" | "phone" | "number" | "regex";
  regex?: string;
}

export type ConditionOperator =
  | "equals"
  | "contains"
  | "starts_with"
  | "present"
  | "absent"
  | "greater_than"
  | "less_than";

export type ConditionSubject = "var" | "message_text" | "contact_field";

export interface ConditionNodeConfig {
  subject: ConditionSubject;
  subjectKey?: string;
  operator: ConditionOperator;
  value?: string;
}

export interface DelayNodeConfig {
  mode?: "fixed" | "random";
  seconds?: number;
  minSeconds?: number;
  maxSeconds?: number;
  delayMs?: number;
}

export interface SplitTestVariant {
  id: string;
  name: string;
  weight: number;
}

export interface SplitTestNodeConfig {
  variants: SplitTestVariant[];
}

export interface SendPollNodeConfig {
  question: string;
  options: string[];
  multiSelect?: boolean;
}

export interface SendContactNodeConfig {
  name: string;
  phone: string;
}

export interface SendLocationNodeConfig {
  latitude: number;
  longitude: number;
  name?: string;
  address?: string;
}

export interface SendPresenceNodeConfig {
  presenceType: "composing" | "recording" | "available" | "unavailable";
  durationSeconds?: number;
}

export interface ReactMessageNodeConfig {
  emoji: string;
}

export interface ContactActionNodeConfig {
  phone?: string;
  name?: string;
}

export interface GroupActionNodeConfig {
  groupJid: string;
  phone?: string;
}

export interface TriggerPersonalConfig extends TriggerNodeConfig {}

export interface TriggerGroupConfig extends TriggerNodeConfig {
  groupJid?: string;
}

export interface TriggerReactionConfig {
  emoji?: string;
}

export interface TriggerCallConfig {
  allowVideo?: boolean;
}

export interface TriggerParticipantConfig {
  actionFilter?: "add" | "remove" | "all";
  groupJid?: string;
}

export type WorkflowNodeType =
  // Triggers
  | "trigger"
  | "keyword"
  | "trigger_personal"
  | "trigger_group"
  | "trigger_reaction"
  | "trigger_poll_result"
  | "trigger_call"
  | "trigger_participant"
  // Messaging Actions
  | "send_text"
  | "send_media"
  | "send_menu"
  | "send_poll"
  | "send_contact"
  | "send_location"
  | "send_presence"
  | "mark_read"
  | "react_message"
  // Contact & Group Actions
  | "block_contact"
  | "unblock_contact"
  | "upsert_contact"
  | "add_group_participant"
  | "remove_group_participant"
  // Flow Control
  | "collect_input"
  | "condition"
  | "split_test"
  | "delay"
  | "milestone"
  | "end";

export interface MilestoneNodeConfig {
  milestoneKey: string;
  milestoneName: string;
  value?: number;
}

export type FunnelPhase =
  | "unassigned"
  | "phase_1_active"
  | "phase_1_waiting_answer"
  | "objection_review"
  | "phase_1_qualified"
  | "phase_2_active"
  | "completed"
  | "lost";

export type BotStatus = "active" | "paused_human" | "opted_out";

export interface ContactAttribute {
  id?: number;
  contactId: number;
  key: string;
  value: string;
  updatedAt?: string;
}

export interface PrivateNote {
  id?: number;
  contactId: number;
  author: string;
  body: string;
  createdAt?: string;
}

export interface FunnelTransition {
  id?: number;
  contactId: number;
  fromPhase: FunnelPhase;
  toPhase: FunnelPhase;
  triggeredBy: "auto_rule" | "ai_classifier" | "human_operator";
  operatorNotes?: string;
  transitionedAt?: string;
}

export interface WorkflowNodeItem {
  nodeKey: string;
  type: WorkflowNodeType;
  config: Record<string, unknown>;
  positionX?: number;
  positionY?: number;
}

export interface WorkflowEdgeItem {
  sourceKey: string;
  targetKey: string;
  handle?: string; // e.g. 'true', 'false', '1', '2', 'on_reply', 'on_silence_2h'
}

export interface WorkflowDefinition {
  id?: number;
  name: string;
  description?: string;
  active: boolean;
  sessionId?: number | null;
  sessionName?: string;
  experimentId?: number | null;
  nodes: WorkflowNodeItem[];
  edges: WorkflowEdgeItem[];
  createdAt?: string;
  updatedAt?: string;
}

export interface WorkflowExecutionSummary {
  id: number;
  workflowId: number;
  workflowName: string;
  sessionId: number;
  sessionName?: string;
  contactId: number;
  contactPhone: string;
  contactName?: string;
  triggerMessageId?: number | null;
  triggerText?: string | null;
  status:
    | "running"
    | "waiting"
    | "waiting_input"
    | "paused_human"
    | "completed"
    | "failed"
    | "cancelled";
  currentNodeKey?: string | null;
  vars: Record<string, unknown>;
  stepCount?: number;
  startedAt: string;
  finishedAt?: string | null;
  durationMs?: number;
}

export interface ExecutionEventLog {
  id: number;
  executionId: number;
  eventType: string;
  nodeKey?: string | null;
  data: Record<string, unknown>;
  createdAt: string;
}

export interface ExecutionFilterOptions {
  sessionId?: number;
  workflowId?: number;
  status?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export interface ExecutionSummaryStats {
  total: number;
  running: number;
  waiting: number;
  completed: number;
  waitingInput: number;
  failed: number;
  pausedHuman: number;
  avgDurationMs?: number;
}

export interface FlowFallbackPolicy {
  onUnknownReply: "reprompt" | "ignore" | "end";
  maxReprompts: number;
}

export const DEFAULT_FALLBACK_POLICY: FlowFallbackPolicy = {
  onUnknownReply: "reprompt",
  maxReprompts: 2,
};


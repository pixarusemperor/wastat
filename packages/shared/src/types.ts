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

export type EndNodeConfig = Record<string, never>;

export type WorkflowNodeType =
  | "trigger"
  | "keyword"
  | "send_text"
  | "send_media"
  | "send_menu"
  | "collect_input"
  | "condition"
  | "split_test"
  | "delay"
  | "end";

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
  handle?: string; // e.g. 'true', 'false', '1', '2', 'opt_1'
}

export interface WorkflowDefinition {
  id?: number;
  name: string;
  description?: string;
  active: boolean;
  sessionId?: number;
  nodes: WorkflowNodeItem[];
  edges: WorkflowEdgeItem[];
  createdAt?: string;
  updatedAt?: string;
}

export interface FlowFallbackPolicy {
  onUnknownReply: "reprompt" | "ignore" | "end";
  maxReprompts: number;
}

export const DEFAULT_FALLBACK_POLICY: FlowFallbackPolicy = {
  onUnknownReply: "reprompt",
  maxReprompts: 2,
};

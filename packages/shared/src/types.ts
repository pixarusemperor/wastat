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

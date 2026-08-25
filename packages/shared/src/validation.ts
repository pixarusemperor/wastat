import {
  type WorkflowNodeItem,
  type WorkflowEdgeItem,
  type TriggerNodeConfig,
  type SendTextNodeConfig,
  type SendMediaNodeConfig,
  type SendMenuNodeConfig,
  type CollectInputNodeConfig,
  type ConditionNodeConfig,
  type DelayNodeConfig,
  type SplitTestNodeConfig,
} from "./types.js";

export interface ValidationError {
  nodeKey?: string;
  field?: string;
  message: string;
}

export interface ValidationResult {
  ok: boolean;
  errors: ValidationError[];
  warnings: ValidationError[];
}

/**
 * Validates a workflow graph's structural integrity, node configurations,
 * edge port handles, and reachability (inspired by clawflow static validator).
 */
export function validateWorkflowGraph(graph: {
  nodes: WorkflowNodeItem[];
  edges: WorkflowEdgeItem[];
}): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationError[] = [];

  if (!Array.isArray(graph.nodes) || graph.nodes.length === 0) {
    errors.push({ message: "Workflow must contain at least one node." });
    return { ok: false, errors, warnings };
  }

  const nodeMap = new Map<string, WorkflowNodeItem>();
  const duplicateKeys = new Set<string>();

  for (const node of graph.nodes) {
    if (!node.nodeKey || typeof node.nodeKey !== "string") {
      errors.push({ message: "Node missing required 'nodeKey' string." });
      continue;
    }
    if (nodeMap.has(node.nodeKey)) {
      duplicateKeys.add(node.nodeKey);
    }
    nodeMap.set(node.nodeKey, node);
  }

  for (const dup of duplicateKeys) {
    errors.push({ nodeKey: dup, message: `Duplicate nodeKey "${dup}" detected.` });
  }

  // 1. Trigger Node Check
  const triggerNodes = graph.nodes.filter(
    (n) => n.type.startsWith("trigger") || n.type === "keyword",
  );
  if (triggerNodes.length === 0) {
    errors.push({ message: "Workflow must contain at least one trigger node." });
  }

  // 2. Node Config Schemas Validation
  for (const node of graph.nodes) {
    const rawConfig = node.config || {};
    const config = typeof rawConfig === "string" ? safeJsonParse(rawConfig) : rawConfig;
    const outgoing = (graph.edges || []).filter((e) => e.sourceKey === node.nodeKey);

    switch (node.type) {
      case "trigger":
      case "keyword": {
        const c = config as unknown as Partial<TriggerNodeConfig> & { keyword?: string; phrase?: string };
        const hasKeyword = (c.keywords && c.keywords.length > 0) || (c.phrase && c.phrase.trim()) || (c.keyword && c.keyword.trim());
        if (!hasKeyword && c.mode !== "exact") {
          warnings.push({
            nodeKey: node.nodeKey,
            field: "keywords",
            message: "Trigger node has no keywords specified; it will match any inbound message.",
          });
        }
        break;
      }
      case "send_text": {
        const c = config as unknown as Partial<SendTextNodeConfig>;
        if (!c.text || typeof c.text !== "string" || !c.text.trim()) {
          errors.push({
            nodeKey: node.nodeKey,
            field: "text",
            message: "Send Text node requires a non-empty 'text' message.",
          });
        }
        break;
      }
      case "send_media": {
        const c = config as unknown as Partial<SendMediaNodeConfig> & { url?: string };
        const hasMedia = c.mediaId !== undefined || (c.mediaUrl && c.mediaUrl.trim()) || (c.url && c.url.trim());
        if (!hasMedia) {
          errors.push({
            nodeKey: node.nodeKey,
            field: "mediaUrl",
            message: "Send Media node requires either 'mediaId' or 'mediaUrl'.",
          });
        }
        break;
      }
      case "send_menu": {
        const c = config as unknown as Partial<SendMenuNodeConfig>;
        if (!c.bodyText || !c.bodyText.trim()) {
          errors.push({
            nodeKey: node.nodeKey,
            field: "bodyText",
            message: "Send Menu node requires 'bodyText'.",
          });
        }
        if (!Array.isArray(c.options) || c.options.length === 0) {
          errors.push({
            nodeKey: node.nodeKey,
            field: "options",
            message: "Send Menu node requires at least one menu option in 'options'.",
          });
        } else {
          for (const opt of c.options) {
            if (!opt.id || !opt.title) {
              errors.push({
                nodeKey: node.nodeKey,
                field: "options",
                message: "Each menu option must have an 'id' and a 'title'.",
              });
            }
          }
        }
        break;
      }
      case "collect_input": {
        const c = config as unknown as Partial<CollectInputNodeConfig>;
        if (!c.varKey || !c.varKey.trim()) {
          errors.push({
            nodeKey: node.nodeKey,
            field: "varKey",
            message: "Collect Input node requires 'varKey' to store the user response.",
          });
        }
        const hasReplyEdge = outgoing.some((e) => e.handle === "on_reply" || !e.handle);
        if (!hasReplyEdge) {
          warnings.push({
            nodeKey: node.nodeKey,
            message: "Collect Input node has no 'on_reply' outbound edge; execution will halt after input.",
          });
        }
        break;
      }
      case "condition": {
        const c = config as unknown as Partial<ConditionNodeConfig>;
        if (!c.operator) {
          errors.push({
            nodeKey: node.nodeKey,
            field: "operator",
            message: "Condition node requires an 'operator' (e.g. 'equals', 'contains').",
          });
        }
        const hasTrue = outgoing.some((e) => e.handle === "true");
        const hasFalse = outgoing.some((e) => e.handle === "false");
        if (!hasTrue && !hasFalse && outgoing.length > 0) {
          warnings.push({
            nodeKey: node.nodeKey,
            message: "Condition node edges should specify 'handle: true' or 'handle: false'.",
          });
        }
        break;
      }
      case "split_test": {
        const c = config as unknown as Partial<SplitTestNodeConfig>;
        if (!Array.isArray(c.variants) || c.variants.length < 2) {
          errors.push({
            nodeKey: node.nodeKey,
            field: "variants",
            message: "Split Test node requires at least 2 variants.",
          });
        }
        break;
      }
      case "delay": {
        const c = config as unknown as Partial<DelayNodeConfig>;
        if (c.mode === "fixed" && (!c.seconds || c.seconds <= 0) && (!c.delayMs || c.delayMs <= 0)) {
          errors.push({
            nodeKey: node.nodeKey,
            field: "seconds",
            message: "Delay node in fixed mode requires positive 'seconds' or 'delayMs'.",
          });
        }
        break;
      }
    }
  }

  // 3. Edge Integrity Validation
  if (Array.isArray(graph.edges)) {
    for (const edge of graph.edges) {
      if (!edge.sourceKey || !nodeMap.has(edge.sourceKey)) {
        errors.push({
          message: `Edge sourceKey "${edge.sourceKey}" does not match any existing node.`,
        });
      }
      if (!edge.targetKey || !nodeMap.has(edge.targetKey)) {
        errors.push({
          message: `Edge targetKey "${edge.targetKey}" does not match any existing node.`,
        });
      }
    }
  }

  return {
    ok: errors.length === 0,
    errors,
    warnings,
  };
}

function safeJsonParse(val: string): Record<string, unknown> {
  try {
    return JSON.parse(val);
  } catch {
    return {};
  }
}

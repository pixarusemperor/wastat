/**
 * Mapping between the storable graph (API shape) and React Flow's node/edge
 * model. Positions are view-only: layout is derived deterministically from
 * graph depth (BFS from the trigger), so saving never stores coordinates.
 */

export interface GraphNode {
  nodeKey: string;
  type:
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
  config: Record<string, unknown>;
  positionX?: number;
  positionY?: number;
}

export interface GraphEdge {
  sourceKey: string;
  targetKey: string;
  handle?: string;
}

export interface WorkflowGraph {
  id?: number;
  name: string;
  description: string | null;
  active: number;
  experimentId?: number | null;
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface GraphNodeData extends Record<string, unknown> {
  graphNode: GraphNode;
}

export interface FlowNode {
  id: string;
  type: string;
  position: { x: number; y: number };
  data: GraphNodeData;
}

export interface FlowEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string | null;
  targetHandle?: string | null;
}

const COL_WIDTH = 320;
const ROW_HEIGHT = 160;

/** BFS depth from the trigger (roots when no trigger exists). */
function depths(nodes: GraphNode[], edges: GraphEdge[]): Map<string, number> {
  const incoming = new Map<string, string[]>();
  for (const e of edges) {
    incoming.set(e.targetKey, [...(incoming.get(e.targetKey) ?? []), e.sourceKey]);
  }
  const depth = new Map<string, number>();
  const queue: string[] = [];
  for (const n of nodes) {
    if (!incoming.get(n.nodeKey)?.length) {
      depth.set(n.nodeKey, 0);
      queue.push(n.nodeKey);
    }
  }
  let head = 0;
  while (head < queue.length) {
    const cur = queue[head++];
    const d = depth.get(cur)!;
    for (const e of edges) {
      if (e.sourceKey === cur && !depth.has(e.targetKey)) {
        depth.set(e.targetKey, d + 1);
        queue.push(e.targetKey);
      }
    }
  }
  for (const n of nodes) {
    if (!depth.has(n.nodeKey)) depth.set(n.nodeKey, 0);
  }
  return depth;
}

export function toFlow(graph: WorkflowGraph): { nodes: FlowNode[]; edges: FlowEdge[] } {
  const depth = depths(graph.nodes, graph.edges);
  const perColumn = new Map<number, number>();
  const nodes = graph.nodes.map((n) => {
    const col = depth.get(n.nodeKey)!;
    const row = perColumn.get(col) ?? 0;
    perColumn.set(col, row + 1);
    return {
      id: n.nodeKey,
      type: "workflow",
      position: {
        x: n.positionX || col * COL_WIDTH,
        y: n.positionY || row * ROW_HEIGHT,
      },
      data: { graphNode: n },
    };
  });
  const edges = graph.edges.map((e) => ({
    id: `${e.sourceKey}${e.handle ? `[${e.handle}]` : ""}->${e.targetKey}`,
    source: e.sourceKey,
    target: e.targetKey,
    sourceHandle: e.handle ?? null,
  }));
  return { nodes, edges };
}

export function fromFlow(
  flow: {
    nodes: Array<{ id: string; position?: { x: number; y: number }; data: GraphNodeData }>;
    edges: Array<{ source: string; target: string; sourceHandle?: string | null }>;
  },
  meta: { name: string; description: string | null; active: number; experimentId?: number | null },
): { name: string; description: string | null; active: number; experimentId: number | null; nodes: GraphNode[]; edges: GraphEdge[] } {
  return {
    ...meta,
    experimentId: meta.experimentId ?? null,
    nodes: flow.nodes.map((n) => ({
      ...n.data.graphNode,
      ...(n.position?.x ? { positionX: Math.round(n.position.x) } : {}),
      ...(n.position?.y ? { positionY: Math.round(n.position.y) } : {}),
    })),
    edges: flow.edges.map((e) => ({
      sourceKey: e.source,
      targetKey: e.target,
      ...(e.sourceHandle ? { handle: e.sourceHandle } : {}),
    })),
  };
}

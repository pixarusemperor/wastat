/**
 * Mapping between the storable graph (API shape) and React Flow's node/edge
 * model. Positions are view-only: layout is derived deterministically from
 * graph depth (BFS from the trigger), so saving never stores coordinates.
 */

export interface GraphNode {
  nodeKey: string;
  type: "trigger" | "keyword" | "send_text" | "send_media" | "delay" | "end";
  config: Record<string, unknown>;
}

export interface GraphEdge {
  sourceKey: string;
  targetKey: string;
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
}

const COL_WIDTH = 280;
const ROW_HEIGHT = 120;

/** BFS depth from the trigger (roots when no trigger exists). */
function depths(nodes: GraphNode[], edges: GraphEdge[]): Map<string, number> {
  const incoming = new Map<string, string[]>();
  for (const e of edges) {
    incoming.set(e.targetKey, [...(incoming.get(e.targetKey) ?? []), e.sourceKey]);
  }
  const depth = new Map<string, number>();
  const queue: string[] = [];
  for (const n of nodes) {
    if (!(incoming.get(n.nodeKey)?.length)) {
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
  // Disconnected / loop-isolated nodes get depth 0 so they're visible.
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
      position: { x: col * COL_WIDTH, y: row * ROW_HEIGHT },
      data: { graphNode: n },
    };
  });
  const edges = graph.edges.map((e) => ({
    id: `${e.sourceKey}->${e.targetKey}`,
    source: e.sourceKey,
    target: e.targetKey,
  }));
  return { nodes, edges };
}

export function fromFlow(
  flow: { nodes: Array<{ id: string; data: GraphNodeData }>; edges: Array<{ source: string; target: string }> },
  meta: { name: string; description: string | null; active: number; experimentId?: number | null },
): { name: string; description: string | null; active: number; experimentId: number | null; nodes: GraphNode[]; edges: GraphEdge[] } {
  return {
    ...meta,
    experimentId: meta.experimentId ?? null,
    nodes: flow.nodes.map((n) => n.data.graphNode),
    edges: flow.edges.map((e) => ({ sourceKey: e.source, targetKey: e.target })),
  };
}

import { describe, expect, it } from "vitest";
import { toFlow, fromFlow, type GraphNode, type GraphEdge } from "./graph.js";

const graph = {
  id: 1,
  name: "wf",
  description: null,
  active: 1,
  nodes: [
    { nodeKey: "t", type: "trigger", config: {} },
    { nodeKey: "k", type: "keyword", config: { phrase: "price", algorithm: "exact", threshold: 100 } },
    { nodeKey: "e", type: "end", config: {} },
  ] as GraphNode[],
  edges: [
    { sourceKey: "t", targetKey: "k" },
    { sourceKey: "k", targetKey: "e" },
  ] as GraphEdge[],
};

describe("graph ↔ React Flow mapping", () => {
  it("maps graph to flow nodes laid out in columns by depth from trigger", () => {
    const { nodes, edges } = toFlow(graph);
    expect(nodes.map((n) => n.id)).toEqual(["t", "k", "e"]);
    const k = nodes.find((n) => n.id === "k")!;
    expect(k.position.x).toBeGreaterThan(nodes[0].position.x);
    expect(k.data.graphNode).toEqual(graph.nodes[1]);
    expect(edges.map((e) => [e.source, e.target])).toEqual([
      ["t", "k"],
      ["k", "e"],
    ]);
    expect(k.type).toBe("workflow");
  });

  it("round-trips back to a storable graph", () => {
    const { nodes, edges } = toFlow(graph);
    const moved = nodes.map((n) => ({ ...n, position: { ...n.position, x: n.position.x + 5 } }));
    const out = fromFlow({ nodes: moved, edges }, { name: "wf", description: null, active: 1 });
    // positions are view-only; the stored graph is identical
    expect(out.nodes).toEqual(graph.nodes);
    expect(out.edges).toEqual(graph.edges);
  });

  it("lays out branches side by side, not stacked", () => {
    const branched = {
      ...graph,
      nodes: [
        { nodeKey: "t", type: "trigger", config: {} },
        { nodeKey: "a", type: "send_text", config: { text: "a" } },
        { nodeKey: "b", type: "send_text", config: { text: "b" } },
      ] as GraphNode[],
      edges: [
        { sourceKey: "t", targetKey: "a" },
        { sourceKey: "t", targetKey: "b" },
      ] as GraphEdge[],
    };
    const { nodes } = toFlow(branched);
    const a = nodes.find((n) => n.id === "a")!;
    const b = nodes.find((n) => n.id === "b")!;
    expect(a.position.y).not.toBe(b.position.y);
    expect(a.position.x).toBe(b.position.x);
  });
});

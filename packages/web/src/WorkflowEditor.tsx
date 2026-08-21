import { useCallback, useEffect, useState } from "react";
import {
  Background,
  Controls,
  ReactFlow,
  useEdgesState,
  useNodesState,
  type Connection,
  type Edge,
  type Node,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { api } from "./api.js";
import { fromFlow, toFlow, type GraphNode, type GraphNodeData } from "./graph.js";

const NODE_TYPES = ["trigger", "keyword", "send_text", "send_media", "delay", "end"] as const;

function defaultConfig(type: (typeof NODE_TYPES)[number]): Record<string, unknown> {
  switch (type) {
    case "keyword":
      return { phrase: "", algorithm: "dice", threshold: 80 };
    case "send_text":
      return { text: "" };
    case "send_media":
      return { mediaId: null };
    case "delay":
      return { mode: "fixed", seconds: 30 };
    default:
      return {};
  }
}

export function WorkflowEditor({ id, onBack }: { id: string; onBack: () => void }) {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node<GraphNodeData>>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [meta, setMeta] = useState({ name: "", description: null as string | null, active: 0 });
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    api.getWorkflow(id).then((graph) => {
      const flow = toFlow(graph);
      setNodes(flow.nodes);
      setEdges(flow.edges);
      setMeta({ name: graph.name, description: graph.description, active: graph.active });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const onConnect = useCallback(
    (connection: Connection) => {
      setEdges((eds) =>
        eds.some((e) => e.source === connection.source && e.target === connection.target)
          ? eds
          : [
              ...eds,
              {
                id: `${connection.source}->${connection.target}`,
                source: connection.source,
                target: connection.target,
                sourceHandle: connection.sourceHandle,
                targetHandle: connection.targetHandle,
              },
            ],
      );
    },
    [setEdges],
  );

  function addNode(type: (typeof NODE_TYPES)[number]) {
    const key = `${type}_${Math.random().toString(36).slice(2, 7)}`;
    const node: GraphNode = { nodeKey: key, type, config: defaultConfig(type) };
    setNodes((ns) => [
      ...ns,
      { id: key, type: "workflow", position: { x: 40 + ns.length * 20, y: 40 + ns.length * 60 }, data: { graphNode: node } },
    ]);
    setSelectedKey(key);
  }

  function updateSelected(patch: Partial<GraphNode>) {
    if (!selectedKey) return;
    setNodes((ns) =>
      ns.map((n) =>
        n.id === selectedKey ? { ...n, data: { graphNode: { ...n.data.graphNode, ...patch } } } : n,
      ),
    );
  }

  async function save() {
    try {
      await api.saveWorkflow(id, fromFlow({ nodes, edges }, meta));
      setStatus("Saved");
      setTimeout(() => setStatus(null), 2000);
    } catch (e) {
      setStatus(String(e));
    }
  }

  const selected = nodes.find((n) => n.id === selectedKey)?.data.graphNode as GraphNode | undefined;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", fontFamily: "system-ui" }}>
      <header style={{ display: "flex", gap: 12, alignItems: "center", padding: "0.5rem 1rem", borderBottom: "1px solid #ddd" }}>
        <button onClick={onBack}>← All</button>
        <input
          value={meta.name}
          onChange={(e) => setMeta({ ...meta, name: e.target.value })}
          style={{ fontWeight: 600, flex: 1 }}
          aria-label="Workflow name"
        />
        <label style={{ fontSize: "0.9em" }}>
          <input
            type="checkbox"
            checked={meta.active === 1}
            onChange={(e) => setMeta({ ...meta, active: e.target.checked ? 1 : 0 })}
          />{" "}
          active
        </label>
        <button onClick={save}>Save</button>
        {status && <span>{status}</span>}
      </header>

      <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeClick={(_, n) => setSelectedKey(n.id)}
          fitView
        >
          <Background />
          <Controls />
        </ReactFlow>

        <aside style={{ width: 280, borderLeft: "1px solid #ddd", padding: "1rem", overflowY: "auto" }}>
          <h3 style={{ marginTop: 0 }}>Add node</h3>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {NODE_TYPES.map((t) => (
              <button key={t} onClick={() => addNode(t)}>
                {t}
              </button>
            ))}
          </div>
          {selected && (
            <NodeConfig node={selected} onChange={updateSelected} onDelete={() => {
              setNodes((ns) => ns.filter((n) => n.id !== selected.nodeKey));
              setEdges((es) => es.filter((e) => e.source !== selected.nodeKey && e.target !== selected.nodeKey));
              setSelectedKey(null);
            }} />
          )}
        </aside>
      </div>
    </div>
  );
}

function NodeConfig({
  node,
  onChange,
  onDelete,
}: {
  node: GraphNode;
  onChange: (patch: Partial<GraphNode>) => void;
  onDelete: () => void;
}) {
  const c = node.config;
  const num = (v: unknown) => (typeof v === "number" ? v : "");
  const field = { width: "100%", marginBottom: 8 } as const;

  return (
    <div style={{ marginTop: "1.5rem" }}>
      <h3>
        {node.type} <code style={{ fontWeight: 400 }}>{node.nodeKey}</code>
      </h3>
      {node.type === "keyword" && (
        <>
          <label>Phrase</label>
          <input style={field} value={String(c.phrase ?? "")} onChange={(e) => onChange({ config: { ...c, phrase: e.target.value } })} />
          <label>Algorithm</label>
          <select style={field} value={String(c.algorithm ?? "dice")} onChange={(e) => onChange({ config: { ...c, algorithm: e.target.value } })}>
            <option value="exact">exact</option>
            <option value="dice">dice</option>
            <option value="levenshtein">levenshtein</option>
          </select>
          <label>Threshold %</label>
          <input type="number" min={0} max={100} style={field} value={num(c.threshold)} onChange={(e) => onChange({ config: { ...c, threshold: Number(e.target.value) } })} />
        </>
      )}
      {node.type === "send_text" && (
        <>
          <label>Text</label>
          <textarea style={field} rows={4} value={String(c.text ?? "")} onChange={(e) => onChange({ config: { ...c, text: e.target.value } })} />
        </>
      )}
      {node.type === "send_media" && (
        <>
          <label>Media asset ID</label>
          <input type="number" style={field} value={num(c.mediaId)} onChange={(e) => onChange({ config: { ...c, mediaId: Number(e.target.value) || null } })} />
        </>
      )}
      {node.type === "delay" && (
        <>
          <label>Mode</label>
          <select style={field} value={String(c.mode ?? "fixed")} onChange={(e) => onChange({ config: { ...c, mode: e.target.value } })}>
            <option value="fixed">fixed</option>
            <option value="random">random</option>
          </select>
          {c.mode === "random" ? (
            <>
              <label>Min seconds</label>
              <input type="number" style={field} value={num(c.minSeconds)} onChange={(e) => onChange({ config: { ...c, minSeconds: Number(e.target.value) } })} />
              <label>Max seconds</label>
              <input type="number" style={field} value={num(c.maxSeconds)} onChange={(e) => onChange({ config: { ...c, maxSeconds: Number(e.target.value) } })} />
            </>
          ) : (
            <>
              <label>Seconds</label>
              <input type="number" style={field} value={num(c.seconds)} onChange={(e) => onChange({ config: { ...c, seconds: Number(e.target.value) } })} />
            </>
          )}
        </>
      )}
      {(node.type === "trigger" || node.type === "end") && <p>No configuration.</p>}
      <button onClick={onDelete} style={{ color: "crimson" }}>
        Delete node
      </button>
    </div>
  );
}

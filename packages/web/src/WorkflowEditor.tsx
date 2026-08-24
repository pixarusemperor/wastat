import { useCallback, useEffect, useRef, useState } from "react";
import {
  Background,
  Controls,
  Handle,
  Position,
  ReactFlow,
  useEdgesState,
  useNodesState,
  type Connection,
  type Edge,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { api } from "./api.js";
import { fromFlow, toFlow, type GraphNode, type GraphNodeData } from "./graph.js";

export const NODE_TYPES = [
  "trigger",
  "keyword",
  "send_text",
  "send_media",
  "send_menu",
  "collect_input",
  "condition",
  "split_test",
  "delay",
  "end",
] as const;

export const NODE_LABELS: Record<(typeof NODE_TYPES)[number], string> = {
  trigger: "Trigger",
  keyword: "Keyword match",
  send_text: "Send text",
  send_media: "Send media",
  send_menu: "Send menu (Options)",
  collect_input: "Collect input (Var)",
  condition: "Condition (If/Else)",
  split_test: "A/B Split test",
  delay: "Delay",
  end: "End",
};

export const NODE_ICONS: Record<(typeof NODE_TYPES)[number], string> = {
  trigger: "⚡",
  keyword: "🔍",
  send_text: "💬",
  send_media: "🖼️",
  send_menu: "📋",
  collect_input: "✍️",
  condition: "🔀",
  split_test: "🎲",
  delay: "⏳",
  end: "🏁",
};

export const NODE_THEMES: Record<(typeof NODE_TYPES)[number], { border: string; bg: string; badge: string }> = {
  trigger: { border: "#10b981", bg: "#ecfdf5", badge: "#059669" },
  keyword: { border: "#06b6d4", bg: "#ecfeff", badge: "#0891b2" },
  send_text: { border: "#3b82f6", bg: "#eff6ff", badge: "#2563eb" },
  send_media: { border: "#8b5cf6", bg: "#f5f3ff", badge: "#7c3aed" },
  send_menu: { border: "#f59e0b", bg: "#fffbeb", badge: "#d97706" },
  collect_input: { border: "#14b8a6", bg: "#f0fdfa", badge: "#0d9488" },
  condition: { border: "#f97316", bg: "#fff7ed", badge: "#ea580c" },
  split_test: { border: "#6366f1", bg: "#eef2ff", badge: "#4f46e5" },
  delay: { border: "#eab308", bg: "#fefce8", badge: "#ca8a04" },
  end: { border: "#64748b", bg: "#f8fafc", badge: "#475569" },
};

export function defaultConfig(type: (typeof NODE_TYPES)[number]): Record<string, unknown> {
  switch (type) {
    case "trigger":
    case "keyword":
      return { phrase: "", keywords: [], algorithm: "dice", threshold: 80, priority: 0 };
    case "send_text":
      return { text: "" };
    case "send_media":
      return { mediaId: null, caption: "" };
    case "send_menu":
      return {
        header: "Choose an option",
        bodyText: "Please reply with your choice:",
        footer: "Reply with the number of your choice.",
        options: [
          { id: "opt_1", title: "Option 1", description: "First choice" },
          { id: "opt_2", title: "Option 2", description: "Second choice" },
        ],
      };
    case "collect_input":
      return {
        promptText: "Please enter your information:",
        varKey: "user_input",
        validationType: "text",
      };
    case "condition":
      return {
        subject: "var",
        subjectKey: "score",
        operator: "greater_than",
        value: "50",
      };
    case "split_test":
      return {
        variants: [
          { id: "var_a", name: "Variant A", weight: 50 },
          { id: "var_b", name: "Variant B", weight: 50 },
        ],
      };
    case "delay":
      return { mode: "fixed", seconds: 30 };
    default:
      return {};
  }
}

/** Custom Node Component for React Flow */
export function CustomWorkflowNode({ data, selected }: NodeProps<Node<GraphNodeData>>) {
  const node = data.graphNode;
  const theme = NODE_THEMES[node.type] ?? NODE_THEMES.end;
  const c = (node.config ?? {}) as Record<string, any>;

  return (
    <div
      className={`flow-node-card ${selected ? "flow-node-selected" : ""}`}
      style={{
        borderColor: selected ? "var(--accent)" : theme.border,
        boxShadow: selected ? `0 0 0 2px ${theme.badge}40` : undefined,
      }}
    >
      {node.type !== "trigger" && (
        <Handle
          type="target"
          position={Position.Top}
          style={{ background: theme.badge, width: 10, height: 10 }}
        />
      )}

      <div className="flow-node-header" style={{ background: theme.bg }}>
        <span className="flow-node-icon">{NODE_ICONS[node.type]}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="flow-node-type-label" style={{ color: theme.badge }}>
            {NODE_LABELS[node.type]}
          </div>
          <div className="flow-node-key-label">{node.nodeKey}</div>
        </div>
      </div>

      <div className="flow-node-body">
        {node.type === "keyword" && (
          <div className="flow-node-summary">
            {c.phrase ? `"${c.phrase}"` : c.keywords?.length ? c.keywords.join(", ") : "No keyword set"}
          </div>
        )}
        {node.type === "trigger" && (
          <div className="flow-node-summary">
            {c.phrase || c.keywords?.length ? `Keywords: ${c.phrase || c.keywords?.join(", ")}` : "Starts on inbound match"}
          </div>
        )}
        {node.type === "send_text" && (
          <div className="flow-node-summary">
            {c.text ? c.text.slice(0, 70) + (c.text.length > 70 ? "…" : "") : <span style={{ color: "var(--muted)" }}>Empty message</span>}
          </div>
        )}
        {node.type === "send_media" && (
          <div className="flow-node-summary">
            {c.mediaId ? `Asset #${c.mediaId}` : "No media selected"}
            {c.caption ? ` • "${c.caption.slice(0, 30)}"` : ""}
          </div>
        )}
        {node.type === "send_menu" && (
          <div className="flow-node-menu-list">
            <div style={{ fontSize: "0.75rem", fontWeight: 600, marginBottom: 4 }}>
              {c.header || "Menu Options"}
            </div>
            {(c.options ?? []).map((opt: any, idx: number) => (
              <div key={opt.id || idx} className="flow-node-option-row">
                <span className="flow-node-option-badge">{idx + 1}</span>
                <span className="flow-node-option-title">{opt.title}</span>
              </div>
            ))}
          </div>
        )}
        {node.type === "collect_input" && (
          <div className="flow-node-summary">
            <div>{c.promptText ? `"${c.promptText.slice(0, 40)}"` : "Ask question"}</div>
            <div className="flow-node-var-tag">save to: &#123;&#123;vars.{c.varKey || "input"}&#125;&#125;</div>
          </div>
        )}
        {node.type === "condition" && (
          <div className="flow-node-condition-summary">
            <span style={{ fontWeight: 600 }}>{c.subjectKey || c.subject || "var"}</span> {c.operator || "equals"}{" "}
            <span style={{ color: theme.badge }}>"{c.value ?? ""}"</span>
          </div>
        )}
        {node.type === "split_test" && (
          <div className="flow-node-split-list">
            {(c.variants ?? []).map((v: any, idx: number) => (
              <div key={v.id || idx} className="flow-node-variant-chip">
                <span>{v.name || `Var ${idx + 1}`}</span>
                <span style={{ fontWeight: 600 }}>{v.weight || 50}%</span>
              </div>
            ))}
          </div>
        )}
        {node.type === "delay" && (
          <div className="flow-node-summary">
            {c.mode === "random"
              ? `Random ${c.minSeconds ?? 30}s – ${c.maxSeconds ?? 90}s`
              : `Wait ${c.seconds ?? 30}s`}
          </div>
        )}
        {node.type === "end" && (
          <div className="flow-node-summary" style={{ color: "var(--muted)" }}>
            Workflow completes
          </div>
        )}
      </div>

      {/* Dynamic Handles */}
      {node.type === "condition" ? (
        <div className="flow-node-handles-bar">
          <div className="flow-node-handle-slot">
            <span className="flow-handle-label text-emerald">True</span>
            <Handle
              type="source"
              position={Position.Bottom}
              id="true"
              style={{ left: "30%", background: "#10b981", width: 10, height: 10 }}
            />
          </div>
          <div className="flow-node-handle-slot">
            <span className="flow-handle-label text-rose">False</span>
            <Handle
              type="source"
              position={Position.Bottom}
              id="false"
              style={{ left: "70%", background: "#ef4444", width: 10, height: 10 }}
            />
          </div>
        </div>
      ) : node.type === "send_menu" ? (
        <div className="flow-node-handles-bar flow-node-menu-handles">
          {(c.options ?? []).map((opt: any, idx: number) => {
            const count = (c.options ?? []).length;
            const leftPct = count <= 1 ? 50 : 20 + (idx * 60) / (count - 1);
            return (
              <div key={opt.id || idx} className="flow-node-handle-slot">
                <span className="flow-handle-label">#{idx + 1}</span>
                <Handle
                  type="source"
                  position={Position.Bottom}
                  id={opt.id}
                  style={{ left: `${leftPct}%`, background: "#f59e0b", width: 9, height: 9 }}
                />
              </div>
            );
          })}
        </div>
      ) : node.type === "split_test" ? (
        <div className="flow-node-handles-bar">
          {(c.variants ?? []).map((v: any, idx: number) => {
            const count = (c.variants ?? []).length;
            const leftPct = count <= 1 ? 50 : 25 + (idx * 50) / (count - 1);
            return (
              <div key={v.id || idx} className="flow-node-handle-slot">
                <span className="flow-handle-label">{v.id}</span>
                <Handle
                  type="source"
                  position={Position.Bottom}
                  id={v.id}
                  style={{ left: `${leftPct}%`, background: "#6366f1", width: 9, height: 9 }}
                />
              </div>
            );
          })}
        </div>
      ) : node.type !== "end" ? (
        <Handle
          type="source"
          position={Position.Bottom}
          style={{ background: theme.badge, width: 10, height: 10 }}
        />
      ) : null}
    </div>
  );
}

const nodeTypes = {
  workflow: CustomWorkflowNode,
};

export function WorkflowEditor({ id, onBack }: { id: string; onBack: () => void }) {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node<GraphNodeData>>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [meta, setMeta] = useState({
    name: "",
    description: null as string | null,
    active: 0,
    experimentId: null as number | null,
  });
  const [experiments, setExperiments] = useState<Array<{ id: number; name: string }>>([]);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [toast, setToast] = useState<{ text: string; error?: boolean } | null>(null);
  const [showSimulator, setShowSimulator] = useState(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    api.listExperiments().then(setExperiments).catch(() => {});
    api.getWorkflow(id).then((graph) => {
      const flow = toFlow(graph);
      setNodes(flow.nodes);
      setEdges(flow.edges);
      setMeta({
        name: graph.name,
        description: graph.description,
        active: graph.active,
        experimentId: graph.experimentId ?? null,
      });
    });
  }, [id, setEdges, setNodes]);

  function showToast(text: string, error = false) {
    clearTimeout(toastTimer.current);
    setToast({ text, error });
    toastTimer.current = setTimeout(() => setToast(null), 2500);
  }

  const onConnect = useCallback(
    (connection: Connection) => {
      setEdges((eds) => {
        const edgeId = `${connection.source}${connection.sourceHandle ? `[${connection.sourceHandle}]` : ""}->${connection.target}`;
        if (eds.some((e) => e.source === connection.source && e.target === connection.target && e.sourceHandle === connection.sourceHandle)) {
          return eds;
        }
        return [
          ...eds,
          {
            id: edgeId,
            source: connection.source,
            target: connection.target,
            sourceHandle: connection.sourceHandle ?? null,
            targetHandle: connection.targetHandle ?? null,
          },
        ];
      });
    },
    [setEdges],
  );

  function addNode(type: (typeof NODE_TYPES)[number]) {
    const key = `${type}_${Math.random().toString(36).slice(2, 7)}`;
    const node: GraphNode = { nodeKey: key, type, config: defaultConfig(type) };
    setNodes((ns) => [
      ...ns,
      {
        id: key,
        type: "workflow",
        position: { x: 60 + ns.length * 30, y: 60 + ns.length * 40 },
        data: { graphNode: node },
      },
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

  function autoLayout() {
    const currentGraph = fromFlow({ nodes, edges }, meta);
    const flow = toFlow(currentGraph);
    setNodes(flow.nodes);
    showToast("Layout refreshed");
  }

  async function save() {
    try {
      await api.saveWorkflow(id, fromFlow({ nodes, edges }, meta));
      showToast("Workflow saved successfully");
    } catch {
      showToast("Save failed — check your connection and retry", true);
    }
  }

  async function duplicate() {
    try {
      const copyName = `${meta.name} (Copy)`;
      const created = await api.createWorkflow(copyName, meta.experimentId);
      const graph = fromFlow({ nodes, edges }, { ...meta, name: copyName, active: 0 });
      await api.saveWorkflow(String(created.id), graph);
      showToast("Workflow duplicated");
      window.location.hash = `#/workflows/${created.id}`;
    } catch {
      showToast("Duplicate failed", true);
    }
  }

  const selected = nodes.find((n) => n.id === selectedKey)?.data.graphNode as GraphNode | undefined;

  return (
    <div className="editor">
      <header className="editor-toolbar">
        <button className="btn btn-ghost" onClick={onBack} aria-label="Back to workflows">
          ← All
        </button>
        <input
          className="editor-name"
          value={meta.name}
          onChange={(e) => setMeta({ ...meta, name: e.target.value })}
          aria-label="Workflow name"
          placeholder="Untitled workflow"
        />

        <div className="toolbar-experiment-select">
          <label htmlFor="wf-exp-select" style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
            Experiment:
          </label>
          <select
            id="wf-exp-select"
            className="input-select-sm"
            value={meta.experimentId ?? ""}
            onChange={(e) => {
              const val = e.target.value;
              setMeta({ ...meta, experimentId: val ? Number(val) : null });
            }}
          >
            <option value="">None (Standalone)</option>
            {experiments.map((exp) => (
              <option key={exp.id} value={exp.id}>
                {exp.name}
              </option>
            ))}
          </select>
        </div>

        <button className="btn btn-ghost btn-sm" onClick={autoLayout} title="Auto-layout graph">
          ⚡ Auto-Layout
        </button>

        <button
          className="btn btn-ghost btn-sm"
          onClick={() => setShowSimulator(true)}
          style={{ borderColor: "var(--accent)", color: "var(--accent)" }}
        >
          ▶ Test Simulator
        </button>

        <label className="switch">
          <input
            type="checkbox"
            checked={meta.active === 1}
            onChange={(e) => setMeta({ ...meta, active: e.target.checked ? 1 : 0 })}
            aria-label="Live — replies to matching incoming messages"
          />
          <span className="switch-track" aria-hidden />
          <span className="switch-label">{meta.active === 1 ? "Live" : "Draft"}</span>
        </label>
        <button className="btn btn-ghost btn-sm" onClick={duplicate} title="Duplicate this workflow">
          Duplicate
        </button>
        <button className="btn btn-primary" onClick={save}>
          Save
        </button>
      </header>

      <div className="editor-main">
        <div style={{ flex: 1, position: "relative", height: "100%" }}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={(_, n) => setSelectedKey(n.id)}
            fitView
          >
            <Background />
            <Controls />
          </ReactFlow>
        </div>

        <aside className="side-panel">
          <div className="palette-header">
            <p className="panel-title">Add Step</p>
          </div>
          <div className="palette-grid-flow">
            {NODE_TYPES.map((t) => (
              <button
                key={t}
                className="palette-btn-flow"
                onClick={() => addNode(t)}
                style={{ borderLeftColor: NODE_THEMES[t]?.border }}
              >
                <span style={{ fontSize: "1.1rem" }}>{NODE_ICONS[t]}</span>
                <span>{NODE_LABELS[t]}</span>
              </button>
            ))}
          </div>

          <hr style={{ margin: "1rem 0", borderColor: "var(--border)" }} />

          {selected ? (
            <NodeConfig
              node={selected}
              onChange={updateSelected}
              onDelete={() => {
                setNodes((ns) => ns.filter((n) => n.id !== selected.nodeKey));
                setEdges((es) =>
                  es.filter((e) => e.source !== selected.nodeKey && e.target !== selected.nodeKey),
                );
                setSelectedKey(null);
              }}
            />
          ) : (
            <div className="empty-selection-hint">
              <p style={{ color: "var(--muted)", fontSize: "0.85rem", textAlign: "center" }}>
                Select a step on the canvas to configure variables, branching, or messages.
              </p>
            </div>
          )}
        </aside>
      </div>

      {showSimulator && (
        <FlowSimulatorModal
          graph={fromFlow({ nodes, edges }, meta)}
          onClose={() => setShowSimulator(false)}
        />
      )}

      {toast && (
        <div className={`toast ${toast.error ? "toast-error" : ""}`} role="status">
          {toast.text}
        </div>
      )}
    </div>
  );
}

function VariablePills({ onInsert }: { onInsert: (tag: string) => void }) {
  const commonVars = [
    { label: "Phone", tag: "{{contact.phone}}" },
    { label: "Name", tag: "{{contact.name}}" },
    { label: "Selected Opt", tag: "{{vars.selected_option}}" },
  ];

  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 4, margin: "4px 0 8px 0" }}>
      <span style={{ fontSize: "0.75rem", color: "var(--muted)", alignSelf: "center", marginRight: 2 }}>
        Insert:
      </span>
      {commonVars.map((v) => (
        <button
          key={v.tag}
          type="button"
          className="btn-var-pill"
          onClick={() => onInsert(v.tag)}
        >
          {v.label}
        </button>
      ))}
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
  const c = (node.config ?? {}) as Record<string, any>;
  const num = (v: unknown) => (typeof v === "number" ? v : "");
  const fieldLabel = (text: string, htmlFor?: string) => (
    <label className="field-label" htmlFor={htmlFor}>
      {text}
    </label>
  );

  return (
    <div className="config-section">
      <div className="config-header-row">
        <div>
          <span className="config-node-type" style={{ background: NODE_THEMES[node.type]?.bg, color: NODE_THEMES[node.type]?.badge }}>
            {NODE_ICONS[node.type]} {NODE_LABELS[node.type] ?? node.type}
          </span>
          <div className="config-key">Key: {node.nodeKey}</div>
        </div>
      </div>

      <div style={{ marginTop: "0.75rem" }}>
        {(node.type === "keyword" || node.type === "trigger") && (
          <>
            {fieldLabel("Primary Match Phrase", "cfg-phrase")}
            <input
              id="cfg-phrase"
              className="input"
              placeholder='e.g. "price" or "talk to agent"'
              value={String(c.phrase ?? "")}
              onChange={(e) => onChange({ config: { ...c, phrase: e.target.value } })}
            />

            {fieldLabel("Additional Keywords (comma separated)", "cfg-keywords")}
            <input
              id="cfg-keywords"
              className="input"
              placeholder="pricing, cost, plans"
              value={Array.isArray(c.keywords) ? c.keywords.join(", ") : ""}
              onChange={(e) =>
                onChange({
                  config: {
                    ...c,
                    keywords: e.target.value
                      .split(",")
                      .map((s) => s.trim())
                      .filter(Boolean),
                  },
                })
              }
            />

            {fieldLabel("Matching Algorithm", "cfg-alg")}
            <select
              id="cfg-alg"
              className="select"
              value={String(c.algorithm ?? "dice")}
              onChange={(e) => onChange({ config: { ...c, algorithm: e.target.value } })}
            >
              <option value="exact">Exact Match</option>
              <option value="dice">Fuzzy — Word Order Tolerant (Dice)</option>
              <option value="levenshtein">Fuzzy — Typo Tolerant (Levenshtein)</option>
            </select>

            {fieldLabel(`Match Threshold: ${Number(c.threshold ?? 80)}%`, "cfg-threshold")}
            <input
              id="cfg-threshold"
              type="range"
              min={50}
              max={100}
              step={5}
              style={{ width: "100%" }}
              value={num(c.threshold) || 80}
              onChange={(e) => onChange({ config: { ...c, threshold: Number(e.target.value) } })}
            />

            {fieldLabel("Trigger Priority (Higher runs first)", "cfg-priority")}
            <input
              id="cfg-priority"
              className="input"
              type="number"
              value={num(c.priority) || 0}
              onChange={(e) => onChange({ config: { ...c, priority: Number(e.target.value) } })}
            />
          </>
        )}

        {node.type === "send_text" && (
          <>
            {fieldLabel("Message Text", "cfg-text")}
            <VariablePills
              onInsert={(tag) =>
                onChange({ config: { ...c, text: `${c.text ?? ""}${tag}` } })
              }
            />
            <textarea
              id="cfg-text"
              className="textarea"
              rows={5}
              placeholder="Type your message with {{vars.x}} support..."
              value={String(c.text ?? "")}
              onChange={(e) => onChange({ config: { ...c, text: e.target.value } })}
            />
          </>
        )}

        {node.type === "send_media" && (
          <MediaConfigSection
            mediaId={c.mediaId as number | undefined}
            caption={String(c.caption ?? c.text ?? "")}
            onChangeMedia={(mediaId) => onChange({ config: { ...c, mediaId } })}
            onChangeCaption={(caption) => onChange({ config: { ...c, caption, text: caption } })}
          />
        )}

        {node.type === "send_menu" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            <div>
              {fieldLabel("Menu Header (Bold Title)", "cfg-menu-header")}
              <input
                id="cfg-menu-header"
                className="input"
                placeholder="Main Menu"
                value={String(c.header ?? "")}
                onChange={(e) => onChange({ config: { ...c, header: e.target.value } })}
              />
            </div>
            <div>
              {fieldLabel("Menu Body Text", "cfg-menu-body")}
              <textarea
                id="cfg-menu-body"
                className="textarea"
                rows={3}
                placeholder="How can we assist you today?"
                value={String(c.bodyText ?? "")}
                onChange={(e) => onChange({ config: { ...c, bodyText: e.target.value } })}
              />
            </div>

            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <span className="field-label" style={{ margin: 0 }}>Options (Routed via handles)</span>
                <button
                  type="button"
                  className="btn btn-sm btn-ghost"
                  onClick={() => {
                    const opts = [...(c.options ?? [])];
                    const nextId = `opt_${opts.length + 1}`;
                    opts.push({ id: nextId, title: `Option ${opts.length + 1}`, description: "" });
                    onChange({ config: { ...c, options: opts } });
                  }}
                >
                  + Add Option
                </button>
              </div>

              {(c.options ?? []).map((opt: any, idx: number) => (
                <div key={opt.id || idx} className="config-option-card">
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                    <span style={{ fontWeight: 600, fontSize: "0.8rem" }}>Option #{idx + 1} (Handle: {opt.id})</span>
                    {(c.options ?? []).length > 1 && (
                      <button
                        type="button"
                        className="btn-link-danger"
                        onClick={() => {
                          const opts = (c.options ?? []).filter((_: any, i: number) => i !== idx);
                          onChange({ config: { ...c, options: opts } });
                        }}
                      >
                        ✕
                      </button>
                    )}
                  </div>
                  <input
                    className="input"
                    placeholder="Title (e.g. Sales)"
                    style={{ marginBottom: 4 }}
                    value={opt.title ?? ""}
                    onChange={(e) => {
                      const opts = [...(c.options ?? [])];
                      opts[idx] = { ...opts[idx], title: e.target.value };
                      onChange({ config: { ...c, options: opts } });
                    }}
                  />
                  <input
                    className="input"
                    placeholder="Description (optional)"
                    style={{ fontSize: "0.8rem" }}
                    value={opt.description ?? ""}
                    onChange={(e) => {
                      const opts = [...(c.options ?? [])];
                      opts[idx] = { ...opts[idx], description: e.target.value };
                      onChange({ config: { ...c, options: opts } });
                    }}
                  />
                </div>
              ))}
            </div>

            <div>
              {fieldLabel("Menu Footer", "cfg-menu-footer")}
              <input
                id="cfg-menu-footer"
                className="input"
                placeholder="Reply with the number of your choice."
                value={String(c.footer ?? "")}
                onChange={(e) => onChange({ config: { ...c, footer: e.target.value } })}
              />
            </div>
          </div>
        )}

        {node.type === "collect_input" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            <div>
              {fieldLabel("Prompt Question", "cfg-input-prompt")}
              <VariablePills
                onInsert={(tag) =>
                  onChange({ config: { ...c, promptText: `${c.promptText ?? ""}${tag}` } })
                }
              />
              <textarea
                id="cfg-input-prompt"
                className="textarea"
                rows={3}
                placeholder="What is your full name?"
                value={String(c.promptText ?? "")}
                onChange={(e) => onChange({ config: { ...c, promptText: e.target.value } })}
              />
            </div>

            <div>
              {fieldLabel("Variable Key to Store Answer", "cfg-input-var")}
              <input
                id="cfg-input-var"
                className="input"
                placeholder="e.g. customer_name"
                value={String(c.varKey ?? "")}
                onChange={(e) => onChange({ config: { ...c, varKey: e.target.value.replace(/[^a-zA-Z0-9_]/g, "") } })}
              />
              <span style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
                Reference later as &#123;&#123;vars.{c.varKey || "key"}&#125;&#125;
              </span>
            </div>
          </div>
        )}

        {node.type === "condition" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            <div>
              {fieldLabel("Condition Subject", "cfg-cond-sub")}
              <select
                id="cfg-cond-sub"
                className="select"
                value={String(c.subject ?? "var")}
                onChange={(e) => onChange({ config: { ...c, subject: e.target.value } })}
              >
                <option value="var">Stored Variable (vars.key)</option>
                <option value="message_text">Inbound Trigger Message</option>
                <option value="contact_field">Contact Profile Field</option>
              </select>
            </div>

            {c.subject === "var" && (
              <div>
                {fieldLabel("Variable Name", "cfg-cond-varkey")}
                <input
                  id="cfg-cond-varkey"
                  className="input"
                  placeholder="e.g. score or plan"
                  value={String(c.subjectKey ?? "")}
                  onChange={(e) => onChange({ config: { ...c, subjectKey: e.target.value } })}
                />
              </div>
            )}

            <div>
              {fieldLabel("Operator", "cfg-cond-op")}
              <select
                id="cfg-cond-op"
                className="select"
                value={String(c.operator ?? "equals")}
                onChange={(e) => onChange({ config: { ...c, operator: e.target.value } })}
              >
                <option value="equals">Equals (case insensitive)</option>
                <option value="contains">Contains substring</option>
                <option value="starts_with">Starts with</option>
                <option value="present">Is Present / Not Empty</option>
                <option value="absent">Is Empty / Absent</option>
                <option value="greater_than">Numeric: Greater Than (&gt;)</option>
                <option value="less_than">Numeric: Less Than (&lt;)</option>
              </select>
            </div>

            {c.operator !== "present" && c.operator !== "absent" && (
              <div>
                {fieldLabel("Comparison Value", "cfg-cond-val")}
                <input
                  id="cfg-cond-val"
                  className="input"
                  placeholder="e.g. 50 or VIP"
                  value={String(c.value ?? "")}
                  onChange={(e) => onChange({ config: { ...c, value: e.target.value } })}
                />
              </div>
            )}

            <div className="condition-branch-legend">
              <div style={{ color: "#059669", fontWeight: 600 }}>🟢 True Edge: Connect from "True" handle</div>
              <div style={{ color: "#dc2626", fontWeight: 600 }}>🔴 False Edge: Connect from "False" handle</div>
            </div>
          </div>
        )}

        {node.type === "split_test" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span className="field-label" style={{ margin: 0 }}>Variants & Traffic Weights</span>
              <button
                type="button"
                className="btn btn-sm btn-ghost"
                onClick={() => {
                  const vars = [...(c.variants ?? [])];
                  const code = String.fromCharCode(65 + vars.length);
                  vars.push({ id: `var_${code.toLowerCase()}`, name: `Variant ${code}`, weight: 50 });
                  onChange({ config: { ...c, variants: vars } });
                }}
              >
                + Add Variant
              </button>
            </div>

            {(c.variants ?? []).map((v: any, idx: number) => (
              <div key={v.id || idx} className="config-option-card">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontWeight: 600, fontSize: "0.8rem" }}>Handle ID: {v.id}</span>
                  {(c.variants ?? []).length > 1 && (
                    <button
                      type="button"
                      className="btn-link-danger"
                      onClick={() => {
                        const vars = (c.variants ?? []).filter((_: any, i: number) => i !== idx);
                        onChange({ config: { ...c, variants: vars } });
                      }}
                    >
                      ✕
                    </button>
                  )}
                </div>
                <input
                  className="input"
                  style={{ margin: "4px 0" }}
                  value={v.name ?? ""}
                  placeholder="Variant name"
                  onChange={(e) => {
                    const vars = [...(c.variants ?? [])];
                    vars[idx] = { ...vars[idx], name: e.target.value };
                    onChange({ config: { ...c, variants: vars } });
                  }}
                />
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: "0.75rem", color: "var(--muted)" }}>Weight:</span>
                  <input
                    type="range"
                    min={1}
                    max={100}
                    style={{ flex: 1 }}
                    value={v.weight ?? 50}
                    onChange={(e) => {
                      const vars = [...(c.variants ?? [])];
                      vars[idx] = { ...vars[idx], weight: Number(e.target.value) };
                      onChange({ config: { ...c, variants: vars } });
                    }}
                  />
                  <span style={{ fontSize: "0.8rem", fontWeight: 600 }}>{v.weight ?? 50}%</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {node.type === "delay" && (
          <>
            {fieldLabel("Wait Mode", "cfg-mode")}
            <select
              id="cfg-mode"
              className="select"
              value={String(c.mode ?? "fixed")}
              onChange={(e) => onChange({ config: { ...c, mode: e.target.value } })}
            >
              <option value="fixed">Fixed Duration</option>
              <option value="random">Random Anti-Ban Jitter Range</option>
            </select>
            {c.mode === "random" ? (
              <>
                {fieldLabel("Minimum Seconds", "cfg-min")}
                <input
                  id="cfg-min"
                  className="input"
                  type="number"
                  min={0}
                  value={num(c.minSeconds)}
                  onChange={(e) => onChange({ config: { ...c, minSeconds: Number(e.target.value) } })}
                />
                {fieldLabel("Maximum Seconds", "cfg-max")}
                <input
                  id="cfg-max"
                  className="input"
                  type="number"
                  min={0}
                  value={num(c.maxSeconds)}
                  onChange={(e) => onChange({ config: { ...c, maxSeconds: Number(e.target.value) } })}
                />
              </>
            ) : (
              <>
                {fieldLabel("Seconds to Wait", "cfg-sec")}
                <input
                  id="cfg-sec"
                  className="input"
                  type="number"
                  min={0}
                  value={num(c.seconds)}
                  onChange={(e) => onChange({ config: { ...c, seconds: Number(e.target.value) } })}
                />
              </>
            )}
          </>
        )}

        {(node.type === "trigger" || node.type === "end") && (
          <p style={{ color: "var(--muted)", fontSize: "0.85rem" }}>
            {node.type === "trigger"
              ? "This step triggers the flow when an incoming message matches."
              : "Reaching this terminal step gracefully completes the execution."}
          </p>
        )}
      </div>

      <button
        className="btn btn-danger btn-sm"
        style={{ marginTop: "1.25rem", width: "100%" }}
        onClick={() => {
          if (window.confirm(`Remove this ${NODE_LABELS[node.type]} step?`)) onDelete();
        }}
      >
        Delete Step
      </button>
    </div>
  );
}

function MediaConfigSection({
  mediaId,
  caption,
  onChangeMedia,
  onChangeCaption,
}: {
  mediaId?: number | null;
  caption: string;
  onChangeMedia: (id: number | null) => void;
  onChangeCaption: (caption: string) => void;
}) {
  const [assets, setAssets] = useState<
    Array<{ id: number; filename: string; mimeType: string; publicUrl: string }>
  >([]);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void api.listMedia().then(setAssets).catch(() => {});
  }, []);

  const selectedAsset = assets.find((a) => a.id === mediaId);

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadError(null);
    try {
      const created = await api.uploadMedia(file);
      setAssets((prev) => [created, ...prev.filter((a) => a.id !== created.id)]);
      onChangeMedia(created.id);
    } catch (err) {
      setUploadError(String(err));
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
      <label className="field-label" htmlFor="cfg-media-select">
        Select Media Asset
      </label>
      <select
        id="cfg-media-select"
        className="select"
        value={mediaId ?? ""}
        onChange={(e) => onChangeMedia(e.target.value ? Number(e.target.value) : null)}
      >
        <option value="">-- Choose an uploaded asset --</option>
        {assets.map((a) => (
          <option key={a.id} value={a.id}>
            {a.filename} ({a.mimeType})
          </option>
        ))}
      </select>

      {selectedAsset && (
        <div
          style={{
            background: "var(--surface-sunken)",
            padding: "0.625rem",
            borderRadius: "var(--radius-sm)",
            fontSize: "0.8125rem",
          }}
        >
          <div style={{ fontWeight: 600 }}>{selectedAsset.filename}</div>
          <div style={{ color: "var(--muted)", fontSize: "0.75rem" }}>{selectedAsset.mimeType}</div>
          {selectedAsset.mimeType.startsWith("image/") && (
            <img
              src={selectedAsset.publicUrl}
              alt={selectedAsset.filename}
              style={{
                maxWidth: "100%",
                maxHeight: 120,
                objectFit: "contain",
                marginTop: "0.5rem",
                borderRadius: "var(--radius-sm)",
              }}
            />
          )}
        </div>
      )}

      <div>
        <label className="field-label">Or Upload New File</label>
        <input
          ref={fileInputRef}
          type="file"
          className="input"
          onChange={handleFileUpload}
          disabled={uploading}
        />
        {uploading && <p style={{ fontSize: "0.75rem", color: "var(--muted)", margin: "0.25rem 0" }}>Uploading to R2 storage…</p>}
        {uploadError && <p style={{ fontSize: "0.75rem", color: "var(--danger)", margin: "0.25rem 0" }}>{uploadError}</p>}
      </div>

      <div>
        <label className="field-label" htmlFor="cfg-media-caption">
          Caption with Variable Interpolation
        </label>
        <VariablePills onInsert={(tag) => onChangeCaption(`${caption}${tag}`)} />
        <textarea
          id="cfg-media-caption"
          className="textarea"
          rows={2}
          placeholder="Caption for image/video..."
          value={caption}
          onChange={(e) => onChangeCaption(e.target.value)}
        />
      </div>
    </div>
  );
}

/** Interactive Flow Simulator Component */
function FlowSimulatorModal({
  graph,
  onClose,
}: {
  graph: ReturnType<typeof fromFlow>;
  onClose: () => void;
}) {
  const [messages, setMessages] = useState<Array<{ sender: "user" | "bot"; text: string; time: string }>>([
    { sender: "bot", text: "⚡ Simulation started. Send a message to trigger the flow.", time: "now" },
  ]);
  const [input, setInput] = useState("");
  const [vars, setVars] = useState<Record<string, unknown>>({});
  const [currentNodeKey, setCurrentNodeKey] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "running" | "waiting_input" | "completed">("idle");

  const nodesMap = new Map(graph.nodes.map((n) => [n.nodeKey, n]));

  function getNextEdge(fromKey: string, handle?: string) {
    if (handle) {
      const match = graph.edges.find((e) => e.sourceKey === fromKey && e.handle === handle);
      if (match) return match.targetKey;
    }
    const def = graph.edges.find((e) => e.sourceKey === fromKey && !e.handle);
    return def ? def.targetKey : null;
  }

  function runFromNode(startKey: string, initialVars = vars) {
    let curKey: string | null = startKey;
    let localVars = { ...initialVars };

    while (curKey) {
      const node = nodesMap.get(curKey);
      if (!node) break;
      const c = (node.config ?? {}) as Record<string, any>;

      if (node.type === "send_text") {
        let text = c.text ?? "";
        for (const [k, v] of Object.entries(localVars)) {
          text = text.replaceAll(`{{vars.${k}}}`, String(v));
        }
        text = text.replaceAll("{{contact.phone}}", "+237652474378");
        setMessages((prev) => [...prev, { sender: "bot", text, time: new Date().toLocaleTimeString() }]);
        curKey = getNextEdge(curKey);
      } else if (node.type === "send_menu") {
        const lines: string[] = [];
        if (c.header) lines.push(`*${c.header}*\n`);
        if (c.bodyText) lines.push(c.bodyText);
        lines.push("");
        (c.options ?? []).forEach((opt: any, idx: number) => {
          lines.push(`*${idx + 1}.* ${opt.title}${opt.description ? ` - _${opt.description}_` : ""}`);
        });
        lines.push(`\n_${c.footer || "Reply with the number of your choice."}_`);

        setMessages((prev) => [
          ...prev,
          { sender: "bot", text: lines.join("\n"), time: new Date().toLocaleTimeString() },
        ]);
        setCurrentNodeKey(curKey);
        setStatus("waiting_input");
        setVars(localVars);
        return;
      } else if (node.type === "collect_input") {
        if (c.promptText) {
          setMessages((prev) => [
            ...prev,
            { sender: "bot", text: c.promptText, time: new Date().toLocaleTimeString() },
          ]);
        }
        setCurrentNodeKey(curKey);
        setStatus("waiting_input");
        setVars(localVars);
        return;
      } else if (node.type === "condition") {
        const targetVal = String(localVars[c.subjectKey] ?? "");
        const expected = String(c.value ?? "");
        let isTrue = false;
        if (c.operator === "equals") isTrue = targetVal.toLowerCase() === expected.toLowerCase();
        else if (c.operator === "contains") isTrue = targetVal.toLowerCase().includes(expected.toLowerCase());
        else if (c.operator === "present") isTrue = targetVal.length > 0;
        else if (c.operator === "greater_than") isTrue = Number(targetVal) > Number(expected);
        else if (c.operator === "less_than") isTrue = Number(targetVal) < Number(expected);

        curKey = getNextEdge(curKey, isTrue ? "true" : "false");
      } else if (node.type === "delay") {
        setMessages((prev) => [
          ...prev,
          {
            sender: "bot",
            text: `⏳ [Delay: ${c.seconds ?? 5}s elapsed]`,
            time: new Date().toLocaleTimeString(),
          },
        ]);
        curKey = getNextEdge(curKey);
      } else if (node.type === "end") {
        setMessages((prev) => [
          ...prev,
          { sender: "bot", text: "🏁 Flow reached End node.", time: new Date().toLocaleTimeString() },
        ]);
        setStatus("completed");
        setVars(localVars);
        return;
      } else {
        curKey = getNextEdge(curKey);
      }
    }
    setStatus("completed");
    setVars(localVars);
  }

  function handleSend() {
    if (!input.trim()) return;
    const text = input.trim();
    setInput("");
    setMessages((prev) => [...prev, { sender: "user", text, time: new Date().toLocaleTimeString() }]);

    if (status === "waiting_input" && currentNodeKey) {
      const node = nodesMap.get(currentNodeKey);
      if (node?.type === "collect_input") {
        const varKey = (node.config as any)?.varKey || "input";
        const updated = { ...vars, [varKey]: text };
        setVars(updated);
        const next = getNextEdge(currentNodeKey);
        if (next) runFromNode(next, updated);
        else setStatus("completed");
        return;
      }
      if (node?.type === "send_menu") {
        const options = (node.config as any)?.options ?? [];
        const num = parseInt(text, 10);
        let optId = "";
        if (!isNaN(num) && num >= 1 && num <= options.length) {
          optId = options[num - 1].id;
        } else {
          const match = options.find((o: any) => o.title.toLowerCase().includes(text.toLowerCase()) || o.id === text);
          if (match) optId = match.id;
        }
        if (optId) {
          const updated = { ...vars, selected_option: optId };
          setVars(updated);
          const next = getNextEdge(currentNodeKey, optId);
          if (next) runFromNode(next, updated);
          else setStatus("completed");
          return;
        }
      }
    }

    // Trigger match
    const trigger = graph.nodes.find((n) => n.type === "trigger");
    if (trigger) {
      const first = getNextEdge(trigger.nodeKey);
      if (first) runFromNode(first, {});
    }
  }

  return (
    <div className="modal-backdrop">
      <div className="simulator-modal">
        <div className="simulator-header">
          <div style={{ fontWeight: 600 }}>▶ WhatsApp Flow Simulator</div>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>
            ✕ Close
          </button>
        </div>

        <div className="simulator-body">
          <div className="simulator-chat">
            {messages.map((m, idx) => (
              <div key={idx} className={`sim-bubble sim-bubble-${m.sender}`}>
                <div style={{ whiteSpace: "pre-wrap" }}>{m.text}</div>
                <div className="sim-bubble-time">{m.time}</div>
              </div>
            ))}
          </div>

          <div className="simulator-sidebar">
            <div style={{ fontWeight: 600, fontSize: "0.8rem", marginBottom: 6 }}>Execution Variables</div>
            <pre className="simulator-vars-box">
              {JSON.stringify(vars, null, 2)}
            </pre>
            <div style={{ fontSize: "0.75rem", color: "var(--muted)", marginTop: 4 }}>
              Status: <span style={{ fontWeight: 600, color: "var(--accent)" }}>{status}</span>
            </div>
          </div>
        </div>

        <div className="simulator-input-bar">
          <input
            className="input"
            placeholder="Type message as contact..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
          />
          <button className="btn btn-primary" onClick={handleSend}>
            Send
          </button>
        </div>
      </div>
    </div>
  );
}

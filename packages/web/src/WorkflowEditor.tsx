import { useCallback, useEffect, useRef, useState } from "react";
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

const NODE_LABELS: Record<(typeof NODE_TYPES)[number], string> = {
  trigger: "Trigger",
  keyword: "Keyword match",
  send_text: "Send text",
  send_media: "Send media",
  delay: "Delay",
  end: "End",
};

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
  const [meta, setMeta] = useState({
    name: "",
    description: null as string | null,
    active: 0,
    experimentId: null as number | null,
  });
  const [experiments, setExperiments] = useState<Array<{ id: number; name: string }>>([]);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [toast, setToast] = useState<{ text: string; error?: boolean } | null>(null);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  function showToast(text: string, error = false) {
    clearTimeout(toastTimer.current);
    setToast({ text, error });
    toastTimer.current = setTimeout(() => setToast(null), 2500);
  }

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
      showToast("Workflow saved");
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

        <aside className="side-panel">
          <p className="panel-title">Add step</p>
          <div className="palette-grid">
            {NODE_TYPES.map((t) => (
              <button key={t} className="palette-btn" onClick={() => addNode(t)}>
                {NODE_LABELS[t]}
              </button>
            ))}
          </div>

          {selected ? (
            <NodeConfig node={selected} onChange={updateSelected} onDelete={() => {
              setNodes((ns) => ns.filter((n) => n.id !== selected.nodeKey));
              setEdges((es) => es.filter((e) => e.source !== selected.nodeKey && e.target !== selected.nodeKey));
              setSelectedKey(null);
            }} />
          ) : (
            <p style={{ color: "var(--muted)", fontSize: "0.85rem" }}>
              Select a node on the canvas to edit it.
            </p>
          )}
        </aside>
      </div>

      {toast && (
        <div className={`toast ${toast.error ? "toast-error" : ""}`} role="status">
          {toast.text}
        </div>
      )}
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
  const fieldLabel = (text: string, htmlFor: string) => (
    <label className="field-label" htmlFor={htmlFor}>
      {text}
    </label>
  );

  return (
    <div className="config-section">
      <p className="panel-title">Selected step</p>
      <span className="config-node-type">{NODE_LABELS[node.type] ?? node.type}</span>{" "}
      <span className="config-key">{node.nodeKey}</span>

      <div style={{ marginTop: "1rem" }}>
        {node.type === "keyword" && (
          <>
            {fieldLabel("Phrase to match", "cfg-phrase")}
            <input
              id="cfg-phrase"
              className="input"
              placeholder='e.g. "I want to know the price"'
              value={String(c.phrase ?? "")}
              onChange={(e) => onChange({ config: { ...c, phrase: e.target.value } })}
            />
            {fieldLabel("Matching algorithm", "cfg-alg")}
            <select
              id="cfg-alg"
              className="select"
              value={String(c.algorithm ?? "dice")}
              onChange={(e) => onChange({ config: { ...c, algorithm: e.target.value } })}
            >
              <option value="exact">Exact phrase</option>
              <option value="dice">Fuzzy — word order tolerant</option>
              <option value="levenshtein">Fuzzy — typo tolerant</option>
            </select>
            {fieldLabel(`Match threshold — ${Number(c.threshold ?? 80)}%`, "cfg-threshold")}
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
          </>
        )}
        {node.type === "send_text" && (
          <>
            {fieldLabel("Message text", "cfg-text")}
            <textarea
              id="cfg-text"
              className="textarea"
              rows={4}
              placeholder="What should we reply with?"
              value={String(c.text ?? "")}
              onChange={(e) => onChange({ config: { ...c, text: e.target.value } })}
            />
          </>
        )}
        {node.type === "send_media" && (
          <MediaConfigSection
            mediaId={c.mediaId as number | undefined}
            caption={String(c.text ?? "")}
            onChangeMedia={(mediaId) => onChange({ config: { ...c, mediaId } })}
            onChangeCaption={(text) => onChange({ config: { ...c, text } })}
          />
        )}
        {node.type === "delay" && (
          <>
            {fieldLabel("Wait mode", "cfg-mode")}
            <select
              id="cfg-mode"
              className="select"
              value={String(c.mode ?? "fixed")}
              onChange={(e) => onChange({ config: { ...c, mode: e.target.value } })}
            >
              <option value="fixed">Fixed duration</option>
              <option value="random">Random range</option>
            </select>
            {c.mode === "random" ? (
              <>
                {fieldLabel("Minimum seconds", "cfg-min")}
                <input
                  id="cfg-min"
                  className="input"
                  type="number"
                  min={0}
                  value={num(c.minSeconds)}
                  onChange={(e) => onChange({ config: { ...c, minSeconds: Number(e.target.value) } })}
                />
                {fieldLabel("Maximum seconds", "cfg-max")}
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
                {fieldLabel("Seconds to wait", "cfg-sec")}
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
              ? "Every workflow starts here when an incoming message matches."
              : "Reaching this step finishes the workflow."}
          </p>
        )}
      </div>

      <button
        className="btn btn-danger btn-sm"
        style={{ marginTop: "1.25rem" }}
        onClick={() => {
          if (window.confirm(`Remove this ${NODE_LABELS[node.type]} step?`)) onDelete();
        }}
      >
        Remove step
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
        Select media asset
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
        <label className="field-label">Or upload new file</label>
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
          Caption text (optional)
        </label>
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

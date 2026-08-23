import { useEffect, useRef, useState } from "react";
import {
  api,
  type ExperimentDetails,
  type ExperimentStats,
  type ExperimentSummary,
  type WorkflowSummary,
} from "./api.js";
import { Dialog, StatusPill } from "./ui.js";

export function ExperimentsPage({
  selectedId,
  onOpenWorkflow,
  onSelectExperiment,
}: {
  selectedId?: string | null;
  onOpenWorkflow: (id: string) => void;
  onSelectExperiment: (id: string | null) => void;
}) {
  const [experiments, setExperiments] = useState<ExperimentSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<ExperimentSummary | null>(null);
  const [editing, setEditing] = useState<ExperimentSummary | null>(null);

  // Selected experiment details & stats
  const [activeExp, setActiveExp] = useState<ExperimentDetails | null>(null);
  const [activeStats, setActiveStats] = useState<ExperimentStats | null>(null);
  const [allWorkflows, setAllWorkflows] = useState<WorkflowSummary[]>([]);
  const [attaching, setAttaching] = useState(false);
  const [selectedWfToAttach, setSelectedWfToAttach] = useState<string>("");

  async function refresh() {
    setError(null);
    try {
      const list = await api.listExperiments();
      setExperiments(list);
      const wfs = await api.listWorkflows();
      setAllWorkflows(wfs);

      if (selectedId) {
        await loadExperimentDetails(selectedId);
      }
    } catch (e) {
      setError(String(e));
    }
  }

  async function loadExperimentDetails(id: string | number) {
    try {
      const [details, stats] = await Promise.all([
        api.getExperiment(id),
        api.getExperimentStats(id),
      ]);
      setActiveExp(details);
      setActiveStats(stats);
    } catch (e) {
      setError(String(e));
    }
  }

  useEffect(() => {
    void refresh();
  }, [selectedId]);

  async function toggleActive(exp: ExperimentSummary) {
    try {
      await api.updateExperiment(exp.id, {
        name: exp.name,
        description: exp.description,
        active: exp.active === 1 ? false : true,
      });
      await refresh();
    } catch (e) {
      setError(String(e));
    }
  }

  async function attachWorkflowToExperiment(expId: number, workflowId: number) {
    try {
      const wf = await api.getWorkflow(String(workflowId));
      await api.saveWorkflow(String(workflowId), {
        name: wf.name,
        description: wf.description,
        active: wf.active,
        experimentId: expId,
        nodes: wf.nodes,
        edges: wf.edges,
      });
      setAttaching(false);
      setSelectedWfToAttach("");
      await refresh();
    } catch (e) {
      setError(String(e));
    }
  }

  async function detachWorkflow(workflowId: number) {
    try {
      const wf = await api.getWorkflow(String(workflowId));
      await api.saveWorkflow(String(workflowId), {
        name: wf.name,
        description: wf.description,
        active: wf.active,
        experimentId: null,
        nodes: wf.nodes,
        edges: wf.edges,
      });
      await refresh();
    } catch (e) {
      setError(String(e));
    }
  }

  async function createNewVariant(expId: number) {
    const variantLetter = String.fromCharCode(65 + (activeExp?.workflows.length ?? 0));
    const name = `${activeExp?.name || "Experiment"} - Variant ${variantLetter}`;
    const created = await api.createWorkflow(name, expId);
    onOpenWorkflow(String(created.id));
  }

  const unassignedWorkflows = allWorkflows.filter(
    (w) => !activeExp?.workflows.some((ew) => ew.id === w.id),
  );

  return (
    <main className="page">
      <header className="page-header">
        <div>
          <h1>A/B Experiments</h1>
          <p className="page-subtitle">
            Compare reply rates across multiple workflow variants with automatic sticky
            distribution.
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setCreating(true)}>
          New experiment
        </button>
      </header>

      {error && (
        <div className="error-banner" role="alert">
          {error}
          <button className="btn btn-sm" style={{ marginLeft: "auto" }} onClick={refresh}>
            Retry
          </button>
        </div>
      )}

      {experiments === null && !error && (
        <div aria-busy="true" aria-label="Loading experiments">
          <div className="skeleton" style={{ marginBottom: "0.75rem" }} />
          <div className="skeleton" />
        </div>
      )}

      {experiments?.length === 0 && (
        <div className="card empty-state">
          <div className="empty-state-icon" aria-hidden>
            🧪
          </div>
          <h2>No experiments yet</h2>
          <p>
            Create an A/B test to split incoming WhatsApp traffic across different workflow variants
            and measure reply rates.
          </p>
          <button className="btn btn-primary" onClick={() => setCreating(true)}>
            Create your first experiment
          </button>
        </div>
      )}

      {/* Main layout: List on left (or top), Details/Stats on right */}
      {experiments !== null && experiments.length > 0 && (
        <div className="experiments-grid">
          {/* Experiment Cards / List */}
          <div className="experiments-list-col">
            <h2 className="section-title">All Experiments</h2>
            <div className="experiment-cards">
              {experiments.map((exp) => {
                const isSelected = activeExp?.id === exp.id;
                return (
                  <div
                    key={exp.id}
                    className={`card experiment-card ${isSelected ? "experiment-card-active" : ""}`}
                    onClick={() => {
                      onSelectExperiment(String(exp.id));
                      void loadExperimentDetails(exp.id);
                    }}
                  >
                    <div className="exp-card-header">
                      <div style={{ fontWeight: 600, fontSize: "1.0625rem" }}>{exp.name}</div>
                      <StatusPill active={exp.active === 1} />
                    </div>
                    {exp.description && <p className="exp-card-desc">{exp.description}</p>}
                    <div className="exp-card-metrics">
                      <span className="metric-chip">
                        <strong>{exp.variantCount}</strong> variant
                        {exp.variantCount === 1 ? "" : "s"}
                      </span>
                      <span className="metric-chip">
                        <strong>{exp.totalAssigned}</strong> contact
                        {exp.totalAssigned === 1 ? "" : "s"}
                      </span>
                    </div>
                    <div className="exp-card-footer">
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          void toggleActive(exp);
                        }}
                      >
                        {exp.active === 1 ? "Pause" : "Activate"}
                      </button>
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditing(exp);
                        }}
                      >
                        Edit
                      </button>
                      <button
                        className="btn btn-ghost btn-danger btn-sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleting(exp);
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Details & Live Stats Dashboard */}
          <div className="experiments-details-col">
            {!activeExp ? (
              <div className="card empty-state" style={{ padding: "3rem 1.5rem" }}>
                <p>Select an experiment to view variant performance and live statistics.</p>
              </div>
            ) : (
              <div className="card exp-detail-card">
                <div className="exp-detail-header">
                  <div>
                    <span className="exp-detail-tag">EXPERIMENT</span>
                    <h2 style={{ margin: "0.25rem 0" }}>{activeExp.name}</h2>
                    {activeExp.description && (
                      <p style={{ color: "var(--muted)", margin: 0 }}>{activeExp.description}</p>
                    )}
                  </div>
                  <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                    <StatusPill active={activeExp.active === 1} />
                  </div>
                </div>

                {/* Overall KPI Stats */}
                {activeStats && (
                  <div className="stats-kpi-grid">
                    <div className="kpi-box">
                      <div className="kpi-label">Assigned Contacts</div>
                      <div className="kpi-value">{activeStats.totals.assigned}</div>
                    </div>
                    <div className="kpi-box">
                      <div className="kpi-label">Messages Sent</div>
                      <div className="kpi-value">{activeStats.totals.messaged}</div>
                    </div>
                    <div className="kpi-box">
                      <div className="kpi-label">Replies Attributed</div>
                      <div className="kpi-value">{activeStats.totals.replied}</div>
                    </div>
                    <div className="kpi-box kpi-box-highlight">
                      <div className="kpi-label">Overall Reply Rate</div>
                      <div className="kpi-value">{activeStats.totals.replyRate}%</div>
                    </div>
                  </div>
                )}

                {/* Variant Performance Table */}
                <div className="variants-section">
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      marginBottom: "1rem",
                    }}
                  >
                    <h3 style={{ margin: 0, fontSize: "1.125rem" }}>Workflow Variants</h3>
                    <div style={{ display: "flex", gap: "0.5rem" }}>
                      <button
                        className="btn btn-sm"
                        onClick={() => void createNewVariant(activeExp.id)}
                      >
                        + Create Variant
                      </button>
                      <button className="btn btn-sm" onClick={() => setAttaching(true)}>
                        Attach Existing
                      </button>
                    </div>
                  </div>

                  {(!activeStats || activeStats.variants.length === 0) && (
                    <div
                      className="empty-state"
                      style={{ padding: "2rem 1rem", background: "var(--surface-sunken)" }}
                    >
                      <p>No workflow variants attached yet.</p>
                      <button
                        className="btn btn-primary btn-sm"
                        onClick={() => void createNewVariant(activeExp.id)}
                      >
                        Create your first variant
                      </button>
                    </div>
                  )}

                  {activeStats && activeStats.variants.length > 0 && (
                    <div className="table-wrapper">
                      <table className="variant-table">
                        <thead>
                          <tr>
                            <th>Variant</th>
                            <th>Status</th>
                            <th>Assigned</th>
                            <th>Messaged</th>
                            <th>Replied</th>
                            <th>Reply Rate</th>
                            <th></th>
                          </tr>
                        </thead>
                        <tbody>
                          {activeStats.variants.map((v) => {
                            const isBest =
                              activeStats.variants.length > 1 &&
                              v.replyRate > 0 &&
                              v.replyRate ===
                                Math.max(...activeStats.variants.map((x) => x.replyRate));
                            return (
                              <tr key={v.workflowId}>
                                <td>
                                  <button
                                    className="link-button"
                                    onClick={() => onOpenWorkflow(String(v.workflowId))}
                                  >
                                    <strong>{v.name}</strong>
                                  </button>
                                  {isBest && <span className="best-badge">Best</span>}
                                </td>
                                <td>
                                  <StatusPill active={v.active === 1} />
                                </td>
                                <td>{v.assigned}</td>
                                <td>{v.messaged}</td>
                                <td>{v.replied}</td>
                                <td>
                                  <div className="rate-bar-cell">
                                    <div className="rate-bar-bg">
                                      <div
                                        className="rate-bar-fill"
                                        style={{ width: `${Math.min(v.replyRate, 100)}%` }}
                                      />
                                    </div>
                                    <span className="rate-text">{v.replyRate}%</span>
                                  </div>
                                </td>
                                <td>
                                  <button
                                    className="btn btn-ghost btn-danger btn-sm"
                                    title="Detach variant from experiment"
                                    onClick={() => void detachWorkflow(v.workflowId)}
                                  >
                                    Detach
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Create Experiment Dialog */}
      <Dialog open={creating} onClose={() => setCreating(false)} labelledBy="create-exp-title">
        <ExperimentForm
          title="New A/B Experiment"
          submitLabel="Create Experiment"
          onCancel={() => setCreating(false)}
          onSubmit={async (data) => {
            const res = await api.createExperiment(data);
            setCreating(false);
            onSelectExperiment(String(res.id));
            await refresh();
          }}
        />
      </Dialog>

      {/* Edit Experiment Dialog */}
      <Dialog open={editing !== null} onClose={() => setEditing(null)} labelledBy="edit-exp-title">
        {editing && (
          <ExperimentForm
            title="Edit Experiment"
            initialData={{
              name: editing.name,
              description: editing.description ?? "",
              active: editing.active === 1,
            }}
            submitLabel="Save Changes"
            onCancel={() => setEditing(null)}
            onSubmit={async (data) => {
              await api.updateExperiment(editing.id, data);
              setEditing(null);
              await refresh();
            }}
          />
        )}
      </Dialog>

      {/* Attach Workflow Dialog */}
      <Dialog open={attaching} onClose={() => setAttaching(false)} labelledBy="attach-wf-title">
        <form
          className="modal-body"
          onSubmit={(e) => {
            e.preventDefault();
            if (!activeExp || !selectedWfToAttach) return;
            void attachWorkflowToExperiment(activeExp.id, Number(selectedWfToAttach));
          }}
        >
          <p className="modal-title" id="attach-wf-title">
            Attach Workflow to “{activeExp?.name}”
          </p>
          <p className="page-subtitle" style={{ margin: "0.25rem 0 1.25rem" }}>
            Select an existing workflow to include as a variant in this experiment.
          </p>
          {unassignedWorkflows.length === 0 ? (
            <p style={{ color: "var(--muted)" }}>No unassigned workflows available.</p>
          ) : (
            <>
              <label className="field-label" htmlFor="select-workflow">
                Workflow
              </label>
              <select
                id="select-workflow"
                className="input"
                value={selectedWfToAttach}
                onChange={(e) => setSelectedWfToAttach(e.target.value)}
                required
              >
                <option value="">-- Choose workflow --</option>
                {unassignedWorkflows.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name} {w.active === 1 ? "(Live)" : "(Draft)"}
                  </option>
                ))}
              </select>
            </>
          )}
          <div className="modal-actions">
            <button type="button" className="btn" onClick={() => setAttaching(false)}>
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={!selectedWfToAttach || unassignedWorkflows.length === 0}
            >
              Attach Variant
            </button>
          </div>
        </form>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        labelledBy="delete-exp-title"
      >
        {deleting && (
          <form
            className="modal-body"
            onSubmit={async (e) => {
              e.preventDefault();
              await api.deleteExperiment(deleting.id);
              if (activeExp?.id === deleting.id) {
                setActiveExp(null);
                setActiveStats(null);
                onSelectExperiment(null);
              }
              setDeleting(null);
              await refresh();
            }}
          >
            <p className="modal-title" id="delete-exp-title">
              Delete experiment “{deleting.name}”?
            </p>
            <p className="page-subtitle" style={{ margin: "0.25rem 0 1.25rem" }}>
              Workflows linked to this experiment will remain intact as standalone workflows.
            </p>
            <div className="modal-actions">
              <button type="button" className="btn" onClick={() => setDeleting(null)}>
                Cancel
              </button>
              <button type="submit" className="btn btn-danger-solid">
                Delete Experiment
              </button>
            </div>
          </form>
        )}
      </Dialog>
    </main>
  );
}

function ExperimentForm({
  title,
  initialData,
  submitLabel,
  onCancel,
  onSubmit,
}: {
  title: string;
  initialData?: { name: string; description: string; active: boolean };
  submitLabel: string;
  onCancel: () => void;
  onSubmit: (data: { name: string; description?: string; active?: boolean }) => Promise<void>;
}) {
  const [name, setName] = useState(initialData?.name ?? "");
  const [description, setDescription] = useState(initialData?.description ?? "");
  const [active, setActive] = useState(initialData?.active ?? true);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 0);
  }, []);

  async function handleFormSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed || busy) return;
    setBusy(true);
    try {
      await onSubmit({ name: trimmed, description: description.trim() || undefined, active });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="modal-body" onSubmit={handleFormSubmit}>
      <p className="modal-title">{title}</p>
      <label className="field-label" htmlFor="exp-form-name">
        Experiment name
      </label>
      <input
        ref={inputRef}
        id="exp-form-name"
        className="input"
        placeholder='e.g. "Price Offer: Discount vs Value Add"'
        value={name}
        onChange={(e) => setName(e.target.value)}
        required
      />
      <label className="field-label" htmlFor="exp-form-desc" style={{ marginTop: "1rem" }}>
        Description (optional)
      </label>
      <textarea
        id="exp-form-desc"
        className="input"
        rows={3}
        placeholder="Hypothesis or details about the variants being tested"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
      />
      <div style={{ marginTop: "1rem" }}>
        <label className="switch">
          <input
            type="checkbox"
            checked={active}
            onChange={(e) => setActive(e.target.checked)}
            aria-label="Active status"
          />
          <span className="switch-track" aria-hidden />
          <span className="switch-label">{active ? "Active" : "Paused"}</span>
        </label>
      </div>
      <div className="modal-actions">
        <button type="button" className="btn" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="btn btn-primary" disabled={!name.trim() || busy}>
          {busy ? "Saving…" : submitLabel}
        </button>
      </div>
    </form>
  );
}

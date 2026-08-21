import { useEffect, useState } from "react";
import { api, type WorkflowSummary } from "./api.js";

export function WorkflowList({ onOpen }: { onOpen: (id: string) => void }) {
  const [workflows, setWorkflows] = useState<WorkflowSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .listWorkflows()
      .then(setWorkflows)
      .catch((e) => setError(String(e)));
  }, []);

  async function create() {
    const name = window.prompt("Workflow name");
    if (!name?.trim()) return;
    const created = await api.createWorkflow(name.trim());
    onOpen(String(created.id));
  }

  return (
    <main style={{ maxWidth: 640, margin: "2rem auto", fontFamily: "system-ui" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1>Workflows</h1>
        <button onClick={create}>New workflow</button>
      </div>
      {error && <p style={{ color: "crimson" }}>{error}</p>}
      {!workflows ? (
        <p>Loading…</p>
      ) : workflows.length === 0 ? (
        <p>No workflows yet.</p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0 }}>
          {workflows.map((w) => (
            <li key={w.id} style={{ padding: "0.75rem 0", borderBottom: "1px solid #ddd" }}>
              <a
                href={`#/workflows/${w.id}`}
                onClick={(e) => {
                  e.preventDefault();
                  onOpen(String(w.id));
                }}
                style={{ fontWeight: 600 }}
              >
                {w.name}
              </a>{" "}
              {w.active ? (
                <span style={{ color: "green", fontSize: "0.85em" }}>active</span>
              ) : (
                <span style={{ color: "#999", fontSize: "0.85em" }}>draft</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

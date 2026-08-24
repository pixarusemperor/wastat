import { useEffect, useState } from "react";
import { api, type BroadcastSummary, type Product } from "./api.js";
import { Dialog } from "./ui.js";

function StatusPill({ status }: { status: string }) {
  return (
    <span className={`pill ${status === "pending" ? "pill-draft" : "pill-active"}`}>
      <span className="pill-dot" aria-hidden />
      {status}
    </span>
  );
}

export function BroadcastsPage() {
  const [broadcasts, setBroadcasts] = useState<BroadcastSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [scheduling, setScheduling] = useState(false);

  async function refresh() {
    setError(null);
    try {
      setBroadcasts(await api.listBroadcasts());
    } catch (e) {
      setError(String(e));
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  return (
    <main className="page">
      <header className="page-header">
        <div>
          <h1>Broadcasts</h1>
          <p className="page-subtitle">Cartesian product × group dispatches to WhatsApp groups.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setScheduling(true)}>
          Schedule broadcast
        </button>
      </header>

      {error && (
        <div className="error-banner" role="alert">
          Couldn't load broadcasts.
          <button className="btn btn-sm" style={{ marginLeft: "auto" }} onClick={refresh}>
            Retry
          </button>
        </div>
      )}

      {broadcasts === null && !error && (
        <div aria-busy="true" aria-label="Loading broadcasts">
          <div className="skeleton" style={{ marginBottom: "0.75rem" }} />
          <div className="skeleton" />
        </div>
      )}

      {broadcasts?.length === 0 && (
        <div className="card empty-state">
          <div className="empty-state-icon" aria-hidden>
            📣
          </div>
          <h2>No broadcasts scheduled</h2>
          <p>Pick products and target groups — every combination becomes a scheduled dispatch.</p>
          <button className="btn btn-primary" onClick={() => setScheduling(true)}>
            Schedule your first broadcast
          </button>
        </div>
      )}

      {broadcasts !== null && broadcasts.length > 0 && (
        <ul role="list" className="card" style={{ listStyle: "none", margin: 0, padding: 0 }}>
          {broadcasts.map((b) => (
            <li key={b.id} className="wf-row">
              <div
                className="wf-row-link"
                style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}
              >
                <span>Product #{b.productId} → Group {b.groupId}</span>
                <span className="page-subtitle">
                  Scheduled for {new Date(b.scheduledAt).toLocaleString()}
                </span>
              </div>
              <StatusPill status={b.status} />
            </li>
          ))}
        </ul>
      )}

      {/* Schedule broadcast */}
      <Dialog open={scheduling} onClose={() => setScheduling(false)} labelledBy="schedule-bc-title">
        <ScheduleBroadcastForm
          onCancel={() => setScheduling(false)}
          onScheduled={() => {
            setScheduling(false);
            void refresh();
          }}
        />
      </Dialog>
    </main>
  );
}

function ScheduleBroadcastForm({
  onCancel,
  onScheduled,
}: {
  onCancel: () => void;
  onScheduled: () => void;
}) {
  const [products, setProducts] = useState<Product[] | null>(null);
  const [selectedProducts, setSelectedProducts] = useState<Set<number>>(new Set());
  const [groupsRaw, setGroupsRaw] = useState("");
  const [template, setTemplate] = useState("");
  const [busy, setBusy] = useState(false);
  const [validation, setValidation] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void api
      .listProducts()
      .then(setProducts)
      .catch((e) => setError(String(e)));
  }, []);

  function toggleProduct(id: number) {
    setSelectedProducts((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const groupIds = groupsRaw
      .split(/[,\n]/)
      .map((g) => g.trim())
      .filter(Boolean);
    if (selectedProducts.size === 0) {
      setValidation("Select at least one product.");
      return;
    }
    if (groupIds.length === 0) {
      setValidation("Enter at least one target group ID.");
      return;
    }
    setBusy(true);
    setValidation(null);
    try {
      await api.scheduleBroadcast({
        productIds: [...selectedProducts].map(String),
        groupIds,
        template: template.trim() || undefined,
      });
      onScheduled();
    } catch (err) {
      setError(String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="modal-body" onSubmit={submit}>
      <p className="modal-title">Schedule broadcast</p>
      <p className="page-subtitle" style={{ margin: "0.25rem 0 1.25rem" }}>
        Each selected product × each group becomes one scheduled dispatch.
      </p>

      <span className="field-label">Products</span>
      {products === null && !error && (
        <div aria-busy="true">
          <div className="skeleton" />
        </div>
      )}
      {products !== null && products.length === 0 && (
        <p className="page-subtitle" style={{ margin: 0 }}>
          No products in the catalog yet.
        </p>
      )}
      {products !== null && products.length > 0 && (
        <ul role="list" style={{ listStyle: "none", margin: "0.25rem 0 0", padding: 0 }}>
          {products.map((p) => (
            <li key={p.id}>
              <label
                style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer" }}
              >
                <input type="checkbox" checked={selectedProducts.has(p.id)} onChange={() => toggleProduct(p.id)} />
                <span>
                  {p.name} <span className="page-subtitle">({p.sku})</span>
                </span>
              </label>
            </li>
          ))}
        </ul>
      )}

      <label className="field-label" htmlFor="bc-groups" style={{ marginTop: "1rem" }}>
        Target group IDs (comma-separated)
      </label>
      <input
        id="bc-groups"
        className="input"
        placeholder="e.g. 120363…@g.us, 120364…@g.us"
        value={groupsRaw}
        onChange={(e) => setGroupsRaw(e.target.value)}
      />

      <label className="field-label" htmlFor="bc-template" style={{ marginTop: "1rem" }}>
        Message template (optional)
      </label>
      <textarea
        id="bc-template"
        className="input"
        rows={3}
        placeholder="e.g. Check out {{product.name}} — only {${price}|special price today}!"
        value={template}
        onChange={(e) => setTemplate(e.target.value)}
      />
      <p className="page-subtitle" style={{ margin: "0.25rem 0 0" }}>
        Spintax like {"{A|B}"} rotates message variants to keep sends unique.
      </p>

      {validation && (
        <p role="alert" style={{ color: "var(--warning-text)", margin: "0.75rem 0 0" }}>
          {validation}
        </p>
      )}
      {error && !validation && (
        <p role="alert" style={{ color: "var(--warning-text)", margin: "0.75rem 0 0" }}>
          {error}
        </p>
      )}
      <div className="modal-actions">
        <button type="button" className="btn" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="btn btn-primary" disabled={busy || products?.length === 0}>
          {busy ? "Scheduling…" : "Schedule broadcast"}
        </button>
      </div>
    </form>
  );
}

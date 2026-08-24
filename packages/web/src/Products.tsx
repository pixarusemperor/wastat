import { useEffect, useRef, useState } from "react";
import { api, type Product } from "./api.js";
import { Dialog } from "./ui.js";

export function ProductsPage() {
  const [products, setProducts] = useState<Product[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  async function refresh() {
    setError(null);
    try {
      setProducts(await api.listProducts());
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
          <h1>Products</h1>
          <p className="page-subtitle">Catalog items that broadcasts send to WhatsApp groups.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setCreating(true)}>
          New product
        </button>
      </header>

      {error && (
        <div className="error-banner" role="alert">
          Couldn't load products.
          <button className="btn btn-sm" style={{ marginLeft: "auto" }} onClick={refresh}>
            Retry
          </button>
        </div>
      )}

      {products === null && !error && (
        <div aria-busy="true" aria-label="Loading products">
          <div className="skeleton" style={{ marginBottom: "0.75rem" }} />
          <div className="skeleton" />
        </div>
      )}

      {products?.length === 0 && (
        <div className="card empty-state">
          <div className="empty-state-icon" aria-hidden>
            🏷️
          </div>
          <h2>No products yet</h2>
          <p>Add a product with its SKU and price, then broadcast it to your groups.</p>
          <button className="btn btn-primary" onClick={() => setCreating(true)}>
            Create your first product
          </button>
        </div>
      )}

      {products !== null && products.length > 0 && (
        <ul role="list" className="card" style={{ listStyle: "none", margin: 0, padding: 0 }}>
          {products.map((p) => (
            <li key={p.id} className="wf-row">
              <div className="wf-row-link" style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <span>{p.name}</span>
                  <span
                    className="pill pill-draft"
                    style={{ fontSize: "0.6875rem", padding: "0.125rem 0.5rem" }}
                  >
                    {p.sku}
                  </span>
                </div>
                {p.description && <span className="page-subtitle">{p.description}</span>}
              </div>
              <span style={{ fontWeight: 600 }}>
                {p.price !== null ? `$${p.price.toFixed(2)}` : "—"}
              </span>
            </li>
          ))}
        </ul>
      )}

      {/* Create product */}
      <Dialog open={creating} onClose={() => setCreating(false)} labelledBy="create-product-title">
        <CreateProductForm
          onCancel={() => setCreating(false)}
          onCreated={() => {
            setCreating(false);
            void refresh();
          }}
        />
      </Dialog>
    </main>
  );
}

function CreateProductForm({
  onCancel,
  onCreated,
}: {
  onCancel: () => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState("");
  const [sku, setSku] = useState("");
  const [price, setPrice] = useState("");
  const [description, setDescription] = useState("");
  const [mediaUrl, setMediaUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 0);
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await api.createProduct({
        name: name.trim(),
        sku: sku.trim(),
        price: price.trim() ? Number(price) : null,
        description: description.trim() || null,
        mediaUrl: mediaUrl.trim() || null,
      });
      onCreated();
    } catch (err) {
      setError(String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="modal-body" onSubmit={submit}>
      <p className="modal-title">New product</p>
      <label className="field-label" htmlFor="product-name">
        Name
      </label>
      <input
        ref={inputRef}
        id="product-name"
        className="input"
        placeholder="e.g. Buzz Starter Kit"
        value={name}
        onChange={(e) => setName(e.target.value)}
        required
      />
      <label className="field-label" htmlFor="product-sku" style={{ marginTop: "1rem" }}>
        SKU
      </label>
      <input
        id="product-sku"
        className="input"
        placeholder="e.g. BZ-001"
        value={sku}
        onChange={(e) => setSku(e.target.value)}
        required
      />
      <label className="field-label" htmlFor="product-price" style={{ marginTop: "1rem" }}>
        Price (USD)
      </label>
      <input
        id="product-price"
        className="input"
        type="number"
        step="0.01"
        min="0"
        placeholder="e.g. 49.00"
        value={price}
        onChange={(e) => setPrice(e.target.value)}
      />
      <label className="field-label" htmlFor="product-description" style={{ marginTop: "1rem" }}>
        Description (optional)
      </label>
      <textarea
        id="product-description"
        className="input"
        rows={2}
        value={description}
        onChange={(e) => setDescription(e.target.value)}
      />
      <label className="field-label" htmlFor="product-media" style={{ marginTop: "1rem" }}>
        Media URL (optional)
      </label>
      <input
        id="product-media"
        className="input"
        type="url"
        placeholder="https://…"
        value={mediaUrl}
        onChange={(e) => setMediaUrl(e.target.value)}
      />
      {error && (
        <p role="alert" style={{ color: "var(--warning-text)", margin: "0.75rem 0 0" }}>
          {error}
        </p>
      )}
      <div className="modal-actions">
        <button type="button" className="btn" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="btn btn-primary" disabled={!name.trim() || !sku.trim() || busy}>
          {busy ? "Creating…" : "Create product"}
        </button>
      </div>
    </form>
  );
}

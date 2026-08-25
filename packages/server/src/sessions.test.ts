import Database from "better-sqlite3";
import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { buildApp } from "./app.js";
import { FakeClock } from "./scheduler.js";
import type { DbClient } from "./db/client.js";

/** DbClient whose `sql` is a fake postgres client. When present, ported routes
 * must read/write through it instead of the sqlite fallback. */
function pgMockDbClient(db: Database.Database, unsafeImpl: (text: string, params: unknown[]) => unknown[]) {
  const calls: string[] = [];
  const dbClient = {
    provider: "supabase_postgres",
    sql: {
      unsafe: async (text: string, params: unknown[] = []) => {
        calls.push(text);
        return unsafeImpl(text, params);
      },
    },
    sqlite: db,
    exec: async () => {},
    close: async () => db.close(),
  } as unknown as DbClient;
  return { dbClient, calls };
}

const schema = readFileSync(new URL("./db/schema.sql", import.meta.url), "utf8");

const REMOTE_SESSIONS = [
  {
    id: 112691,
    name: "Patrick Simo",
    phone_number: "+237676637853",
    status: "connected",
    api_key: "key-a",
    webhook_secret: "sec-a",
  },
];

function jsonResponse(body: unknown, status = 200) {
  return { ok: status < 400, status, json: async () => body } as Response;
}

async function setup() {
  const db = new Database(":memory:");
  db.pragma("foreign_keys = ON");
  db.exec(schema);
  const calls: Array<{ method: string; url: string }> = [];
  const fetchMock = vi.fn(async (url: any, init?: any) => {
    const method = init?.method ?? "GET";
    calls.push({ method, url: String(url) });
    if (url.endsWith("/api/whatsapp-sessions") && method === "GET") {
      return jsonResponse({ success: true, data: REMOTE_SESSIONS });
    }
    if (url.endsWith("/api/whatsapp-sessions") && method === "POST") {
      return jsonResponse({
        success: true,
        data: { id: 112692, name: JSON.parse(init.body).name, status: "disconnected", api_key: "key-b", webhook_secret: "sec-b" },
      }, 201);
    }
    if (url.endsWith("/connect") && method === "POST") {
      return jsonResponse({ success: true });
    }
    if (url.endsWith("/qrcode") && method === "GET") {
      return jsonResponse({ success: true, data: { qrCode: "2@fake-qr-code-data" } });
    }
    if (url.endsWith("/status") && method === "GET") {
      return jsonResponse({ success: true, data: { status: "CONNECTED" } });
    }
    if (url.endsWith("/restart") && method === "POST") {
      return jsonResponse({ success: true });
    }
    if (url.endsWith("/disconnect") && method === "POST") {
      return jsonResponse({ success: true });
    }
    if (/\/api\/whatsapp-sessions\/\d+$/.test(url) && method === "DELETE") {
      return jsonResponse({ success: true });
    }
    throw new Error(`unexpected ${method} ${url}`);
  });
  const app = await buildApp(db, {
    clock: new FakeClock(),
    sendMessage: async () => ({ providerMessageId: "p" }),
    wasenderPat: "pat-test",
    fetchImpl: fetchMock as typeof fetch,
  });
  return { db, app, calls };
}

describe("sessions management API", () => {
  it("lists Wasender sessions and mirrors them into the local DB", async () => {
    const { db, app } = await setup();

    const res = await app.inject({ method: "GET", url: "/api/sessions" });
    expect(res.statusCode).toBe(200);
    expect(res.json()[0]).toMatchObject({
      providerSessionId: "112691",
      name: "Patrick Simo",
      status: "connected",
    });
    const row = db
      .prepare("SELECT provider_session_id, api_key_encrypted, webhook_secret FROM sessions")
      .get() as any;
    expect(row.provider_session_id).toBe("112691");
    expect(row.api_key_encrypted.toString()).toBe("key-a");
    expect(row.webhook_secret).toBe("sec-a");
  });

  it("creates a session via Wasender and stores its credentials", async () => {
    const { db, app, calls } = await setup();

    const res = await app.inject({
      method: "POST",
      url: "/api/sessions",
      payload: { name: "Number Two" },
    });
    expect(res.statusCode).toBe(201);
    expect(calls.some((c) => c.method === "POST" && c.url.includes("/api/whatsapp-sessions"))).toBe(true);
    expect(db.prepare("SELECT COUNT(*) AS n FROM sessions").get()).toEqual({ n: 1 });
    const row = db.prepare("SELECT name, provider_session_id FROM sessions").get() as any;
    expect(row).toEqual({ name: "Number Two", provider_session_id: "112692" });
  });

  it("connects, retrieves QR code, checks status, restarts, and disconnects", async () => {
    const { db, app } = await setup();
    const listed = (await app.inject({ method: "GET", url: "/api/sessions" })).json();
    const id = listed[0].id;

    // Connect
    const connRes = await app.inject({ method: "POST", url: `/api/sessions/${id}/connect` });
    expect(connRes.statusCode).toBe(200);
    expect(connRes.json()).toEqual({ ok: true, status: "connecting" });

    // QR Code
    const qrRes = await app.inject({ method: "GET", url: `/api/sessions/${id}/qrcode` });
    expect(qrRes.statusCode).toBe(200);
    expect(qrRes.json()).toEqual({ qrCode: "2@fake-qr-code-data" });

    // Status
    const statusRes = await app.inject({ method: "GET", url: `/api/sessions/${id}/status` });
    expect(statusRes.statusCode).toBe(200);
    expect(statusRes.json()).toEqual({ status: "connected" });

    // Restart
    const restartRes = await app.inject({ method: "POST", url: `/api/sessions/${id}/restart` });
    expect(restartRes.statusCode).toBe(200);

    // Disconnect
    const discRes = await app.inject({ method: "POST", url: `/api/sessions/${id}/disconnect` });
    expect(discRes.statusCode).toBe(200);
    const row = db.prepare("SELECT status FROM sessions WHERE id = ?").get(id) as any;
    expect(row.status).toBe("disconnected");
  });

  it("deletes a session both remotely and locally", async () => {
    const { db, app, calls } = await setup();
    const listed = (await app.inject({ method: "GET", url: "/api/sessions" })).json();

    const res = await app.inject({ method: "DELETE", url: `/api/sessions/${listed[0].id}` });
    expect(res.statusCode).toBe(200);
    expect(calls.filter((c) => c.method === "DELETE").length).toBe(1);
    expect(db.prepare("SELECT COUNT(*) AS n FROM sessions").get()).toEqual({ n: 0 });
  });

  it("404s when deleting an unknown local session without calling Wasender", async () => {
    const { app, calls } = await setup();

    const res = await app.inject({ method: "DELETE", url: "/api/sessions/999" });
    expect(res.statusCode).toBe(404);
    expect(calls.filter((c) => c.method === "DELETE").length).toBe(0);
  });
});

describe("sessions via the DbClient seam (provider-aware port)", () => {
  it("GET /api/sessions reads from the active provider (pg mock), not the sqlite fallback", async () => {
    const db = new Database(":memory:");
    db.pragma("foreign_keys = ON");
    db.exec(schema);
    const { dbClient, calls } = pgMockDbClient(db, (text) =>
      /FROM sessions/.test(text)
        ? [{ id: 7, name: "Provider Session", providerSessionId: "remote-7", status: "connected" }]
        : [],
    );
    const app = await buildApp(dbClient, {
      clock: new FakeClock(),
      sendMessage: async () => ({ providerMessageId: "mock" }),
    });
    const res = await app.inject({ method: "GET", url: "/api/sessions" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual([
      { id: 7, name: "Provider Session", providerSessionId: "remote-7", status: "connected" },
    ]);
    expect(calls.some((t) => /FROM sessions/.test(t))).toBe(true);
  });

  it("syncSessions upserts remote Wasender sessions into the active provider", async () => {
    const db = new Database(":memory:");
    db.pragma("foreign_keys = ON");
    db.exec(schema);
    const writes: Array<{ text: string; params: unknown[] }> = [];
    const { dbClient } = pgMockDbClient(db, (text, params) => {
      if (/INSERT INTO sessions/.test(text)) {
        writes.push({ text, params });
        return [];
      }
      return [];
    });
    const app = await buildApp(dbClient, {
      clock: new FakeClock(),
      sendMessage: async () => ({ providerMessageId: "mock" }),
      wasenderPat: "test-pat",
      fetchImpl: (async () =>
        jsonResponse({ success: true, data: REMOTE_SESSIONS })) as typeof fetch,
    });
    const res = await app.inject({ method: "GET", url: "/api/sessions" });
    expect(res.statusCode).toBe(200);
    const insert = writes.find((w) => /INSERT INTO sessions/.test(w.text));
    expect(insert).toBeDefined();
    expect(insert!.params).toContain("Patrick Simo");
    expect(insert!.params).toContain("112691");
  });

  it("session :id routes read the row and write status through the active provider", async () => {
    const db = new Database(":memory:");
    db.pragma("foreign_keys = ON");
    db.exec(schema);
    const writes: Array<{ text: string; params: unknown[] }> = [];
    const { dbClient } = pgMockDbClient(db, (text, params) => {
      if (/FROM sessions WHERE id =/.test(text)) {
        return [{ id: 1, provider_session_id: "112691", status: "disconnected" }];
      }
      if (/UPDATE sessions SET status/.test(text)) {
        writes.push({ text, params });
        return [];
      }
      return [];
    });
    const app = await buildApp(dbClient, {
      clock: new FakeClock(),
      sendMessage: async () => ({ providerMessageId: "mock" }),
      wasenderPat: "test-pat",
      fetchImpl: (async () =>
        jsonResponse({ success: true, data: { status: "CONNECTED" } })) as typeof fetch,
    });
    const res = await app.inject({ method: "GET", url: "/api/sessions/1/status" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: "connected" });
    const update = writes.find((w) => /UPDATE sessions SET status/.test(w.text));
    expect(update).toBeDefined();
    expect(update!.params).toEqual(["connected", 1]);
  });
});

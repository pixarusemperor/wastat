import Database from "better-sqlite3";
import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { buildApp } from "./app.js";
import { FakeClock } from "./scheduler.js";

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

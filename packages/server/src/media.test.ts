import Database from "better-sqlite3";
import { readFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { buildApp } from "./app.js";
import { FakeClock } from "./scheduler.js";
import { createLocalStorage } from "./media.js";
import { makeWasenderTransport } from "./wasender.js";
import { createDatabaseClient } from "./db/client.js";

const schema = readFileSync(new URL("./db/schema.sql", import.meta.url), "utf8");

describe("Media Storage & Wasender Transport Pipeline", () => {
  it("uploads a file, stores asset metadata, and serves it publicly", async () => {
    const db = new Database(":memory:");
    db.pragma("foreign_keys = ON");
    db.exec(schema);

    const tempDir = mkdtempSync(join(tmpdir(), "wastat-media-test-"));
    const storage = createLocalStorage(tempDir, "http://localhost:4000");

    const app = await buildApp(db, {
      clock: new FakeClock(),
      sendMessage: async () => ({ providerMessageId: "mock" }),
      storage,
    });

    // Upload an image
    const boundary = "----WebKitFormBoundary7MA4YWxkTrZu0gW";
    const fileContent = "fake-png-binary-content";
    const payload = [
      `--${boundary}`,
      'Content-Disposition: form-data; name="file"; filename="hero.png"',
      "Content-Type: image/png",
      "",
      fileContent,
      `--${boundary}--`,
    ].join("\r\n");

    const res = await app.inject({
      method: "POST",
      url: "/api/media/upload",
      headers: {
        "content-type": `multipart/form-data; boundary=${boundary}`,
      },
      payload,
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body).toMatchObject({
      filename: "hero.png",
      mimeType: "image/png",
    });
    expect(body.publicUrl).toContain("/api/media/files/");

    // Check DB row
    const row = db.prepare("SELECT * FROM media_assets WHERE id = ?").get(body.id) as any;
    expect(row.filename).toBe("hero.png");
    expect(row.mime_type).toBe("image/png");

    // Fetch the served file
    const fileRes = await app.inject({
      method: "GET",
      url: `/api/media/files/${row.r2_key}`,
    });
    expect(fileRes.statusCode).toBe(200);
    expect(fileRes.headers["content-type"]).toBe("image/png");
    expect(fileRes.body).toBe(fileContent);

    // Listing media assets
    const listRes = await app.inject({ method: "GET", url: "/api/media" });
    expect(listRes.statusCode).toBe(200);
    expect(listRes.json().length).toBe(1);
    expect(listRes.json()[0].id).toBe(body.id);

    // Delete media asset
    const delRes = await app.inject({ method: "DELETE", url: `/api/media/${body.id}` });
    expect(delRes.statusCode).toBe(200);
    expect(db.prepare("SELECT COUNT(*) AS count FROM media_assets").get()).toEqual({ count: 0 });

    rmSync(tempDir, { recursive: true, force: true });
  });

  it("media routes work through the DbClient seam (provider-aware helpers on sqlite)", async () => {
    // Force sqlite mode: this shell exports Supabase env vars that would flip the client.
    const savedEnv: Record<string, string | undefined> = {};
    for (const k of ["DATABASE_URL", "SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_ANON_KEY"]) {
      savedEnv[k] = process.env[k];
      delete process.env[k];
    }
    const dbClient = await createDatabaseClient({ sqlitePath: ":memory:" });
    const tempDir = mkdtempSync(join(tmpdir(), "wastat-media-dbclient-"));
    const storage = createLocalStorage(tempDir, "http://localhost:4000");
    const app = await buildApp(dbClient, {
      clock: new FakeClock(),
      sendMessage: async () => ({ providerMessageId: "mock" }),
      storage,
    });

    const boundary = "----WebKitFormBoundary7MA4YWxkTrZu0gW";
    const payload = [
      `--${boundary}`,
      'Content-Disposition: form-data; name="file"; filename="hero.png"',
      "Content-Type: image/png",
      "",
      "fake-png-binary-content",
      `--${boundary}--`,
    ].join("\r\n");

    const res = await app.inject({
      method: "POST",
      url: "/api/media/upload",
      headers: { "content-type": `multipart/form-data; boundary=${boundary}` },
      payload,
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.publicUrl).toContain("/api/media/files/");

    const row = dbClient.sqlite!.prepare("SELECT filename FROM media_assets WHERE id = ?").get(body.id) as any;
    expect(row.filename).toBe("hero.png");

    const list = await app.inject({ method: "GET", url: "/api/media" });
    expect(list.statusCode).toBe(200);
    expect(list.json().length).toBe(1);
    expect(list.json()[0].mimeType).toBe("image/png");

    const del = await app.inject({ method: "DELETE", url: `/api/media/${body.id}` });
    expect(del.statusCode).toBe(200);
    expect(dbClient.sqlite!.prepare("SELECT COUNT(*) AS n FROM media_assets").get()).toEqual({ n: 0 });

    await dbClient.close();
    for (const [k, v] of Object.entries(savedEnv)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("formats Wasender media payloads with imageUrl, audioUrl, videoUrl, and documentUrl", async () => {
    const db = new Database(":memory:");
    db.pragma("foreign_keys = ON");
    db.exec(schema);

    const tempDir = mkdtempSync(join(tmpdir(), "wastat-media-test2-"));
    const storage = createLocalStorage(tempDir, "http://localhost:4000");

    // Insert media assets
    db.prepare(`
      INSERT INTO media_assets (id, filename, mime_type, size, r2_key, hash)
      VALUES (1, 'photo.jpg', 'image/jpeg', 1000, 'photo.jpg', 'hash1'),
             (2, 'voice.ogg', 'audio/ogg', 2000, 'voice.ogg', 'hash2'),
             (3, 'clip.mp4', 'video/mp4', 5000, 'clip.mp4', 'hash3'),
             (4, 'catalog.pdf', 'application/pdf', 8000, 'catalog.pdf', 'hash4')
    `).run();

    const sentPayloads: any[] = [];
    const fetchMock = vi.fn(async (_url: any, init?: any) => {
      sentPayloads.push(JSON.parse(init.body));
      return {
        ok: true,
        status: 200,
        json: async () => ({ data: { key: { id: "msg-123" } } }),
      } as Response;
    });

    const transport = makeWasenderTransport(db, storage, fetchMock as typeof fetch);

    // Send Image
    await transport({
      apiKey: "test-key",
      sessionId: 1,
      toPhone: "+1234567890",
      kind: "media",
      mediaId: 1,
      text: "Look at this photo!",
    });
    expect(sentPayloads[0]).toEqual({
      to: "+1234567890",
      text: "Look at this photo!",
      imageUrl: "http://localhost:4000/api/media/files/photo.jpg",
    });

    // Send Audio
    await transport({
      apiKey: "test-key",
      sessionId: 1,
      toPhone: "+1234567890",
      kind: "media",
      mediaId: 2,
    });
    expect(sentPayloads[1]).toEqual({
      to: "+1234567890",
      audioUrl: "http://localhost:4000/api/media/files/voice.ogg",
    });

    // Send Video
    await transport({
      apiKey: "test-key",
      sessionId: 1,
      toPhone: "+1234567890",
      kind: "media",
      mediaId: 3,
      text: "Watch this clip",
    });
    expect(sentPayloads[2]).toEqual({
      to: "+1234567890",
      text: "Watch this clip",
      videoUrl: "http://localhost:4000/api/media/files/clip.mp4",
    });

    // Send Document
    await transport({
      apiKey: "test-key",
      sessionId: 1,
      toPhone: "+1234567890",
      kind: "media",
      mediaId: 4,
    });
    expect(sentPayloads[3]).toEqual({
      to: "+1234567890",
      documentUrl: "http://localhost:4000/api/media/files/catalog.pdf",
      fileName: "catalog.pdf",
    });

    // Test explicit mediaType taking precedence even without extension/mime
    await transport({
      apiKey: "test-key",
      sessionId: 1,
      toPhone: "+1234567890",
      kind: "media",
      mediaType: "image",
      mediaUrl: "https://example.com/render-image?id=99",
      text: "Explicit image",
    });
    expect(sentPayloads[4]).toEqual({
      to: "+1234567890",
      text: "Explicit image",
      imageUrl: "https://example.com/render-image?id=99",
    });

    await transport({
      apiKey: "test-key",
      sessionId: 1,
      toPhone: "+1234567890",
      kind: "media",
      mediaType: "video",
      mediaUrl: "https://example.com/render-video?id=100",
      text: "Explicit video",
    });
    expect(sentPayloads[5]).toEqual({
      to: "+1234567890",
      text: "Explicit video",
      videoUrl: "https://example.com/render-video?id=100",
    });

    await transport({
      apiKey: "test-key",
      sessionId: 1,
      toPhone: "+1234567890",
      kind: "media",
      mediaType: "audio",
      mediaUrl: "https://example.com/render-audio?id=101",
    });
    expect(sentPayloads[6]).toEqual({
      to: "+1234567890",
      audioUrl: "https://example.com/render-audio?id=101",
    });

    // Test query string stripping during extension matching
    await transport({
      apiKey: "test-key",
      sessionId: 1,
      toPhone: "+1234567890",
      kind: "media",
      mediaUrl: "https://r2.domain.com/photo.jpeg?X-Amz-Signature=abcd1234&expires=9999",
      text: "Signed URL photo",
    });
    expect(sentPayloads[7]).toEqual({
      to: "+1234567890",
      text: "Signed URL photo",
      imageUrl: "https://r2.domain.com/photo.jpeg?X-Amz-Signature=abcd1234&expires=9999",
    });

    await transport({
      apiKey: "test-key",
      sessionId: 1,
      toPhone: "+1234567890",
      kind: "media",
      mediaUrl: "https://r2.domain.com/recording.mp3?token=secret#play",
    });
    expect(sentPayloads[8]).toEqual({
      to: "+1234567890",
      audioUrl: "https://r2.domain.com/recording.mp3?token=secret#play",
    });

    rmSync(tempDir, { recursive: true, force: true });
  });
});

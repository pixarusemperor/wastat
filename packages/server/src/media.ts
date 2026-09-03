import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import type { FastifyInstance } from "fastify";
import fastifyMultipart from "@fastify/multipart";
import { queryAll, queryGet, queryRun, type DbClient } from "./db/client.js";

export interface MediaAssetRow {
  id: number;
  filename: string;
  mime_type: string;
  size: number;
  r2_key: string;
  hash: string;
  created_at: string;
}

export interface StorageProvider {
  put(key: string, buffer: Buffer, mimeType: string): Promise<string>;
  get(key: string): Promise<{ data: Buffer; mimeType: string } | null>;
  delete(key: string): Promise<void>;
  getPublicUrl(key: string): string;
}

export function createR2Storage(config: {
  accountId: string;
  bucketName: string;
  accessKeyId: string;
  secretAccessKey: string;
  publicUrl?: string;
}): StorageProvider {
  const s3 = new S3Client({
    region: "auto",
    endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });

  return {
    async put(key: string, buffer: Buffer, mimeType: string) {
      await s3.send(
        new PutObjectCommand({
          Bucket: config.bucketName,
          Key: key,
          Body: buffer,
          ContentType: mimeType,
        }),
      );
      return this.getPublicUrl(key);
    },
    async get(key: string) {
      try {
        const res = await s3.send(new GetObjectCommand({ Bucket: config.bucketName, Key: key }));
        const byteArray = await res.Body?.transformToByteArray();
        if (!byteArray) return null;
        return { data: Buffer.from(byteArray), mimeType: res.ContentType ?? "application/octet-stream" };
      } catch {
        return null;
      }
    },
    async delete(key: string) {
      await s3.send(new DeleteObjectCommand({ Bucket: config.bucketName, Key: key }));
    },
    getPublicUrl(key: string) {
      if (config.publicUrl && config.publicUrl.trim()) {
        let pub = config.publicUrl.trim().replace(/\/$/, "");
        if (!pub.startsWith("http://") && !pub.startsWith("https://")) {
          pub = `https://${pub}`;
        }
        return `${pub}/${key}`;
      }
      return `https://${config.bucketName}.${config.accountId}.r2.cloudflarestorage.com/${key}`;
    },
  };
}

export function createLocalStorage(baseDir: string, publicBaseUrl?: string): StorageProvider {
  mkdirSync(baseDir, { recursive: true });

  return {
    async put(key: string, buffer: Buffer) {
      const filePath = join(baseDir, key);
      writeFileSync(filePath, buffer);
      return this.getPublicUrl(key);
    },
    async get(key: string) {
      const filePath = join(baseDir, key);
      if (!existsSync(filePath)) return null;
      const data = readFileSync(filePath);
      return { data, mimeType: "application/octet-stream" };
    },
    async delete(key: string) {
      const filePath = join(baseDir, key);
      if (existsSync(filePath)) unlinkSync(filePath);
    },
    getPublicUrl(key: string) {
      const base = publicBaseUrl ?? process.env.PUBLIC_BASE_URL ?? "";
      return `${base.replace(/\/$/, "")}/api/media/files/${key}`;
    },
  };
}

export function createStorageFromEnv(): StorageProvider {
  const accountId = process.env.R2_ACCOUNT_ID;
  const bucketName = process.env.R2_BUCKET_NAME;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const publicUrl = process.env.R2_PUBLIC_URL;

  if (accountId && bucketName && accessKeyId && secretAccessKey) {
    return createR2Storage({
      accountId,
      bucketName,
      accessKeyId,
      secretAccessKey,
      publicUrl,
    });
  }

  const localDir = process.env.MEDIA_DIR ?? join(process.cwd(), "data", "media");
  return createLocalStorage(localDir);
}

export async function registerMediaRoutes(
  app: FastifyInstance,
  db: DbClient,
  storage: StorageProvider = createStorageFromEnv(),
) {
  await app.register(fastifyMultipart, {
    limits: {
      fileSize: 16 * 1024 * 1024, // 16 MB max for WhatsApp media
    },
  });

  // Local static file serving for local storage provider
  app.get<{ Params: { key: string } }>("/api/media/files/:key", async (request, reply) => {
    const item = await storage.get(request.params.key);
    if (!item) return reply.code(404).send({ error: "Media not found" });

    // Look up mime_type in database
    const row = await queryGet(db, "SELECT mime_type FROM media_assets WHERE r2_key = ?", [request.params.key]);

    reply.type((row?.mime_type as string | undefined) ?? item.mimeType);
    return reply.send(item.data);
  });

  // Upload file endpoint
  app.post("/api/media/upload", async (request, reply) => {
    const data = await request.file();
    if (!data) return reply.code(400).send({ error: "No file uploaded" });

    const buffer = await data.toBuffer();
    const hash = createHash("sha256").update(buffer).digest("hex");
    const mimeType = data.mimetype;
    const filename = data.filename || `upload-${Date.now()}`;
    const ext = filename.includes(".") ? filename.split(".").pop() : "bin";
    const r2Key = `${hash.slice(0, 16)}-${Date.now()}.${ext}`;

    // Check if already stored with identical hash
    const existing = await queryGet(
      db,
      'SELECT id, filename, mime_type AS "mimeType", size, r2_key AS "r2Key" FROM media_assets WHERE hash = ?',
      [hash],
    );

    if (existing) {
      return {
        id: existing.id,
        filename: existing.filename as string,
        mimeType: existing.mimeType as string,
        size: existing.size as number,
        publicUrl: storage.getPublicUrl(existing.r2Key as string),
      };
    }

    await storage.put(r2Key, buffer, mimeType);

    const info = await queryRun(
      db,
      `
        INSERT INTO media_assets (filename, mime_type, size, r2_key, hash)
        VALUES (?, ?, ?, ?, ?)
      `,
      [filename, mimeType, buffer.length, r2Key, hash],
    );

    const id = Number(info.lastInsertRowid);
    const publicUrl = storage.getPublicUrl(r2Key);

    return reply.code(201).send({
      id,
      filename,
      mimeType,
      size: buffer.length,
      publicUrl,
    });
  });

  // List recent media assets
  app.get("/api/media", async () => {
    const rows = await queryAll(
      db,
      `
        SELECT id, filename, mime_type AS "mimeType", size, r2_key AS "r2Key", created_at AS "createdAt"
        FROM media_assets ORDER BY id DESC LIMIT 100
      `,
    );

    return rows.map((r) => ({
      ...r,
      publicUrl: storage.getPublicUrl(r.r2Key as string),
    }));
  });

  // Get single media asset metadata + publicUrl
  app.get<{ Params: { id: string } }>("/api/media/:id", async (request, reply) => {
    const id = Number(request.params.id);
    const row = (await queryGet(
      db,
      'SELECT id, filename, mime_type AS "mimeType", size, r2_key AS "r2Key", created_at AS "createdAt" FROM media_assets WHERE id = ?',
      [id],
    )) as any;
    if (!row) return reply.code(404).send({ error: "Media not found" });
    return {
      ...row,
      publicUrl: storage.getPublicUrl(row.r2Key as string),
    };
  });

  // Get media content directly (redirect to publicUrl)
  app.get<{ Params: { id: string } }>("/api/media/:id/content", async (request, reply) => {
    const id = Number(request.params.id);
    const row = (await queryGet(db, 'SELECT id, r2_key AS "r2Key" FROM media_assets WHERE id = ?', [id])) as any;
    if (!row) return reply.code(404).send({ error: "Media not found" });
    const publicUrl = storage.getPublicUrl(row.r2Key as string);
    return reply.redirect(publicUrl, 302);
  });

  // Delete media asset
  app.delete<{ Params: { id: string } }>("/api/media/:id", async (request, reply) => {
    const id = Number(request.params.id);
    const row = await queryGet(db, 'SELECT id, r2_key AS "r2Key" FROM media_assets WHERE id = ?', [id]);
    if (!row) return reply.code(404).send({ error: "not found" });

    try {
      await storage.delete(row.r2Key as string);
    } catch {}

    await queryRun(db, "DELETE FROM media_assets WHERE id = ?", [id]);
    return { ok: true };
  });
}

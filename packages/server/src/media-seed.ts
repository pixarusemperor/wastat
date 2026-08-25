import type BetterSqlite3 from "better-sqlite3";
import type { StorageProvider } from "./media.js";
import { createHash } from "node:crypto";

export interface SeededMedia {
  image: { id?: number; url: string; mimeType: string };
  audio: { id?: number; url: string; mimeType: string };
  video: { id?: number; url: string; mimeType: string };
}

const SAMPLE_MEDIA = [
  {
    key: "safari-luxury-villa.jpg",
    sourceUrl: "https://images.unsplash.com/photo-1580587771525-78b9dba3b914?w=1200&q=80",
    mimeType: "image/jpeg",
    type: "image" as const,
  },
  {
    key: "safari-ocean-waves.ogg",
    sourceUrl: "https://actions.google.com/sounds/v1/water/waves_crashing_on_rocks.ogg",
    mimeType: "audio/ogg",
    type: "audio" as const,
  },
  {
    key: "safari-cinematic-tour.mp4",
    sourceUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
    mimeType: "video/mp4",
    type: "video" as const,
  },
];

export async function ensureMediaInR2(storage: StorageProvider, db: BetterSqlite3.Database): Promise<SeededMedia> {
  const result: Partial<Record<"image" | "audio" | "video", { id?: number; url: string; mimeType: string }>> = {};

  for (const item of SAMPLE_MEDIA) {
    try {
      let existing = db
        .prepare("SELECT id, r2_key, mime_type FROM media_assets WHERE r2_key = ?")
        .get(item.key) as { id: number; r2_key: string; mime_type: string } | undefined;

      let publicUrl = storage.getPublicUrl(item.key);

      if (!existing) {
        console.log(`[R2 Seed] Fetching sample ${item.type} from: ${item.sourceUrl}`);
        const res = await fetch(item.sourceUrl);
        if (res.ok) {
          const arrayBuf = await res.arrayBuffer();
          const buffer = Buffer.from(arrayBuf);
          const hash = createHash("sha256").update(buffer).digest("hex");

          publicUrl = await storage.put(item.key, buffer, item.mimeType);
          const info = db
            .prepare(`
            INSERT INTO media_assets (filename, mime_type, size, r2_key, hash)
            VALUES (?, ?, ?, ?, ?)
          `)
            .run(item.key, item.mimeType, buffer.length, item.key, hash);

          existing = { id: Number(info.lastInsertRowid), r2_key: item.key, mime_type: item.mimeType };
          console.log(`[R2 Seed] ✅ Uploaded ${item.key} to R2 (${buffer.length} bytes) -> ${publicUrl}`);
        } else {
          console.warn(`[R2 Seed] Failed to fetch source ${item.sourceUrl}: HTTP ${res.status}`);
        }
      }

      result[item.type] = {
        id: existing?.id,
        url: publicUrl,
        mimeType: item.mimeType,
      };
    } catch (err: any) {
      console.warn(`[R2 Seed] Could not seed ${item.key} to R2:`, err?.message || err);
      result[item.type] = {
        url: item.sourceUrl,
        mimeType: item.mimeType,
      };
    }
  }

  return result as SeededMedia;
}

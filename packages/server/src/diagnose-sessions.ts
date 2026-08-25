import { makeWasenderAdmin } from "./wasender-admin.js";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

function loadEnvFile() {
  const envPaths = [join(process.cwd(), ".env"), join(process.cwd(), "..", "..", ".env")];
  for (const p of envPaths) {
    if (existsSync(p)) {
      const content = readFileSync(p, "utf8");
      for (const line of content.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const eqIdx = trimmed.indexOf("=");
        if (eqIdx !== -1) {
          const key = trimmed.slice(0, eqIdx).trim();
          const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, "");
          if (!process.env[key]) process.env[key] = val;
        }
      }
    }
  }
}

async function diagnose() {
  loadEnvFile();
  const pat = process.env.WASENDER_PAT;
  if (!pat) {
    console.error("WASENDER_PAT is missing");
    return;
  }
  const admin = makeWasenderAdmin(pat);
  const sessions = await admin.listSessions();
  console.log("ALL SESSIONS IN WASENDER ACCOUNT:");
  for (const s of sessions) {
    console.log(`- ID: ${s.id} | Name: ${s.name} | Phone: ${s.phone_number} | Status: ${s.status}`);
    const details = await admin.getSession(s.id).catch((e) => e);
    console.log("  Full details:", JSON.stringify(details, null, 2));
  }
}

diagnose().catch(console.error);

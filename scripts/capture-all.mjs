import { chromium } from "playwright-core";
import { readdirSync, mkdirSync } from "node:fs";
import { spawn } from "node:child_process";
import { join } from "node:path";
import net from "node:net";

const OUT = "artifacts/visual-qa";
mkdirSync(OUT, { recursive: true });

function freePort() {
  return new Promise((resolve) => {
    const srv = net.createServer();
    srv.listen(0, "127.0.0.1", () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
  });
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function findChromium() {
  if (process.env.CHROMIUM_PATH) return process.env.CHROMIUM_PATH;
  const root = `${process.env.HOME}/.cache/ms-playwright`;
  try {
    const dir = readdirSync(root).find((d) => d.startsWith("chromium_headless_shell-"));
    return `${root}/${dir}/chrome-headless-shell-linux64/chrome-headless-shell`;
  } catch {
    return undefined;
  }
}

async function main() {
  const PORT = await freePort();
  const BASE = `http://localhost:${PORT}`;

  const server = spawn("npx", ["vite", "preview", "--port", String(PORT), "--host", "127.0.0.1"], {
    cwd: join(process.cwd(), "packages/web"),
    stdio: "ignore",
  });

  let up = false;
  for (let i = 0; i < 30 && !up; i++) {
    try {
      up = (await fetch(BASE)).ok;
    } catch {
      await sleep(300);
    }
  }

  if (!up) {
    server.kill();
    throw new Error("Vite preview failed to start");
  }

  const browser = await chromium.launch({ executablePath: findChromium() });

  const targets = [
    { name: "inbox-desktop", hash: "#/inbox", width: 1440, height: 900 },
    { name: "inbox-tablet", hash: "#/inbox", width: 768, height: 1024 },
    { name: "inbox-mobile", hash: "#/inbox", width: 390, height: 844 },
    { name: "workflows-desktop", hash: "#/", width: 1440, height: 900 },
    { name: "experiments-desktop", hash: "#/experiments", width: 1440, height: 900 },
    { name: "sessions-desktop", hash: "#/sessions", width: 1440, height: 900 },
  ];

  for (const t of targets) {
    const page = await browser.newPage({ viewport: { width: t.width, height: t.height } });
    await page.goto(`${BASE}/${t.hash}`, { waitUntil: "networkidle" });
    await sleep(500);
    const path = join(OUT, `${t.name}.png`);
    await page.screenshot({ path, fullPage: false });
    console.log(`Captured ${t.name} -> ${path}`);
    await page.close();
  }

  await browser.close();
  server.kill();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

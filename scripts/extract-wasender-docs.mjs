#!/usr/bin/env node
/**
 * Extract the WasenderAPI llms.txt snapshot into organized per-page markdown
 * files and a machine-readable capability registry.
 *
 * The llms.txt file embeds the FULL content of every documentation page under
 * `## API Reference` (each page is a `### <Title>` heading). This script:
 *
 *   1. Saves the raw llms.txt snapshot.
 *   2. Parses the TOC (## sections with links) to build title -> {category, url}.
 *   3. Splits the API Reference body on `### ` headings into per-page files.
 *   4. Writes each page to docs/wasender/<category>/<slug>.md.
 *   5. Records metadata (source URL, download date, sha256).
 *   6. Emits docs/wasender/capabilities.json (derived registry).
 *
 * Usage: node scripts/extract-wasender-docs.mjs <path-to-llms.txt>
 */
import { readFileSync, writeFileSync, mkdirSync, statSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, join, basename } from "node:path";
import { fileURLToPath } from "node:url";

const SRC_URL = "https://www.wasenderapi.com/llms.txt";

function slugify(s) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// Map TOC link title -> { category, url } and preserve order.
function parseToc(lines) {
  const entries = [];
  let category = "uncategorized";
  for (const line of lines) {
    const h = line.match(/^## (.+)$/);
    if (h) {
      category = h[1].trim();
      continue;
    }
    const m = line.match(/^- \[(.*?)\]\((https:\/\/www\.wasenderapi\.com[^)]+)\)/);
    if (m) {
      entries.push({ title: m[1].trim(), url: m[2], category });
    }
  }
  return entries;
}

function main() {
  const input = process.argv[2];
  if (!input) {
    console.error("Usage: node scripts/extract-wasender-docs.mjs <path-to-llms.txt>");
    process.exit(1);
  }

  const root = dirname(dirname(fileURLToPath(import.meta.url))); // repo root
  const raw = readFileSync(input, "utf8");
  const lines = raw.split("\n");

  const downloadDate = new Date().toISOString();
  const sha256 = createHash("sha256").update(raw).digest("hex");
  const sizeBytes = Buffer.byteLength(raw, "utf8");

  const outDir = join(root, "docs", "wasender");
  mkdirSync(outDir, { recursive: true });

  // 1. Save raw snapshot.
  writeFileSync(join(outDir, "llms.txt"), raw);

  // 2. Parse TOC (everything before the API Reference body, which starts at `## API Reference`).
  const apiRefIdx = lines.findIndex((l) => l === "## API Reference");
  const tocLines = lines.slice(0, apiRefIdx);
  const toc = parseToc(tocLines);

  // 3. Split API Reference body on `### ` headings.
  const body = lines.slice(apiRefIdx);
  const pages = []; // { title, lines }
  let current = null;
  for (const line of body) {
    const h = line.match(/^### (.+)$/);
    if (h) {
      if (current) pages.push(current);
      current = { title: h[1].trim(), lines: [] };
    } else if (current) {
      current.lines.push(line);
    }
  }
  if (current) pages.push(current);

  // 4. Match pages to TOC entries (by exact title, fallback to order).
  const titleToToc = new Map(toc.map((e) => [e.title, e]));
  const usedToc = new Set();
  const pageMeta = pages.map((page, i) => {
    let tocEntry = titleToToc.get(page.title);
    if (!tocEntry) {
      // fallback: first unused TOC entry
      tocEntry = toc.find((e) => !usedToc.has(e.title));
    }
    if (tocEntry) usedToc.add(tocEntry.title);
    return {
      ...page,
      category: tocEntry ? tocEntry.category : "uncategorized",
      url: tocEntry ? tocEntry.url : null,
    };
  });

  // 5. Write per-page files.
  const categorySlugs = {};
  const manifest = [];
  for (const page of pageMeta) {
    const cat = slugify(page.category) || "uncategorized";
    categorySlugs[page.category] = cat;
    const slug = page.url ? basename(new URL(page.url).pathname) : slugify(page.title);
    const dir = join(outDir, cat);
    mkdirSync(dir, { recursive: true });
    const frontmatter = `# ${page.title}\n\n> Source: ${page.url ?? "n/a"}\n> Category: ${page.category}\n> Snapshot: ${SRC_URL} (${downloadDate})\n\n`;
    writeFileSync(join(dir, `${slug}.md`), frontmatter + page.lines.join("\n").trimStart() + "\n");
    manifest.push({ title: page.title, category: page.category, url: page.url, file: `${cat}/${slug}.md` });
  }

  // 6. Metadata README.
  const readme = `# WasenderAPI Documentation Snapshot

- **Source URL:** ${SRC_URL}
- **Downloaded:** ${downloadDate}
- **SHA-256:** \`${sha256}\`
- **Size:** ${sizeBytes} bytes
- **Pages captured:** ${pages.length}

This snapshot is a local, versioned copy of the WasenderAPI documentation used to
implement the integration (PRD §3). It must NOT be fetched at runtime (PRD §40).
Refresh deliberately when the upstream docs change.

## Structure

The raw \`llms.txt\` is preserved as-is, and each embedded page is also split into
\`<category>/<slug>.md\` for navigation. See \`docs/INDEX.md\` for the index.

\`\`\`
docs/wasender/
\`\`\`
`;
  writeFileSync(join(outDir, "README.md"), readme);

  // 7. Capability registry (derived).
  const registry = buildRegistry(pageMeta, pages, sha256, downloadDate);
  writeFileSync(join(outDir, "capabilities.json"), JSON.stringify(registry, null, 2) + "\n");

  // 8. Manifest for INDEX.md.
  writeFileSync(join(outDir, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");

  console.log(`Extracted ${pages.length} pages -> ${outDir}`);
  console.log(`Raw snapshot saved (${sizeBytes} bytes, sha256 ${sha256.slice(0, 16)}…)`);
}

function buildRegistry(pageMeta, pages, sha256, downloadDate) {
  const inCategory = (cat) => pageMeta.filter((p) => p.category === cat).map((p) => p.title);

  // Webhook events derived from the "Webhooks" category.
  const webhooks = pageMeta
    .filter((p) => p.category === "Webhooks" && p.title.startsWith("Webhook:"))
    .map((p) => ({ name: p.title.replace(/^Webhook:\s*/, ""), doc: p.url }));

  // Session operations.
  const sessionOps = pageMeta.filter((p) => p.category === "Sessions").map((p) => p.title);

  // Message actions (send-message variants + operations).
  const actions = pageMeta
    .filter((p) => p.category === "Messages")
    .map((p) => p.title);

  return {
    provider: "wasender",
    version: "snapshot",
    downloadedAt: downloadDate,
    sha256,
    sourceUrl: SRC_URL,
    pageCount: pages.length,
    categories: {
      developerSdks: inCategory("Developer SDKs"),
      gettingStarted: inCategory("Getting Started"),
      authentication: inCategory("Authentication"),
      sessions: sessionOps,
      contacts: inCategory("Contacts"),
      messages: actions,
      groups: inCategory("Groups"),
      channels: inCategory("Channels (Communities)"),
      webhooks: inCategory("Webhooks"),
      responsesErrors: inCategory("Responses & Errors"),
      rateLimits: inCategory("Rate Limits"),
    },
    // NOTE: suitability flags are assigned in the next pass (trigger catalog),
    // once each event's payload is inspected. Kept here as a starting index.
    webhookEvents: webhooks,
  };
}

main();

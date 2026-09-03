# Domain Docs

This repository uses a **single-context** layout.

- Domain language & architecture SSOT: `CONTEXT.md` at the repo root.
- Architectural Decision Records: `docs/adr/` at the repo root.

## Consumer Rules

- Skills that need domain context (`improve-codebase-architecture`, `diagnose`, `tdd`, `domain-modeling`) read `CONTEXT.md` first.
- Record significant architectural decisions as ADRs in `docs/adr/` numbered sequentially (`0001-...`, `0002-...`, etc.).
- Maintain strict tracer-bullet vertical slice isolation across monorepo packages (`@wastat/shared`, `@wastat/server`, `@wastat/web`, `@wastat/mcp-server`).

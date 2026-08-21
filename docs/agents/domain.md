# Domain Docs

This repository uses a **single-context** layout.

- Domain language: `CONTEXT.md` at the repo root.
- Architectural decisions: `docs/adr/` at the repo root.

## Consumer rules

- Skills that need domain context (`improve-codebase-architecture`, `diagnose`, `tdd`) read `CONTEXT.md` first.
- Record significant architectural decisions as ADRs in `docs/adr/`.
- If this repo grows into a monorepo, switch to a `CONTEXT-MAP.md` multi-context layout.

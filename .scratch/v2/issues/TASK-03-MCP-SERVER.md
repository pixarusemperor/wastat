# TASK-03: WaStat Native Model Context Protocol (MCP) Server for Block Buzz & Antigravity CLI

- **Track**: Developer Experience & AI Workspaces
- **Status**: `READY_FOR_AGENT`
- **Blockers**: `NONE` (Depends on TASK-01 and TASK-02, both `DONE`)
- **Isolation Seam**: `packages/mcp-server/` (Standalone workspace package)

---

## 🎯 Objective
Expose WaStat CRM and automation engine via Model Context Protocol (JSON-RPC stdio) so developers can monitor, query, triage stuck leads, and drive actions from Block Buzz (`https://github.com/block/buzz`) and Antigravity CLI without opening the web browser.

---

## 📦 Scope & Boundaries
- **Create**: `packages/mcp-server/package.json`, `packages/mcp-server/src/index.ts`, `packages/mcp-server/src/tools.ts`, `packages/mcp-server/src/resources.ts`
- **Dependency**: `@modelcontextprotocol/sdk`, `@wastat/shared`
- **Tools to Implement**:
  1. `wastat_get_system_summary`: Returns active sessions, total contacts by funnel phase, queued broadcast jobs, and 2-hour reply rate.
  2. `wastat_list_stuck_leads`: Lists leads currently in `objection_review` or `phase_1_waiting_answer` past their 2h window.
  3. `wastat_send_operator_reply`: Sends manual WhatsApp message via connected session and pauses bot for 24h.
  4. `wastat_advance_phase`: 1-Click advances contact from Phase 1 to Phase 2.
  5. `wastat_create_private_note`: Appends internal team note to conversation thread.
  6. `wastat_trigger_broadcast`: Schedules a prioritized Cartesian group broadcast.
- **Resources**:
  - `wastat://contacts/{id}`: Returns Customer 360 profile with attributes and message history.
  - `wastat://experiments/{id}/funnel`: Returns multi-stage funnel conversion stats.

---

## 🧪 Verification & Acceptance Criteria
1. `npm run typecheck --workspace=@wastat/mcp-server` passes with 0 errors.
2. `npm test --workspace=@wastat/mcp-server` passes unit tests for tool schema validation and JSON-RPC dispatching with mock database client.

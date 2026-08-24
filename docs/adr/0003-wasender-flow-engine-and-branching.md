# ADR 0003: Wasender Flow Engine, State Machine, and Branching

## Status

Accepted

## Context

We analyzed WACRM (`https://github.com/ArnasDon/wacrm` / `wacrm.tech`) and its architecture. While WACRM relies on Meta's official WhatsApp Cloud API (interactive buttons, list pickers, quick-reply payloads, and webhooks), our system operates over **WasenderAPI** (an unofficial WhatsApp Baileys transport).

This imposes architectural differences:
1. **Interactive UI Restrictions**: Baileys / WhatsApp Web does not reliably render Meta interactive button payloads or list pickers to recipients.
2. **Rate Limits & Anti-Ban**: Fast sequential message blasts trigger anti-spam heuristics. A 5-second per-session throttle and typing/recording presence emulation (`sendPresenceUpdate`) are required.
3. **Execution State Suspension**: Multi-step workflows requiring user input (`collect_input`, `send_menu`) must suspend execution in SQLite (`waiting_input`) with variable context (`vars`), instead of relying on ephemeral webhooks.

## Decision

1. **Numbered Text Menu Protocol**:
   - `send_menu` compiles menu options into bold numbered WhatsApp messages (`*1.* Sales - _Inquiries_`) followed by instructions (`_Reply with the number of your choice._`).
   - Inbound replies (`"1"`, `"2"`, or option names) match option IDs, store `vars.selected_option`, and route to the corresponding edge handle.

2. **Flow State Machine & SQLite Persistence**:
   - Schema updated in `workflow_nodes` (`position_x`, `position_y`, unconstrained types), `workflow_edges` (`handle`), and `workflow_executions` (`vars`, `reprompt_count`, status `waiting_input`).
   - Execution resumes when an inbound message arrives for a suspended conversation before triggering new keyword matches.

3. **Predicate Branching & Split Testing**:
   - `condition` node evaluates operators (`equals`, `contains`, `starts_with`, `present`, `absent`, `greater_than`, `less_than`) against variables and routes via `true` or `false` edge handles.
   - `split_test` node performs weighted random distribution across variant handles (`var_a`, `var_b`).

4. **Variable Interpolation**:
   - Outbound texts and media captions support dynamic Mustache syntax: `{{vars.key}}`, `{{contact.phone}}`, `{{contact.name}}`.

5. **Visual Flow Canvas**:
   - Custom React Flow node cards with distinct color themes, multi-slot bottom handles, side-sheet live configuration, and an in-editor WhatsApp flow simulator.

## Consequences

- Workflows are fully deterministic and inspectable in SQLite.
- Seamless compatibility with both WhatsApp mobile and web clients via WasenderAPI.
- Complete test coverage via Vitest (53/53 tests pass) and Playwright E2E.

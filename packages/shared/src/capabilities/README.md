# Capabilities

The Wasender capability registry is generated from the local documentation
snapshot at `docs/wasender/capabilities.json` (see wayfinder map ticket #2).

A typed TypeScript wrapper — and the trigger/action catalogs the workflow builder
consumes — will be added here in a later ticket (PRD §5–7). Nothing in the UI or
engine may invent provider capabilities; both read from this registry.

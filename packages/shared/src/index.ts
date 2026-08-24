export const WASTAT_VERSION = "0.1.0";

/**
 * Shared workflow-definition and provider types used by both `server` and `web`
 * so the visual builder and the programmatic API converge on one engine (PRD §44).
 */

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

export * from "./matching.js";
export * from "./spintax.js";
export * from "./types.js";
export * from "./capabilities/registry.js";

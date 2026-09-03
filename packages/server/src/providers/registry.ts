import type { WhatsAppProviderType } from "@wastat/shared";
import type { WhatsAppProviderAdapter } from "./types.js";

const adapters = new Map<WhatsAppProviderType, WhatsAppProviderAdapter>();

export function registerProviderAdapter(adapter: WhatsAppProviderAdapter): void {
  adapters.set(adapter.provider, adapter);
}

export function getProviderAdapter(provider: WhatsAppProviderType): WhatsAppProviderAdapter {
  const adapter = adapters.get(provider);
  if (!adapter) {
    throw new Error(`WhatsApp provider adapter not registered for: '${provider}'`);
  }
  return adapter;
}

export function hasProviderAdapter(provider: string): provider is WhatsAppProviderType {
  return adapters.has(provider as WhatsAppProviderType);
}

export function listSupportedProviders(): WhatsAppProviderType[] {
  return Array.from(adapters.keys());
}

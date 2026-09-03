import { registerProviderAdapter, getProviderAdapter, hasProviderAdapter, listSupportedProviders } from "./registry.js";
import { WasenderProviderAdapter } from "./wasender.adapter.js";
import { PeriskopeProviderAdapter } from "./periskope.adapter.js";

// Register default singletons
const wasenderAdapter = new WasenderProviderAdapter();
const periskopeAdapter = new PeriskopeProviderAdapter();

registerProviderAdapter(wasenderAdapter);
registerProviderAdapter(periskopeAdapter);

export * from "./types.js";
export * from "./registry.js";
export { wasenderAdapter, periskopeAdapter };

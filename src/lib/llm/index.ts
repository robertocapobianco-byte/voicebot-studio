import type { LLMProvider, LLMProviderID, LLMModelInfo } from '@/types';
import { OpenAIProvider } from './openai';
import { AnthropicProvider } from './anthropic';
import { GoogleAIProvider } from './google';

/** Registry of all available LLM providers */
const providers: Record<LLMProviderID, LLMProvider> = {
  openai: new OpenAIProvider(),
  anthropic: new AnthropicProvider(),
  google: new GoogleAIProvider(),
};

/** Get a specific provider by ID */
export function getLLMProvider(id: LLMProviderID): LLMProvider {
  const provider = providers[id];
  if (!provider) throw new Error(`Unknown LLM provider: ${id}`);
  return provider;
}

/** Get all registered providers (for UI listing) */
export function getAllProviders(): LLMProvider[] {
  return Object.values(providers);
}

/** Get all models across all providers */
export function getAllModels(): Array<LLMModelInfo & { providerId: LLMProviderID }> {
  return Object.entries(providers).flatMap(([pid, provider]) =>
    provider.models.map((m) => ({ ...m, providerId: pid as LLMProviderID }))
  );
}

// Re-export for convenience
export type { LLMProvider, LLMProviderID };

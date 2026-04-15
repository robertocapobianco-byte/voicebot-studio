import OpenAI from 'openai';
import type { LLMProvider, LLMCompletionOptions, LLMCompletionResult, LLMModelInfo } from '@/types';

export class OpenAIProvider implements LLMProvider {
  id = 'openai' as const;
  name = 'OpenAI';

  models: LLMModelInfo[] = [
    { id: 'gpt-4o', name: 'GPT-4o', contextWindow: 128000, description: 'Most capable model' },
    { id: 'gpt-4o-mini', name: 'GPT-4o Mini', contextWindow: 128000, description: 'Fast & affordable' },
    { id: 'gpt-4-turbo', name: 'GPT-4 Turbo', contextWindow: 128000 },
    { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo', contextWindow: 16385 },
  ];

  private getClient(apiKeyOverride?: string) {
    const apiKey = apiKeyOverride || process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error('OPENAI_API_KEY is not configured. Add it in Settings or as an environment variable.');
    return new OpenAI({ apiKey });
  }

  async complete(options: LLMCompletionOptions): Promise<LLMCompletionResult> {
    const client = this.getClient(options.apiKey);
    const response = await client.chat.completions.create({
      model: options.model,
      messages: options.messages.map((m) => ({ role: m.role, content: m.content })),
      temperature: options.temperature ?? 0.7,
      max_tokens: options.maxTokens ?? 2048,
    });

    const choice = response.choices[0];
    return {
      content: choice?.message?.content ?? '',
      model: response.model,
      usage: response.usage
        ? {
            promptTokens: response.usage.prompt_tokens,
            completionTokens: response.usage.completion_tokens,
            totalTokens: response.usage.total_tokens,
          }
        : undefined,
    };
  }

  async *completeStream(options: LLMCompletionOptions): AsyncIterable<string> {
    const client = this.getClient(options.apiKey);
    const stream = await client.chat.completions.create({
      model: options.model,
      messages: options.messages.map((m) => ({ role: m.role, content: m.content })),
      temperature: options.temperature ?? 0.7,
      max_tokens: options.maxTokens ?? 2048,
      stream: true,
    });

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content;
      if (delta) yield delta;
    }
  }
}

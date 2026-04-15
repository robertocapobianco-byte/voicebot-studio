import Anthropic from '@anthropic-ai/sdk';
import type { LLMProvider, LLMCompletionOptions, LLMCompletionResult, LLMModelInfo } from '@/types';

export class AnthropicProvider implements LLMProvider {
  id = 'anthropic' as const;
  name = 'Anthropic';

  models: LLMModelInfo[] = [
    { id: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4', contextWindow: 200000, description: 'Best balance of speed and intelligence' },
    { id: 'claude-opus-4-20250514', name: 'Claude Opus 4', contextWindow: 200000, description: 'Most capable' },
    { id: 'claude-haiku-4-5-20251001', name: 'Claude Haiku 4.5', contextWindow: 200000, description: 'Fastest' },
  ];

  private getClient(apiKeyOverride?: string) {
    const apiKey = apiKeyOverride || process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not configured. Add it in Settings or as an environment variable.');
    return new Anthropic({ apiKey });
  }

  async complete(options: LLMCompletionOptions): Promise<LLMCompletionResult> {
    const client = this.getClient(options.apiKey);

    // Anthropic uses a separate system param, not in messages array
    const systemMessage = options.messages.find((m) => m.role === 'system');
    const chatMessages = options.messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }));

    const response = await client.messages.create({
      model: options.model,
      max_tokens: options.maxTokens ?? 2048,
      temperature: options.temperature ?? 0.7,
      system: systemMessage?.content ?? '',
      messages: chatMessages,
    });

    const textBlock = response.content.find((b) => b.type === 'text');
    return {
      content: textBlock?.type === 'text' ? textBlock.text : '',
      model: response.model,
      usage: {
        promptTokens: response.usage.input_tokens,
        completionTokens: response.usage.output_tokens,
        totalTokens: response.usage.input_tokens + response.usage.output_tokens,
      },
    };
  }

  async *completeStream(options: LLMCompletionOptions): AsyncIterable<string> {
    const client = this.getClient(options.apiKey);
    const systemMessage = options.messages.find((m) => m.role === 'system');
    const chatMessages = options.messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }));

    const stream = client.messages.stream({
      model: options.model,
      max_tokens: options.maxTokens ?? 2048,
      temperature: options.temperature ?? 0.7,
      system: systemMessage?.content ?? '',
      messages: chatMessages,
    });

    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        yield event.delta.text;
      }
    }
  }
}

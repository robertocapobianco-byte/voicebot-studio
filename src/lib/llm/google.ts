import { GoogleGenerativeAI } from '@google/generative-ai';
import type { LLMProvider, LLMCompletionOptions, LLMCompletionResult, LLMModelInfo } from '@/types';

export class GoogleAIProvider implements LLMProvider {
  id = 'google' as const;
  name = 'Google AI';

  models: LLMModelInfo[] = [
    { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', contextWindow: 1048576, description: 'Fast multimodal' },
    { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro', contextWindow: 2097152, description: 'Long context' },
    { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash', contextWindow: 1048576, description: 'Balanced' },
  ];

  private getClient(apiKeyOverride?: string) {
    const apiKey = apiKeyOverride || process.env.GOOGLE_AI_API_KEY;
    if (!apiKey) throw new Error('GOOGLE_AI_API_KEY is not configured. Add it in Settings or as an environment variable.');
    return new GoogleGenerativeAI(apiKey);
  }

  async complete(options: LLMCompletionOptions): Promise<LLMCompletionResult> {
    const client = this.getClient(options.apiKey);
    const systemMessage = options.messages.find((m) => m.role === 'system');
    const chatMessages = options.messages.filter((m) => m.role !== 'system');

    const model = client.getGenerativeModel({
      model: options.model,
      systemInstruction: systemMessage?.content,
      generationConfig: {
        temperature: options.temperature ?? 0.7,
        maxOutputTokens: options.maxTokens ?? 2048,
      },
    });

    // Map to Gemini format
    const history = chatMessages.slice(0, -1).map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));

    const lastMessage = chatMessages[chatMessages.length - 1];
    const chat = model.startChat({ history });
    const result = await chat.sendMessage(lastMessage.content);

    return {
      content: result.response.text(),
      model: options.model,
      usage: result.response.usageMetadata
        ? {
            promptTokens: result.response.usageMetadata.promptTokenCount ?? 0,
            completionTokens: result.response.usageMetadata.candidatesTokenCount ?? 0,
            totalTokens: result.response.usageMetadata.totalTokenCount ?? 0,
          }
        : undefined,
    };
  }
}

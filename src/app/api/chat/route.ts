import { NextRequest, NextResponse } from 'next/server';
import { getLLMProvider } from '@/lib/llm';
import { SupabaseRetriever } from '@/lib/rag';
import { getBotConfig } from '@/lib/db';
import { buildSystemPrompt } from '@/lib/utils';
import type { ChatRequest, ChatResponse, LLMMessage } from '@/types';

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as ChatRequest;
    const { botId, message, conversationHistory } = body;

    if (!botId || !message) {
      return NextResponse.json({ error: 'botId and message are required' }, { status: 400 });
    }

    // 1. Load bot configuration
    const config = await getBotConfig(botId);
    if (!config) {
      return NextResponse.json({ error: 'Bot not found' }, { status: 404 });
    }

    // 2. RAG retrieval — search knowledge base for relevant context
    const retriever = new SupabaseRetriever();
    let contextSnippets: string[] = [];
    let sources: ChatResponse['sources'] = [];

    try {
      const results = await retriever.search(message, botId, 5);
      if (results.length > 0) {
        sources = results;
        contextSnippets = results.map(
          (r, i) => `[Source ${i + 1}] ${r.content}`
        );
      }
    } catch (err) {
      // RAG failure is non-fatal — continue without context
      console.warn('RAG search failed, continuing without context:', err);
    }

    // 3. Build messages array
    const systemPrompt = buildSystemPrompt(config);
    const contextBlock =
      contextSnippets.length > 0
        ? `\n\n--- Relevant Knowledge Base Context ---\n${contextSnippets.join('\n\n')}\n\nUse the above context to inform your answer when relevant. If the context doesn't help, answer based on your general knowledge.`
        : '';

    const messages: LLMMessage[] = [
      { role: 'system', content: systemPrompt + contextBlock },
      ...conversationHistory,
      { role: 'user', content: message },
    ];

    // 4. Call LLM
    const provider = getLLMProvider(config.llmProvider);
    const result = await provider.complete({
      model: config.llmModel,
      messages,
      temperature: config.temperature,
      maxTokens: config.maxTokens,
    });

    const response: ChatResponse = {
      reply: result.content,
      sources: sources.length > 0 ? sources : undefined,
      usage: result.usage,
    };

    return NextResponse.json(response);
  } catch (err) {
    console.error('Chat API error:', err);
    const message = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

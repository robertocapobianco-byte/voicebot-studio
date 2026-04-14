import { NextRequest, NextResponse } from 'next/server';
import { getLLMProvider } from '@/lib/llm';
import { SupabaseRetriever } from '@/lib/rag';
import { getBotConfig } from '@/lib/db';
import { buildSystemPrompt } from '@/lib/utils';
import type { ChatResponse, LLMMessage, BotConfig } from '@/types';

interface ChatRequestBody {
  botId: string;
  message: string;
  conversationHistory: LLMMessage[];
  botConfig?: BotConfig; // Client sends config as fallback
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as ChatRequestBody;
    const { botId, message, conversationHistory, botConfig: clientConfig } = body;

    if (!message) {
      return NextResponse.json({ error: 'message is required' }, { status: 400 });
    }

    // 1. Try to load config from DB, fall back to client-provided config
    let config: BotConfig | null = null;
    try {
      if (botId) config = await getBotConfig(botId);
    } catch {
      // DB not available, use client config
    }

    if (!config && clientConfig) {
      config = clientConfig;
    }

    if (!config) {
      // Ultimate fallback: default config
      config = {
        id: botId || 'default',
        name: 'VoiceBot',
        systemPrompt: 'Sei un assistente AI utile e professionale. Rispondi in modo chiaro e conciso.',
        personality: { tone: 'professional', responseStyle: 'Clear and helpful', detailLevel: 'balanced', language: 'it-IT' },
        llmProvider: (process.env.NEXT_PUBLIC_DEFAULT_LLM_PROVIDER as BotConfig['llmProvider']) || 'openai',
        llmModel: process.env.NEXT_PUBLIC_DEFAULT_LLM_MODEL || 'gpt-4o',
        sttProvider: 'web-speech',
        ttsProvider: 'web-speech',
        temperature: 0.7,
        maxTokens: 2048,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    }

    // 2. RAG retrieval
    let contextSnippets: string[] = [];
    let sources: ChatResponse['sources'] = [];
    try {
      const retriever = new SupabaseRetriever();
      const results = await retriever.search(message, config.id, 5);
      if (results.length > 0) {
        sources = results;
        contextSnippets = results.map((r, i) => `[Source ${i + 1}] ${r.content}`);
      }
    } catch {
      // RAG not available, continue without context
    }

    // 3. Build messages
    const systemPrompt = buildSystemPrompt(config);
    const contextBlock = contextSnippets.length > 0
      ? `\n\n--- Relevant Knowledge Base Context ---\n${contextSnippets.join('\n\n')}\n\nUse the above context to inform your answer when relevant.`
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

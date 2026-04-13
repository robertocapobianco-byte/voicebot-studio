'use client';

import { useState, useCallback, useRef } from 'react';
import type { ChatMessage, LLMMessage, BotConfig, VoiceChatState, RetrievalResult } from '@/types';
import { generateId } from '@/lib/utils';

interface UseChatOptions {
  botConfig: BotConfig;
}

export function useChat({ botConfig }: UseChatOptions) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [voiceState, setVoiceState] = useState<VoiceChatState>('idle');
  const abortRef = useRef<AbortController | null>(null);

  const sendMessage = useCallback(
    async (text: string): Promise<string | null> => {
      if (!text.trim()) return null;
      setError(null);

      // Add user message
      const userMessage: ChatMessage = {
        id: generateId(),
        role: 'user',
        content: text.trim(),
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, userMessage]);

      // Build conversation history for the API
      const history: LLMMessage[] = messages.map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      }));

      setIsLoading(true);
      setVoiceState('generating');

      try {
        abortRef.current = new AbortController();
        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            botId: botConfig.id,
            message: text.trim(),
            conversationHistory: history,
          }),
          signal: abortRef.current.signal,
        });

        if (!res.ok) {
          const errBody = await res.json().catch(() => ({ error: 'Unknown error' }));
          throw new Error(errBody.error || `API returned ${res.status}`);
        }

        const data = await res.json();

        // Add assistant message
        const assistantMessage: ChatMessage = {
          id: generateId(),
          role: 'assistant',
          content: data.reply,
          timestamp: new Date().toISOString(),
          sources: data.sources as RetrievalResult[] | undefined,
        };
        setMessages((prev) => [...prev, assistantMessage]);

        return data.reply;
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') return null;
        const msg = err instanceof Error ? err.message : 'Failed to get response';
        setError(msg);
        return null;
      } finally {
        setIsLoading(false);
        setVoiceState('idle');
        abortRef.current = null;
      }
    },
    [botConfig.id, messages]
  );

  const clearMessages = useCallback(() => {
    setMessages([]);
    setError(null);
  }, []);

  const cancelRequest = useCallback(() => {
    abortRef.current?.abort();
    setIsLoading(false);
    setVoiceState('idle');
  }, []);

  return {
    messages,
    isLoading,
    error,
    voiceState,
    setVoiceState,
    sendMessage,
    clearMessages,
    cancelRequest,
  };
}

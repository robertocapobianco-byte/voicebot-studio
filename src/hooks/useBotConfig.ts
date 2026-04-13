'use client';

import { useState, useCallback, useEffect } from 'react';
import type { BotConfig, BotPersonality } from '@/types';
import { generateId } from '@/lib/utils';

const DEFAULT_PERSONALITY: BotPersonality = {
  tone: 'professional',
  responseStyle: 'Clear, structured, and helpful',
  detailLevel: 'balanced',
  language: 'it-IT',
};

const DEFAULT_CONFIG: BotConfig = {
  id: '',
  name: 'Nuovo Chatbot',
  systemPrompt: 'Sei un assistente AI utile e professionale. Rispondi in modo chiaro e conciso.',
  personality: DEFAULT_PERSONALITY,
  llmProvider: 'openai',
  llmModel: 'gpt-4o',
  sttProvider: 'web-speech',
  ttsProvider: 'web-speech',
  temperature: 0.7,
  maxTokens: 2048,
  createdAt: '',
  updatedAt: '',
};

const STORAGE_KEY = 'voicebot-config';

export function useBotConfig() {
  const [config, setConfig] = useState<BotConfig>(() => {
    if (typeof window === 'undefined') return { ...DEFAULT_CONFIG, id: 'default' };
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        // Invalid JSON, use default
      }
    }
    return { ...DEFAULT_CONFIG, id: generateId() };
  });
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  // Persist to localStorage on every change
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    }
  }, [config]);

  const updateConfig = useCallback((updates: Partial<BotConfig>) => {
    setConfig((prev) => ({
      ...prev,
      ...updates,
      updatedAt: new Date().toISOString(),
    }));
  }, []);

  const updatePersonality = useCallback((updates: Partial<BotPersonality>) => {
    setConfig((prev) => ({
      ...prev,
      personality: { ...prev.personality, ...updates },
      updatedAt: new Date().toISOString(),
    }));
  }, []);

  const saveToServer = useCallback(async () => {
    setIsSaving(true);
    try {
      // Future: POST to /api/bots to persist in Supabase
      // For now, localStorage is the persistence layer
      await new Promise((r) => setTimeout(r, 300)); // Simulate save
      setLastSaved(new Date());
    } finally {
      setIsSaving(false);
    }
  }, []);

  const resetConfig = useCallback(() => {
    const newConfig = { ...DEFAULT_CONFIG, id: generateId() };
    setConfig(newConfig);
  }, []);

  return {
    config,
    updateConfig,
    updatePersonality,
    saveToServer,
    resetConfig,
    isSaving,
    lastSaved,
  };
}

'use client';

import { useState, useCallback, useEffect } from 'react';
import type { BotConfig, BotPersonality, ApiKeysConfig } from '@/types';

const DEFAULT_PERSONALITY: BotPersonality = {
  tone: 'professional',
  responseStyle: 'Clear, structured, and helpful',
  detailLevel: 'balanced',
  language: 'it-IT',
};

function generateId(): string {
  return crypto.randomUUID();
}

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

/** Strip apiKeys before persisting to localStorage (keys stay server-side only) */
function stripKeysForStorage(config: BotConfig): BotConfig {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { apiKeys, ...rest } = config;
  return rest as BotConfig;
}

export function useBotConfig() {
  const [config, setConfig] = useState<BotConfig>(() => {
    if (typeof window === 'undefined') return { ...DEFAULT_CONFIG, id: 'default' };
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // Never trust apiKeys from localStorage — they come from the server
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { apiKeys, ...rest } = parsed;
        return rest as BotConfig;
      } catch { /* use default */ }
    }
    return { ...DEFAULT_CONFIG, id: generateId() };
  });

  // Separate state for API keys — loaded from server only, never in localStorage
  const [apiKeys, setApiKeys] = useState<ApiKeysConfig>({});
  const [apiKeysLoaded, setApiKeysLoaded] = useState(false);

  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  // Persist config (without apiKeys) to localStorage on every change
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(stripKeysForStorage(config)));
    }
  }, [config]);

  // Load API keys from server when bot ID is available
  useEffect(() => {
    if (!config.id || config.id === 'default') return;

    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/bots?id=${encodeURIComponent(config.id)}`);
        if (res.ok) {
          const data = await res.json();
          if (!cancelled && data.config?.apiKeys) {
            setApiKeys(data.config.apiKeys);
          }
        }
      } catch {
        // Server not available — keys stay empty
      } finally {
        if (!cancelled) setApiKeysLoaded(true);
      }
    })();

    return () => { cancelled = true; };
  }, [config.id]);

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

  const updateApiKeys = useCallback((updates: Partial<ApiKeysConfig>) => {
    setApiKeys((prev) => ({ ...prev, ...updates }));
  }, []);

  const saveToServer = useCallback(async () => {
    setIsSaving(true);
    try {
      // Merge apiKeys into config for the server save
      const payload = { ...config, apiKeys };
      const res = await fetch('/api/bots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Save failed' }));
        throw new Error(err.error || 'Save failed');
      }
      const data = await res.json();
      if (data.config) {
        // Update local state — strip keys from localStorage version
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { apiKeys: serverKeys, ...rest } = data.config;
        setConfig(rest as BotConfig);
        if (serverKeys) setApiKeys(serverKeys);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(stripKeysForStorage(data.config)));
      }
      setLastSaved(new Date());
    } catch (err) {
      console.error('Failed to save to server:', err);
      setLastSaved(new Date());
    } finally {
      setIsSaving(false);
    }
  }, [config, apiKeys]);

  const resetConfig = useCallback(() => {
    const newConfig = { ...DEFAULT_CONFIG, id: generateId() };
    setConfig(newConfig);
    setApiKeys({});
  }, []);

  return {
    config,
    apiKeys,
    apiKeysLoaded,
    updateConfig,
    updatePersonality,
    updateApiKeys,
    saveToServer,
    resetConfig,
    isSaving,
    lastSaved,
  };
}

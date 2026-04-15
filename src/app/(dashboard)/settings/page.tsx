'use client';

import { useState } from 'react';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useBotConfig } from '@/hooks';
import { Select } from '@/components/ui/select';
import {
  Key,
  Shield,
  Globe,
  Save,
  Eye,
  EyeOff,
  CheckCircle,
} from 'lucide-react';
import type { STTProviderID, TTSProviderID, ApiKeysConfig } from '@/types';

const apiKeyFields: {
  key: keyof ApiKeysConfig;
  label: string;
  description: string;
  placeholder: string;
}[] = [
  { key: 'openai', label: 'OpenAI', description: 'GPT models + Embeddings', placeholder: 'sk-...' },
  { key: 'anthropic', label: 'Anthropic', description: 'Claude models', placeholder: 'sk-ant-...' },
  { key: 'google', label: 'Google AI', description: 'Gemini models', placeholder: 'AIza...' },
  { key: 'elevenlabs', label: 'ElevenLabs', description: 'TTS premium', placeholder: 'xi-...' },
  { key: 'elevenLabsVoiceId', label: 'ElevenLabs Voice ID', description: 'ID voce personalizzata (opzionale)', placeholder: 'es. 21m00Tcm4TlvDq8ikWAM' },
];

export default function SettingsPage() {
  const { config, apiKeys, apiKeysLoaded, updateConfig, updateApiKeys, saveToServer, isSaving, lastSaved } = useBotConfig();
  const [visibleKeys, setVisibleKeys] = useState<Record<string, boolean>>({});
  const [keysSaved, setKeysSaved] = useState(false);

  const toggleVisibility = (key: string) => {
    setVisibleKeys((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSaveKeys = async () => {
    await saveToServer();
    setKeysSaved(true);
    setTimeout(() => setKeysSaved(false), 3000);
  };

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-surface-900">Impostazioni</h2>
        <p className="text-surface-500 mt-1">
          Configura provider API, speech e opzioni avanzate.
        </p>
      </div>

      <div className="space-y-6 animate-fade-in">
        {/* API Keys */}
        <Card>
          <CardHeader>
            <CardTitle>
              <span className="flex items-center gap-2">
                <Key className="w-5 h-5 text-brand-500" />
                Chiavi API
              </span>
            </CardTitle>
            {lastSaved && keysSaved && (
              <Badge variant="success">
                <CheckCircle className="w-3 h-3 mr-1" />
                Salvato
              </Badge>
            )}
          </CardHeader>

          <p className="text-sm text-surface-500 mb-4">
            Inserisci le chiavi API per ciascun provider. Vengono salvate su Supabase e{' '}
            <strong>non vengono mai esposte nel browser</strong>. Se non specificate, il sistema usa
            le variabili d&apos;ambiente di Vercel come fallback.
          </p>

          {!apiKeysLoaded ? (
            <div className="text-sm text-surface-400 py-4 text-center">
              Caricamento chiavi dal server...
            </div>
          ) : (
            <div className="space-y-3">
              {apiKeyFields.map((field) => (
                <div
                  key={field.key}
                  className="flex items-start gap-3 px-4 py-3 rounded-xl bg-surface-50"
                >
                  <Shield className="w-4 h-4 text-surface-400 mt-2.5" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-sm font-medium text-surface-800">{field.label}</p>
                      <p className="text-xs text-surface-400">{field.description}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type={visibleKeys[field.key] ? 'text' : 'password'}
                        value={apiKeys[field.key] ?? ''}
                        onChange={(e) => updateApiKeys({ [field.key]: e.target.value })}
                        placeholder={field.placeholder}
                        className="flex-1 px-3 py-1.5 text-sm border border-surface-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent font-mono"
                        autoComplete="off"
                      />
                      <button
                        type="button"
                        onClick={() => toggleVisibility(field.key)}
                        className="p-1.5 text-surface-400 hover:text-surface-600 transition-colors"
                        title={visibleKeys[field.key] ? 'Nascondi' : 'Mostra'}
                      >
                        {visibleKeys[field.key] ? (
                          <EyeOff className="w-4 h-4" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                    {apiKeys[field.key] && !visibleKeys[field.key] && (
                      <div className="flex items-center gap-1 mt-1">
                        <Badge variant="success" className="text-xs">
                          <CheckCircle className="w-3 h-3 mr-1" />
                          Configurata
                        </Badge>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="mt-4 flex items-center justify-between">
            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 flex-1 mr-4">
              <p className="text-xs text-amber-700">
                <strong>Fallback:</strong> Se una chiave non è inserita qui, il sistema usa la
                variabile d&apos;ambiente corrispondente configurata su Vercel.
              </p>
            </div>
            <Button
              onClick={handleSaveKeys}
              loading={isSaving}
              icon={<Save className="w-4 h-4" />}
            >
              Salva Chiavi
            </Button>
          </div>
        </Card>

        {/* Speech Providers */}
        <Card>
          <CardHeader>
            <CardTitle>
              <span className="flex items-center gap-2">
                <Globe className="w-5 h-5 text-brand-500" />
                Provider Speech
              </span>
            </CardTitle>
          </CardHeader>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Select
              label="Speech-to-Text"
              value={config.sttProvider}
              onChange={(v) => updateConfig({ sttProvider: v as STTProviderID })}
              options={[
                { value: 'web-speech', label: 'Browser (Web Speech API)' },
                { value: 'whisper', label: 'OpenAI Whisper (prossimamente)' },
              ]}
            />

            <Select
              label="Text-to-Speech"
              value={config.ttsProvider}
              onChange={(v) => updateConfig({ ttsProvider: v as TTSProviderID })}
              options={[
                { value: 'web-speech', label: 'Browser (Speech Synthesis)' },
                { value: 'elevenlabs', label: 'ElevenLabs (Alta qualità)' },
              ]}
            />
          </div>

          {config.ttsProvider === 'elevenlabs' && (
            <div className="mt-4 p-3 rounded-xl bg-emerald-50 border border-emerald-200">
              <p className="text-xs text-emerald-700">
                <strong>ElevenLabs attivo.</strong> La chiave API viene letta dalla configurazione qui sopra.
                Se non specificata, usa la variabile d&apos;ambiente di Vercel.
              </p>
            </div>
          )}
        </Card>

        {/* Info */}
        <Card>
          <CardHeader>
            <CardTitle>Architettura</CardTitle>
          </CardHeader>

          <div className="text-sm text-surface-600 space-y-2">
            <p>
              VoiceBot Studio utilizza un&apos;architettura modulare basata su adapter pattern.
              Ogni componente (LLM, STT, TTS, Document Processing, Retrieval) è intercambiabile.
            </p>
            <p>
              Il RAG pipeline usa pgvector su Supabase per la ricerca semantica.
              I documenti vengono processati in chunk con overlap, embeddings via OpenAI,
              e recuperati per similarità coseno durante la chat.
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
}

'use client';

import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useBotConfig } from '@/hooks';
import { Select } from '@/components/ui/select';
import {
  Key,
  Shield,
  Globe,
  Server,
} from 'lucide-react';
import type { STTProviderID, TTSProviderID } from '@/types';

const envVarStatus = (name: string) => {
  // Client-side: we can only check NEXT_PUBLIC_ vars
  // All others are server-side only and assumed configured
  return { configured: true, label: 'Server-side' };
};

const apiKeys = [
  { name: 'OPENAI_API_KEY', label: 'OpenAI', description: 'GPT models + Embeddings' },
  { name: 'ANTHROPIC_API_KEY', label: 'Anthropic', description: 'Claude models' },
  { name: 'GOOGLE_AI_API_KEY', label: 'Google AI', description: 'Gemini models' },
  { name: 'ELEVENLABS_API_KEY', label: 'ElevenLabs', description: 'TTS premium (opzionale)' },
];

export default function SettingsPage() {
  const { config, updateConfig } = useBotConfig();

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-surface-900">Impostazioni</h2>
        <p className="text-surface-500 mt-1">
          Configura provider API, speech e opzioni avanzate.
        </p>
      </div>

      <div className="space-y-6 animate-fade-in">
        {/* API Keys Status */}
        <Card>
          <CardHeader>
            <CardTitle>
              <span className="flex items-center gap-2">
                <Key className="w-5 h-5 text-brand-500" />
                Chiavi API
              </span>
            </CardTitle>
          </CardHeader>

          <p className="text-sm text-surface-500 mb-4">
            Le chiavi API sono gestite tramite variabili d&apos;ambiente (.env.local).
            Non vengono mai esposte nel browser.
          </p>

          <div className="space-y-2">
            {apiKeys.map((key) => (
              <div
                key={key.name}
                className="flex items-center justify-between px-4 py-3 rounded-xl bg-surface-50"
              >
                <div className="flex items-center gap-3">
                  <Shield className="w-4 h-4 text-surface-400" />
                  <div>
                    <p className="text-sm font-medium text-surface-800">{key.label}</p>
                    <p className="text-xs text-surface-400">{key.description}</p>
                  </div>
                </div>
                <Badge variant="info">
                  <Server className="w-3 h-3 mr-1" />
                  .env.local
                </Badge>
              </div>
            ))}
          </div>

          <div className="mt-4 p-3 rounded-xl bg-amber-50 border border-amber-200">
            <p className="text-xs text-amber-700">
              <strong>Nota:</strong> Copia <code className="px-1 bg-amber-100 rounded">.env.example</code> in{' '}
              <code className="px-1 bg-amber-100 rounded">.env.local</code> e inserisci le tue chiavi.
              Su Vercel, configura le variabili nella sezione Environment Variables del progetto.
            </p>
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
                <strong>ElevenLabs attivo.</strong> Assicurati che <code className="px-1 bg-emerald-100 rounded">ELEVENLABS_API_KEY</code> sia
                configurata nelle variabili d&apos;ambiente di Vercel.
                Opzionale: <code className="px-1 bg-emerald-100 rounded">ELEVENLABS_VOICE_ID</code> per scegliere la voce.
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

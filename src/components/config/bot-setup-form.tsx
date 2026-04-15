'use client';

import React from 'react';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Save, RotateCcw, Sparkles } from 'lucide-react';
import type { BotConfig, BotPersonality, TonePreset, DetailLevel, LLMProviderID } from '@/types';

interface BotSetupFormProps {
  config: BotConfig;
  onUpdate: (updates: Partial<BotConfig>) => void;
  onUpdatePersonality: (updates: Partial<BotPersonality>) => void;
  onSave: () => void;
  onReset: () => void;
  isSaving: boolean;
  lastSaved: Date | null;
}

const toneOptions: { value: TonePreset; label: string }[] = [
  { value: 'professional', label: 'Professionale' },
  { value: 'friendly', label: 'Amichevole' },
  { value: 'empathetic', label: 'Empatico' },
  { value: 'technical', label: 'Tecnico' },
  { value: 'creative', label: 'Creativo' },
  { value: 'concise', label: 'Conciso' },
  { value: 'custom', label: 'Personalizzato' },
];

const detailOptions: { value: DetailLevel; label: string }[] = [
  { value: 'minimal', label: 'Minimale' },
  { value: 'balanced', label: 'Bilanciato' },
  { value: 'detailed', label: 'Dettagliato' },
  { value: 'exhaustive', label: 'Esaustivo' },
];

const providerOptions: { value: LLMProviderID; label: string }[] = [
  { value: 'openai', label: 'OpenAI' },
  { value: 'anthropic', label: 'Anthropic (Claude)' },
  { value: 'google', label: 'Google AI (Gemini)' },
];

const modelsByProvider: Record<LLMProviderID, { value: string; label: string }[]> = {
  openai: [
    { value: 'gpt-4o', label: 'GPT-4o' },
    { value: 'gpt-4o-mini', label: 'GPT-4o Mini' },
    { value: 'gpt-4-turbo', label: 'GPT-4 Turbo' },
    { value: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo' },
  ],
  anthropic: [
    { value: 'claude-sonnet-4-20250514', label: 'Claude Sonnet 4' },
    { value: 'claude-opus-4-20250514', label: 'Claude Opus 4' },
    { value: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5' },
  ],
  google: [
    { value: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash' },
    { value: 'gemini-1.5-pro', label: 'Gemini 1.5 Pro' },
    { value: 'gemini-1.5-flash', label: 'Gemini 1.5 Flash' },
  ],
};

export function BotSetupForm({
  config,
  onUpdate,
  onUpdatePersonality,
  onSave,
  onReset,
  isSaving,
  lastSaved,
}: BotSetupFormProps) {
  const currentModels = modelsByProvider[config.llmProvider] ?? [];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Bot Identity */}
      <Card>
        <CardHeader>
          <CardTitle>
            <span className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-brand-500" />
              Identità del Bot
            </span>
          </CardTitle>
          {lastSaved && (
            <Badge variant="success">
              Salvato {lastSaved.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}
            </Badge>
          )}
        </CardHeader>

        <div className="space-y-4">
          <Input
            label="Nome del Chatbot"
            value={config.name}
            onChange={(e) => onUpdate({ name: e.target.value })}
            placeholder="Es. Assistente Vendite"
          />

          <Textarea
            label="System Prompt"
            value={config.systemPrompt}
            onChange={(e) => onUpdate({ systemPrompt: e.target.value })}
            placeholder="Definisci il comportamento base del chatbot..."
            rows={5}
          />
        </div>
      </Card>

      {/* Personality */}
      <Card>
        <CardHeader>
          <CardTitle>Personalità</CardTitle>
        </CardHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Select
            label="Tono"
            value={config.personality.tone}
            onChange={(v) => onUpdatePersonality({ tone: v as TonePreset })}
            options={toneOptions}
          />

          <Select
            label="Livello di Dettaglio"
            value={config.personality.detailLevel}
            onChange={(v) => onUpdatePersonality({ detailLevel: v as DetailLevel })}
            options={detailOptions}
          />

          {config.personality.tone === 'custom' && (
            <div className="md:col-span-2">
              <Textarea
                label="Descrizione Tono Personalizzato"
                value={config.personality.customToneDescription ?? ''}
                onChange={(e) => onUpdatePersonality({ customToneDescription: e.target.value })}
                placeholder="Descrivi il tono che vuoi per il tuo chatbot..."
                rows={3}
              />
            </div>
          )}

          <div className="md:col-span-2">
            <Input
              label="Stile di Risposta"
              value={config.personality.responseStyle}
              onChange={(e) => onUpdatePersonality({ responseStyle: e.target.value })}
              placeholder="Es. Chiaro, strutturato, con esempi pratici"
            />
          </div>

          <Select
            label="Lingua"
            value={config.personality.language}
            onChange={(v) => onUpdatePersonality({ language: v })}
            options={[
              { value: 'it-IT', label: 'Italiano' },
              { value: 'en-US', label: 'English' },
              { value: 'es-ES', label: 'Español' },
              { value: 'fr-FR', label: 'Français' },
              { value: 'de-DE', label: 'Deutsch' },
            ]}
          />
        </div>
      </Card>

      {/* Model Selection */}
      <Card>
        <CardHeader>
          <CardTitle>Modello LLM</CardTitle>
        </CardHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Select
            label="Provider"
            value={config.llmProvider}
            onChange={(v) => {
              const pid = v as LLMProviderID;
              const firstModel = modelsByProvider[pid]?.[0]?.value ?? '';
              onUpdate({ llmProvider: pid, llmModel: firstModel });
            }}
            options={providerOptions}
          />

          <Select
            label="Modello"
            value={config.llmModel}
            onChange={(v) => onUpdate({ llmModel: v })}
            options={currentModels}
          />

          <div>
            <label className="block text-sm font-medium text-surface-700 mb-1.5">
              Temperatura: {config.temperature.toFixed(1)}
            </label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={config.temperature}
              onChange={(e) => onUpdate({ temperature: parseFloat(e.target.value) })}
              className="w-full h-2 bg-surface-200 rounded-full appearance-none cursor-pointer accent-brand-600"
            />
            <div className="flex justify-between text-xs text-surface-400 mt-1">
              <span>Preciso</span>
              <span>Creativo</span>
            </div>
          </div>

          <Input
            label="Max Tokens"
            type="number"
            value={config.maxTokens.toString()}
            onChange={(e) => onUpdate({ maxTokens: parseInt(e.target.value) || 2048 })}
            min={256}
            max={8192}
          />
        </div>
      </Card>

      {/* Actions */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={onReset} icon={<RotateCcw className="w-4 h-4" />}>
          Reset
        </Button>
        <Button onClick={onSave} loading={isSaving} icon={<Save className="w-4 h-4" />}>
          Salva Configurazione
        </Button>
      </div>
    </div>
  );
}

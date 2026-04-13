'use client';

import React, { useCallback, useRef, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useChat } from '@/hooks/useChat';
import { useVoice } from '@/hooks/useVoice';
import { cn } from '@/lib/utils';
import {
  Mic,
  MicOff,
  Square,
  Volume2,
  VolumeX,
  RotateCcw,
  Send,
  Bot,
  User,
  Loader2,
} from 'lucide-react';
import type { BotConfig, VoiceChatState } from '@/types';

interface VoiceChatProps {
  botConfig: BotConfig;
}

const stateLabels: Record<VoiceChatState, string> = {
  idle: 'Premi per parlare',
  listening: 'Ti ascolto...',
  processing: 'Trascrizione...',
  generating: 'Sto pensando...',
  speaking: 'Rispondo...',
};

const stateColors: Record<VoiceChatState, string> = {
  idle: 'bg-brand-600 hover:bg-brand-700',
  listening: 'bg-rose-500 hover:bg-rose-600',
  processing: 'bg-amber-500',
  generating: 'bg-violet-500',
  speaking: 'bg-emerald-500',
};

export function VoiceChat({ botConfig }: VoiceChatProps) {
  const {
    messages,
    isLoading,
    error,
    voiceState,
    setVoiceState,
    sendMessage,
    clearMessages,
  } = useChat({ botConfig });

  const textInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const handleTranscript = useCallback(
    async (text: string) => {
      if (!text.trim()) return;
      setVoiceState('processing');
      const reply = await sendMessage(text);
      if (reply) {
        setVoiceState('speaking');
        await voice.speak(reply);
      }
      setVoiceState('idle');
    },
    [sendMessage, setVoiceState] // eslint-disable-line react-hooks/exhaustive-deps
  );

  const voice = useVoice({
    sttProvider: botConfig.sttProvider,
    ttsProvider: botConfig.ttsProvider,
    onTranscript: handleTranscript,
    onStateChange: setVoiceState,
  });

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const toggleListening = () => {
    if (voice.isListening) {
      voice.stopListening();
      setVoiceState('idle');
    } else {
      voice.startListening();
    }
  };

  const handleTextSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const input = textInputRef.current;
    if (!input?.value.trim()) return;
    const text = input.value;
    input.value = '';
    const reply = await sendMessage(text);
    if (reply) {
      await voice.speak(reply);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] animate-fade-in">
      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto px-1 py-4 space-y-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center text-surface-400">
            <div className="w-20 h-20 rounded-3xl bg-surface-100 flex items-center justify-center mb-4">
              <Bot className="w-10 h-10 text-surface-300" />
            </div>
            <p className="font-semibold text-surface-600 text-lg">{botConfig.name}</p>
            <p className="text-sm mt-1 max-w-sm">
              Premi il pulsante del microfono per iniziare a parlare, oppure scrivi un messaggio.
            </p>
          </div>
        )}

        {messages.map((msg) => (
          <div
            key={msg.id}
            className={cn(
              'flex gap-3 animate-slide-up',
              msg.role === 'user' ? 'justify-end' : 'justify-start'
            )}
          >
            {msg.role === 'assistant' && (
              <div className="w-8 h-8 rounded-xl bg-brand-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                <Bot className="w-4 h-4 text-brand-600" />
              </div>
            )}
            <div
              className={cn(
                'max-w-[75%] px-4 py-3 rounded-2xl text-sm leading-relaxed',
                msg.role === 'user'
                  ? 'bg-brand-600 text-white rounded-br-md'
                  : 'bg-surface-100 text-surface-800 rounded-bl-md'
              )}
            >
              <p className="whitespace-pre-wrap">{msg.content}</p>
              {msg.sources && msg.sources.length > 0 && (
                <div className="mt-2 pt-2 border-t border-surface-200/50">
                  <p className="text-xs opacity-60">
                    Fonti: {msg.sources.length} documenti consultati
                  </p>
                </div>
              )}
            </div>
            {msg.role === 'user' && (
              <div className="w-8 h-8 rounded-xl bg-surface-200 flex items-center justify-center flex-shrink-0 mt-0.5">
                <User className="w-4 h-4 text-surface-600" />
              </div>
            )}
          </div>
        ))}

        {isLoading && (
          <div className="flex gap-3 animate-slide-up">
            <div className="w-8 h-8 rounded-xl bg-brand-100 flex items-center justify-center flex-shrink-0">
              <Bot className="w-4 h-4 text-brand-600" />
            </div>
            <div className="bg-surface-100 px-4 py-3 rounded-2xl rounded-bl-md">
              <div className="flex items-center gap-2 text-sm text-surface-500">
                <Loader2 className="w-4 h-4 animate-spin" />
                Sto elaborando...
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="mx-auto max-w-md p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm text-center">
            {error}
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Voice Control + Text Input */}
      <div className="border-t border-surface-200 bg-white p-4 space-y-3">
        {/* Transcript indicator */}
        {voice.transcript && voiceState === 'listening' && (
          <div className="text-center text-sm text-surface-500 italic animate-fade-in">
            &ldquo;{voice.transcript}&rdquo;
          </div>
        )}

        {/* Voice button */}
        <div className="flex items-center justify-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={clearMessages}
            icon={<RotateCcw className="w-4 h-4" />}
            disabled={messages.length === 0}
          >
            Reset
          </Button>

          <button
            onClick={toggleListening}
            disabled={isLoading}
            className={cn(
              'relative w-16 h-16 rounded-full flex items-center justify-center text-white transition-all duration-200 shadow-lg',
              stateColors[voiceState],
              isLoading && 'opacity-50 cursor-not-allowed'
            )}
          >
            {/* Pulse ring when listening */}
            {voiceState === 'listening' && (
              <span className="absolute inset-0 rounded-full bg-rose-400 animate-pulse-ring" />
            )}
            <span className="relative z-10">
              {voiceState === 'listening' ? (
                <MicOff className="w-6 h-6" />
              ) : voiceState === 'speaking' ? (
                <Volume2 className="w-6 h-6" />
              ) : isLoading ? (
                <Loader2 className="w-6 h-6 animate-spin" />
              ) : (
                <Mic className="w-6 h-6" />
              )}
            </span>
          </button>

          <Button
            variant="ghost"
            size="sm"
            onClick={voice.isSpeaking ? voice.stopSpeaking : undefined}
            disabled={!voice.isSpeaking}
            icon={<VolumeX className="w-4 h-4" />}
          >
            Stop
          </Button>
        </div>

        <p className="text-center text-xs text-surface-400">
          {stateLabels[voiceState]}
        </p>

        {/* Text input fallback */}
        <form onSubmit={handleTextSubmit} className="flex gap-2">
          <input
            ref={textInputRef}
            type="text"
            placeholder="Scrivi un messaggio..."
            className="flex-1 px-4 py-2.5 rounded-xl border border-surface-200 bg-surface-50 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
            disabled={isLoading}
          />
          <Button type="submit" disabled={isLoading} icon={<Send className="w-4 h-4" />}>
            Invia
          </Button>
        </form>
      </div>
    </div>
  );
}

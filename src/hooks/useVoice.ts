'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { getSTTProvider, getTTSProvider } from '@/lib/speech';
import type { STTProviderID, TTSProviderID, VoiceChatState } from '@/types';

interface UseVoiceOptions {
  sttProvider: STTProviderID;
  ttsProvider: TTSProviderID;
  botId?: string;
  onTranscript: (text: string) => void;
  onStateChange?: (state: VoiceChatState) => void;
}

export function useVoice({ sttProvider, ttsProvider, botId, onTranscript, onStateChange }: UseVoiceOptions) {
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);

  const sttRef = useRef(getSTTProvider(sttProvider));
  const ttsRef = useRef(getTTSProvider(ttsProvider));

  // Update providers when they change
  useEffect(() => {
    sttRef.current = getSTTProvider(sttProvider);
  }, [sttProvider]);

  useEffect(() => {
    const tts = getTTSProvider(ttsProvider);
    // Pass botId to ElevenLabs so server can look up per-bot API keys
    if ('setBotId' in tts && botId) {
      (tts as import('@/lib/speech/elevenlabs-tts').ElevenLabsTTS).setBotId(botId);
    }
    ttsRef.current = tts;
  }, [ttsProvider, botId]);

  const startListening = useCallback(() => {
    setError(null);
    setTranscript('');

    try {
      sttRef.current.startListening(
        (result) => {
          setTranscript(result.text);
          // Final result (high confidence or end of speech)
          if (result.confidence === undefined || result.confidence > 0.5) {
            onTranscript(result.text);
          }
        },
        (err) => {
          setError(err.message);
          setIsListening(false);
          onStateChange?.('idle');
        }
      );
      setIsListening(true);
      onStateChange?.('listening');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start listening');
    }
  }, [onTranscript, onStateChange]);

  const stopListening = useCallback(() => {
    sttRef.current.stopListening();
    setIsListening(false);
  }, []);

  const speak = useCallback(
    async (text: string) => {
      setIsSpeaking(true);
      onStateChange?.('speaking');
      try {
        await ttsRef.current.speak({ text, language: 'it-IT' });
      } catch (err) {
        console.warn('TTS error:', err);
      } finally {
        setIsSpeaking(false);
        onStateChange?.('idle');
      }
    },
    [onStateChange]
  );

  const stopSpeaking = useCallback(() => {
    ttsRef.current.stop();
    setIsSpeaking(false);
  }, []);

  return {
    isListening,
    isSpeaking,
    transcript,
    error,
    startListening,
    stopListening,
    speak,
    stopSpeaking,
  };
}

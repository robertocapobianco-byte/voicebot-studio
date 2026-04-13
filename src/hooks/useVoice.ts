'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { getSTTProvider, getTTSProvider } from '@/lib/speech';
import type { STTProviderID, TTSProviderID, VoiceChatState } from '@/types';

interface UseVoiceOptions {
  sttProvider: STTProviderID;
  ttsProvider: TTSProviderID;
  onTranscript: (text: string) => void;
  onStateChange?: (state: VoiceChatState) => void;
}

export function useVoice({ sttProvider, ttsProvider, onTranscript, onStateChange }: UseVoiceOptions) {
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
    ttsRef.current = getTTSProvider(ttsProvider);
  }, [ttsProvider]);

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

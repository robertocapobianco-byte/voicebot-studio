import type { SpeechToTextProvider, STTResult } from '@/types';

/**
 * Browser-native Speech-to-Text using Web Speech API.
 * Zero cost, works offline in most browsers, no API key needed.
 * Falls back gracefully if unsupported.
 */
export class WebSpeechSTT implements SpeechToTextProvider {
  id = 'web-speech' as const;
  name = 'Browser Speech Recognition';

  private recognition: SpeechRecognition | null = null;
  private listening = false;

  private getRecognition(): SpeechRecognition {
    if (typeof window === 'undefined') {
      throw new Error('Web Speech API is only available in the browser');
    }

    const SpeechRecognition =
      window.SpeechRecognition || (window as unknown as { webkitSpeechRecognition: typeof window.SpeechRecognition }).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      throw new Error('Speech Recognition is not supported in this browser');
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = 'it-IT'; // Default Italian, configurable
    recognition.maxAlternatives = 1;
    return recognition;
  }

  startListening(onResult: (result: STTResult) => void, onError?: (err: Error) => void): void {
    try {
      this.recognition = this.getRecognition();
    } catch (err) {
      onError?.(err as Error);
      return;
    }

    this.recognition.onresult = (event: SpeechRecognitionEvent) => {
      const last = event.results[event.results.length - 1];
      if (last) {
        onResult({
          text: last[0].transcript,
          confidence: last[0].confidence,
          language: this.recognition?.lang,
        });
      }
    };

    this.recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      this.listening = false;
      if (event.error !== 'aborted') {
        onError?.(new Error(`Speech recognition error: ${event.error}`));
      }
    };

    this.recognition.onend = () => {
      this.listening = false;
    };

    this.listening = true;
    this.recognition.start();
  }

  stopListening(): void {
    if (this.recognition) {
      this.recognition.stop();
      this.listening = false;
    }
  }

  isListening(): boolean {
    return this.listening;
  }
}

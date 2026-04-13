import type { TextToSpeechProvider, TTSOptions } from '@/types';

/**
 * Browser-native Text-to-Speech using Web Speech Synthesis API.
 * Zero cost, works across all modern browsers.
 */
export class WebSpeechTTS implements TextToSpeechProvider {
  id = 'web-speech' as const;
  name = 'Browser Speech Synthesis';

  private speaking = false;

  async speak(options: TTSOptions): Promise<void> {
    if (typeof window === 'undefined') {
      throw new Error('Web Speech Synthesis is only available in the browser');
    }

    if (!window.speechSynthesis) {
      throw new Error('Speech Synthesis is not supported in this browser');
    }

    // Cancel any ongoing speech
    window.speechSynthesis.cancel();

    return new Promise((resolve, reject) => {
      const utterance = new SpeechSynthesisUtterance(options.text);
      utterance.lang = options.language ?? 'it-IT';
      utterance.rate = options.speed ?? 1.0;

      // Try to select a voice matching the language
      const voices = window.speechSynthesis.getVoices();
      const langVoice = voices.find((v) => v.lang.startsWith(utterance.lang.split('-')[0]));
      if (langVoice) utterance.voice = langVoice;

      utterance.onstart = () => {
        this.speaking = true;
      };

      utterance.onend = () => {
        this.speaking = false;
        resolve();
      };

      utterance.onerror = (event) => {
        this.speaking = false;
        if (event.error !== 'canceled') {
          reject(new Error(`Speech synthesis error: ${event.error}`));
        } else {
          resolve();
        }
      };

      window.speechSynthesis.speak(utterance);
    });
  }

  stop(): void {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
      this.speaking = false;
    }
  }

  isSpeaking(): boolean {
    return this.speaking;
  }
}

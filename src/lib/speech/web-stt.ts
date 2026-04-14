import type { SpeechToTextProvider, STTResult } from '@/types';

// Web Speech API type declarations
interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
}
interface SpeechRecognitionErrorEvent extends Event {
  error: string;
}
interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}
interface SpeechRecognitionResult {
  [index: number]: SpeechRecognitionAlternative;
  isFinal: boolean;
  length: number;
}
interface SpeechRecognitionResultList {
  [index: number]: SpeechRecognitionResult;
  length: number;
}
interface SpeechRecognitionInstance extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}
declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognitionInstance;
    webkitSpeechRecognition: new () => SpeechRecognitionInstance;
  }
}

export class WebSpeechSTT implements SpeechToTextProvider {
  id = 'web-speech' as const;
  name = 'Browser Speech Recognition';
  private recognition: SpeechRecognitionInstance | null = null;
  private listening = false;

  private getRecognition(): SpeechRecognitionInstance {
    if (typeof window === 'undefined') {
      throw new Error('Web Speech API is only available in the browser');
    }
    const Ctor = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Ctor) throw new Error('Speech Recognition is not supported in this browser');
    const recognition = new Ctor();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = 'it-IT';
    recognition.maxAlternatives = 1;
    return recognition;
  }

  startListening(onResult: (result: STTResult) => void, onError?: (err: Error) => void): void {
    try { this.recognition = this.getRecognition(); } catch (err) { onError?.(err as Error); return; }
    this.recognition.onresult = (event: SpeechRecognitionEvent) => {
      const last = event.results[event.results.length - 1];
      if (last) { onResult({ text: last[0].transcript, confidence: last[0].confidence, language: this.recognition?.lang }); }
    };
    this.recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      this.listening = false;
      if (event.error !== 'aborted') onError?.(new Error('Speech recognition error: ' + event.error));
    };
    this.recognition.onend = () => { this.listening = false; };
    this.listening = true;
    this.recognition.start();
  }

  stopListening(): void { if (this.recognition) { this.recognition.stop(); this.listening = false; } }
  isListening(): boolean { return this.listening; }
}

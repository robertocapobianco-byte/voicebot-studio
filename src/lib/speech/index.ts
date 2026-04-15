import type { SpeechToTextProvider, TextToSpeechProvider, STTProviderID, TTSProviderID } from '@/types';
import { WebSpeechSTT } from './web-stt';
import { WebSpeechTTS } from './web-tts';
import { ElevenLabsTTS } from './elevenlabs-tts';

/** Get an STT provider by ID */
export function getSTTProvider(id: STTProviderID): SpeechToTextProvider {
  switch (id) {
    case 'web-speech':
      return new WebSpeechSTT();
    case 'whisper':
      // Whisper adapter can be added here — would call /api/stt
      throw new Error('Whisper STT not yet implemented. Use web-speech for now.');
    default:
      return new WebSpeechSTT();
  }
}

/** Get a TTS provider by ID */
export function getTTSProvider(id: TTSProviderID): TextToSpeechProvider {
  switch (id) {
    case 'web-speech':
      return new WebSpeechTTS();
    case 'elevenlabs':
      return new ElevenLabsTTS();
    default:
      return new WebSpeechTTS();
  }
}

export { WebSpeechSTT } from './web-stt';
export { WebSpeechTTS } from './web-tts';
export { ElevenLabsTTS } from './elevenlabs-tts';

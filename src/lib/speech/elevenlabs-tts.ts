import type { TextToSpeechProvider, TTSOptions } from '@/types';

/**
 * ElevenLabs Text-to-Speech adapter.
 * Calls the server-side /api/tts endpoint which proxies to ElevenLabs API.
 * Audio is returned as mp3 and played via the Web Audio API.
 */
export class ElevenLabsTTS implements TextToSpeechProvider {
  id = 'elevenlabs' as const;
  name = 'ElevenLabs';

  private audio: HTMLAudioElement | null = null;
  private speaking = false;

  async speak(options: TTSOptions): Promise<void> {
    if (typeof window === 'undefined') {
      throw new Error('ElevenLabs TTS requires a browser environment');
    }

    // Stop any ongoing playback
    this.stop();

    const response = await fetch('/api/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: options.text,
        provider: 'elevenlabs',
        voice: options.voice,
        language: options.language,
      }),
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => 'TTS request failed');
      let errorMsg = `TTS error ${response.status}`;
      try {
        const errJson = JSON.parse(errText);
        errorMsg = errJson.error || errorMsg;
      } catch {
        errorMsg = errText || errorMsg;
      }
      console.error('ElevenLabs TTS error:', errorMsg);
      throw new Error(errorMsg);
    }

    // Make sure we got audio back, not a JSON error/fallback
    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const data = await response.json();
      if (data.useClientTTS) {
        throw new Error('Server returned fallback — ElevenLabs not configured on server');
      }
      throw new Error(data.error || 'Unexpected JSON response from TTS API');
    }

    // Convert the audio stream to a blob and play it
    const audioBlob = await response.blob();
    const audioUrl = URL.createObjectURL(audioBlob);

    return new Promise<void>((resolve, reject) => {
      this.audio = new Audio(audioUrl);
      this.audio.playbackRate = options.speed ?? 1.0;

      this.audio.onplay = () => {
        this.speaking = true;
      };

      this.audio.onended = () => {
        this.speaking = false;
        URL.revokeObjectURL(audioUrl);
        this.audio = null;
        resolve();
      };

      this.audio.onerror = (event) => {
        this.speaking = false;
        URL.revokeObjectURL(audioUrl);
        this.audio = null;
        reject(new Error('Audio playback failed'));
      };

      this.audio.play().catch((err) => {
        this.speaking = false;
        URL.revokeObjectURL(audioUrl);
        this.audio = null;
        reject(err);
      });
    });
  }

  stop(): void {
    if (this.audio) {
      this.audio.pause();
      this.audio.currentTime = 0;
      this.audio = null;
    }
    this.speaking = false;
  }

  isSpeaking(): boolean {
    return this.speaking;
  }
}

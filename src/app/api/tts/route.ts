import { NextRequest, NextResponse } from 'next/server';

/**
 * Server-side TTS endpoint.
 * Currently a placeholder for ElevenLabs / other premium TTS APIs.
 * The default implementation uses Web Speech API on the client side.
 */
export async function POST(request: NextRequest) {
  try {
    const { text, provider } = await request.json();

    if (!text) {
      return NextResponse.json({ error: 'text is required' }, { status: 400 });
    }

    if (provider === 'elevenlabs') {
      const apiKey = process.env.ELEVENLABS_API_KEY;
      const voiceId = process.env.ELEVENLABS_VOICE_ID ?? 'pNInz6obpgDQGcFmaJgB'; // Default Adam

      if (!apiKey) {
        return NextResponse.json({ error: 'ELEVENLABS_API_KEY is not configured' }, { status: 500 });
      }

      const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
        method: 'POST',
        headers: {
          'xi-api-key': apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text,
          model_id: 'eleven_multilingual_v2',
          voice_settings: { stability: 0.5, similarity_boost: 0.75 },
        }),
      });

      if (!response.ok) {
        const errorBody = await response.text().catch(() => 'no body');
        console.error(`ElevenLabs API error: status=${response.status}, body=${errorBody}`);
        return NextResponse.json(
          { error: `ElevenLabs error ${response.status}: ${errorBody}` },
          { status: 502 }
        );
      }

      const audioBuffer = await response.arrayBuffer();
      return new NextResponse(audioBuffer, {
        headers: {
          'Content-Type': 'audio/mpeg',
          'Content-Length': audioBuffer.byteLength.toString(),
        },
      });
    }

    // Default: return instruction to use client-side Web Speech API
    return NextResponse.json({ useClientTTS: true });
  } catch (err) {
    console.error('TTS API error:', err);
    return NextResponse.json({ error: 'TTS generation failed' }, { status: 500 });
  }
}

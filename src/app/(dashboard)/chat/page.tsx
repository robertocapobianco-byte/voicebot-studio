'use client';

import { VoiceChat } from '@/components/chat/voice-chat';
import { useBotConfig } from '@/hooks';

export default function ChatPage() {
  const { config } = useBotConfig();

  return (
    <div className="-my-8 -mx-6">
      <div className="px-6 pt-6 pb-3 border-b border-surface-200 bg-white">
        <h2 className="text-xl font-bold text-surface-900">{config.name}</h2>
        <p className="text-sm text-surface-500">
          {config.llmProvider.toUpperCase()} / {config.llmModel} — Tono: {config.personality.tone}
        </p>
      </div>

      <div className="px-6">
        <VoiceChat botConfig={config} />
      </div>
    </div>
  );
}

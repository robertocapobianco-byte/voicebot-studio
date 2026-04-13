'use client';

import { KnowledgeBaseManager } from '@/components/knowledge/kb-manager';
import { useBotConfig } from '@/hooks';

export default function KnowledgePage() {
  const { config } = useBotConfig();

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-surface-900">Knowledge Base</h2>
        <p className="text-surface-500 mt-1">
          Carica documenti PDF e DOCX per arricchire le conoscenze del chatbot.
        </p>
      </div>

      <KnowledgeBaseManager botId={config.id} />
    </div>
  );
}

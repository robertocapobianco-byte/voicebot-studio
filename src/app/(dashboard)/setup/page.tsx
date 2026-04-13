'use client';

import { BotSetupForm } from '@/components/config/bot-setup-form';
import { useBotConfig } from '@/hooks';
import { useToast } from '@/components/ui/toast-provider';

export default function SetupPage() {
  const { config, updateConfig, updatePersonality, saveToServer, resetConfig, isSaving, lastSaved } =
    useBotConfig();
  const { notify } = useToast();

  const handleSave = async () => {
    await saveToServer();
    notify({ type: 'success', title: 'Configurazione salvata' });
  };

  const handleReset = () => {
    resetConfig();
    notify({ type: 'info', title: 'Configurazione resettata' });
  };

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-surface-900">Setup Chatbot</h2>
        <p className="text-surface-500 mt-1">
          Configura il tuo chatbot AI: personalità, modello e comportamento.
        </p>
      </div>

      <BotSetupForm
        config={config}
        onUpdate={updateConfig}
        onUpdatePersonality={updatePersonality}
        onSave={handleSave}
        onReset={handleReset}
        isSaving={isSaving}
        lastSaved={lastSaved}
      />
    </div>
  );
}

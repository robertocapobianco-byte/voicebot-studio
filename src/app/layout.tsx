import type { Metadata } from 'next';
import './globals.css';
import { ToastProvider } from '@/components/ui/toast-provider';
import { Sidebar } from '@/components/layout/sidebar';

export const metadata: Metadata = {
  title: 'VoiceBot Studio — AI Voice Chatbot Builder',
  description: 'Configura e parla con il tuo chatbot AI vocale personalizzato',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="it" className="h-full">
      <body className="h-full bg-surface-50 text-surface-900">
        <ToastProvider>
          <div className="flex h-full">
            <Sidebar />
            <main className="flex-1 ml-64 min-h-screen">
              <div className="max-w-4xl mx-auto px-6 py-8">{children}</div>
            </main>
          </div>
        </ToastProvider>
      </body>
    </html>
  );
}

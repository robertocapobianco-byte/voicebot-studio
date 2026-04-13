'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  Bot,
  MessageSquare,
  FileText,
  Settings,
  Mic,
  Zap,
} from 'lucide-react';

const navItems = [
  { href: '/setup', label: 'Setup Bot', icon: Bot, description: 'Configura il chatbot' },
  { href: '/knowledge', label: 'Knowledge Base', icon: FileText, description: 'Documenti e RAG' },
  { href: '/chat', label: 'Voice Chat', icon: Mic, description: 'Parla con il bot' },
  { href: '/settings', label: 'Impostazioni', icon: Settings, description: 'API e preferenze' },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 h-screen bg-surface-950 text-white flex flex-col fixed left-0 top-0 z-40">
      {/* Logo */}
      <div className="px-6 py-5 border-b border-white/10">
        <Link href="/" className="flex items-center gap-3 group">
          <div className="w-9 h-9 rounded-xl bg-brand-500 flex items-center justify-center shadow-lg shadow-brand-500/30 group-hover:shadow-brand-500/50 transition-shadow">
            <Zap className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="font-bold text-base tracking-tight">VoiceBot</h1>
            <p className="text-[10px] text-surface-400 uppercase tracking-widest">Studio</p>
          </div>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map((item) => {
          const isActive = pathname === item.href || pathname?.startsWith(item.href + '/');
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all duration-150',
                isActive
                  ? 'bg-white/10 text-white'
                  : 'text-surface-400 hover:text-white hover:bg-white/5'
              )}
            >
              <Icon className={cn('w-5 h-5', isActive && 'text-brand-400')} />
              <span className="font-medium">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-4 py-4 border-t border-white/10">
        <div className="flex items-center gap-2 text-surface-500 text-xs">
          <MessageSquare className="w-3.5 h-3.5" />
          <span>v0.1.0 — AI Voice Chatbot</span>
        </div>
      </div>
    </aside>
  );
}

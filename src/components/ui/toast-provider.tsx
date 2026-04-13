'use client';

import React, { createContext, useContext, useState, useCallback } from 'react';
import * as Toast from '@radix-ui/react-toast';
import { cn } from '@/lib/utils';
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from 'lucide-react';
import type { AppNotification } from '@/types';

interface ToastContextType {
  notify: (notification: Omit<AppNotification, 'id'>) => void;
}

const ToastContext = createContext<ToastContextType>({ notify: () => {} });

export function useToast() {
  return useContext(ToastContext);
}

const icons = {
  success: CheckCircle,
  error: AlertCircle,
  info: Info,
  warning: AlertTriangle,
};

const colors = {
  success: 'bg-emerald-50 border-emerald-200 text-emerald-900',
  error: 'bg-rose-50 border-rose-200 text-rose-900',
  info: 'bg-brand-50 border-brand-200 text-brand-900',
  warning: 'bg-amber-50 border-amber-200 text-amber-900',
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<AppNotification[]>([]);

  const notify = useCallback((notification: Omit<AppNotification, 'id'>) => {
    const id = crypto.randomUUID();
    setToasts((prev) => [...prev, { ...notification, id }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, notification.duration ?? 4000);
  }, []);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ notify }}>
      <Toast.Provider swipeDirection="right" duration={4000}>
        {children}
        {toasts.map((toast) => {
          const Icon = icons[toast.type];
          return (
            <Toast.Root
              key={toast.id}
              className={cn(
                'border rounded-xl px-4 py-3 shadow-lg animate-slide-in-right',
                'flex items-start gap-3',
                colors[toast.type]
              )}
            >
              <Icon className="w-5 h-5 mt-0.5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <Toast.Title className="font-semibold text-sm">{toast.title}</Toast.Title>
                {toast.message && (
                  <Toast.Description className="text-sm opacity-80 mt-0.5">
                    {toast.message}
                  </Toast.Description>
                )}
              </div>
              <Toast.Close
                className="opacity-50 hover:opacity-100 transition-opacity"
                onClick={() => dismiss(toast.id)}
              >
                <X className="w-4 h-4" />
              </Toast.Close>
            </Toast.Root>
          );
        })}
        <Toast.Viewport className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 w-96 max-w-[calc(100vw-2rem)]" />
      </Toast.Provider>
    </ToastContext.Provider>
  );
}

'use client';

import React from 'react';
import { cn } from '@/lib/utils';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export function Input({ label, error, className, id, ...props }: InputProps) {
  const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-');
  return (
    <div className="space-y-1.5">
      {label && (
        <label htmlFor={inputId} className="block text-sm font-medium text-surface-700">
          {label}
        </label>
      )}
      <input
        id={inputId}
        className={cn(
          'w-full px-3.5 py-2.5 rounded-xl border border-surface-200 bg-white',
          'text-sm text-surface-900 placeholder:text-surface-400',
          'transition-all duration-150',
          'focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500',
          error && 'border-rose-300 focus:ring-rose-500',
          className
        )}
        {...props}
      />
      {error && <p className="text-xs text-rose-600">{error}</p>}
    </div>
  );
}

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

export function Textarea({ label, error, className, id, ...props }: TextareaProps) {
  const textareaId = id ?? label?.toLowerCase().replace(/\s+/g, '-');
  return (
    <div className="space-y-1.5">
      {label && (
        <label htmlFor={textareaId} className="block text-sm font-medium text-surface-700">
          {label}
        </label>
      )}
      <textarea
        id={textareaId}
        className={cn(
          'w-full px-3.5 py-2.5 rounded-xl border border-surface-200 bg-white',
          'text-sm text-surface-900 placeholder:text-surface-400',
          'transition-all duration-150 resize-y min-h-[100px]',
          'focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500',
          error && 'border-rose-300 focus:ring-rose-500',
          className
        )}
        {...props}
      />
      {error && <p className="text-xs text-rose-600">{error}</p>}
    </div>
  );
}

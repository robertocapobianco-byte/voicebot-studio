import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Merge Tailwind classes safely (clsx + tailwind-merge) */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Format bytes to human-readable string */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

/** Format date to locale string */
export function formatDate(date: string | Date): string {
  return new Intl.DateTimeFormat('it-IT', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(date));
}

/** Generate a simple UUID v4 */
export function generateId(): string {
  return crypto.randomUUID();
}

/** Validate that required environment variables are set */
export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

/** Truncate text with ellipsis */
export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 1) + '…';
}

/** Build the system prompt from bot config */
export function buildSystemPrompt(config: {
  systemPrompt: string;
  personality: { tone: string; responseStyle: string; detailLevel: string; language: string; customToneDescription?: string };
}): string {
  const { systemPrompt, personality } = config;
  const toneLine =
    personality.tone === 'custom' && personality.customToneDescription
      ? personality.customToneDescription
      : personality.tone;

  return [
    systemPrompt,
    '',
    '--- Personality Guidelines ---',
    `Tone: ${toneLine}`,
    `Response style: ${personality.responseStyle}`,
    `Detail level: ${personality.detailLevel}`,
    `Language: ${personality.language}`,
  ].join('\n');
}

// ============================================
// VoiceBot Studio — Core Type Definitions
// ============================================

/** Supported LLM provider identifiers */
export type LLMProviderID = 'openai' | 'anthropic' | 'google';

/** Supported STT provider identifiers */
export type STTProviderID = 'web-speech' | 'whisper';

/** Supported TTS provider identifiers */
export type TTSProviderID = 'web-speech' | 'elevenlabs';

/** Bot personality tone presets */
export type TonePreset =
  | 'professional'
  | 'friendly'
  | 'empathetic'
  | 'technical'
  | 'creative'
  | 'concise'
  | 'custom';

/** Detail level for responses */
export type DetailLevel = 'minimal' | 'balanced' | 'detailed' | 'exhaustive';

// --- Chatbot Configuration ---

export interface BotPersonality {
  tone: TonePreset;
  customToneDescription?: string;
  responseStyle: string;
  detailLevel: DetailLevel;
  language: string;
}

export interface BotConfig {
  id: string;
  name: string;
  systemPrompt: string;
  personality: BotPersonality;
  llmProvider: LLMProviderID;
  llmModel: string;
  sttProvider: STTProviderID;
  ttsProvider: TTSProviderID;
  temperature: number;
  maxTokens: number;
  createdAt: string;
  updatedAt: string;
}

// --- LLM Adapter Interface ---

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LLMCompletionOptions {
  model: string;
  messages: LLMMessage[];
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
}

export interface LLMCompletionResult {
  content: string;
  model: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export interface LLMProvider {
  id: LLMProviderID;
  name: string;
  models: LLMModelInfo[];
  complete(options: LLMCompletionOptions): Promise<LLMCompletionResult>;
  completeStream?(options: LLMCompletionOptions): AsyncIterable<string>;
}

export interface LLMModelInfo {
  id: string;
  name: string;
  contextWindow: number;
  description?: string;
}

// --- Speech Interfaces ---

export interface STTResult {
  text: string;
  confidence?: number;
  language?: string;
}

export interface SpeechToTextProvider {
  id: STTProviderID;
  name: string;
  startListening(onResult: (result: STTResult) => void, onError?: (err: Error) => void): void;
  stopListening(): void;
  isListening(): boolean;
}

export interface TTSOptions {
  text: string;
  voice?: string;
  speed?: number;
  language?: string;
}

export interface TextToSpeechProvider {
  id: TTSProviderID;
  name: string;
  speak(options: TTSOptions): Promise<void>;
  stop(): void;
  isSpeaking(): boolean;
}

// --- Document / Knowledge Base ---

export type DocumentStatus = 'uploading' | 'processing' | 'indexed' | 'error';

export interface KBDocument {
  id: string;
  botId: string;
  fileName: string;
  fileType: 'pdf' | 'docx' | 'doc';
  fileSize: number;
  status: DocumentStatus;
  chunkCount?: number;
  errorMessage?: string;
  storagePath: string;
  createdAt: string;
  updatedAt: string;
}

export interface DocumentChunk {
  id: string;
  documentId: string;
  botId: string;
  content: string;
  metadata: Record<string, unknown>;
  embedding?: number[];
  chunkIndex: number;
}

export interface DocumentProcessor {
  supportedTypes: string[];
  extractText(buffer: Buffer, fileType: string): Promise<string>;
}

// --- RAG / Retrieval ---

export interface RetrievalResult {
  content: string;
  score: number;
  documentId: string;
  metadata: Record<string, unknown>;
}

export interface Retriever {
  search(query: string, botId: string, topK?: number): Promise<RetrievalResult[]>;
  index(chunks: DocumentChunk[]): Promise<void>;
  removeByDocumentId(documentId: string): Promise<void>;
}

// --- Chat / Conversation ---

export type MessageRole = 'user' | 'assistant' | 'system';

export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: string;
  sources?: RetrievalResult[];
  audioUrl?: string;
}

export interface Conversation {
  id: string;
  botId: string;
  messages: ChatMessage[];
  createdAt: string;
}

// --- API Request/Response Types ---

export interface ChatRequest {
  botId: string;
  message: string;
  conversationHistory: LLMMessage[];
}

export interface ChatResponse {
  reply: string;
  sources?: RetrievalResult[];
  usage?: LLMCompletionResult['usage'];
}

export interface UploadResponse {
  document: KBDocument;
  message: string;
}

// --- UI State ---

export type VoiceChatState =
  | 'idle'
  | 'listening'
  | 'processing'
  | 'generating'
  | 'speaking';

export interface AppNotification {
  id: string;
  type: 'success' | 'error' | 'info' | 'warning';
  title: string;
  message?: string;
  duration?: number;
}

import { createServerClient } from './supabase';
import type { BotConfig, KBDocument, DocumentChunk } from '@/types';

// ============================================
// Bot Configuration CRUD
// ============================================

export async function getBotConfigs(): Promise<BotConfig[]> {
  const db = createServerClient();
  const { data, error } = await db
    .from('bot_configs')
    .select('*')
    .order('updated_at', { ascending: false });

  if (error) throw new Error(`Failed to fetch bot configs: ${error.message}`);
  return (data ?? []).map(mapBotRow);
}

export async function getBotConfig(id: string): Promise<BotConfig | null> {
  const db = createServerClient();
  const { data, error } = await db
    .from('bot_configs')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null; // Not found
    throw new Error(`Failed to fetch bot config: ${error.message}`);
  }
  return data ? mapBotRow(data) : null;
}

export async function upsertBotConfig(config: Partial<BotConfig> & { id: string }): Promise<BotConfig> {
  const db = createServerClient();
  const row = {
    id: config.id,
    name: config.name,
    system_prompt: config.systemPrompt,
    personality: config.personality,
    llm_provider: config.llmProvider,
    llm_model: config.llmModel,
    stt_provider: config.sttProvider,
    tts_provider: config.ttsProvider,
    temperature: config.temperature,
    max_tokens: config.maxTokens,
    api_keys: config.apiKeys ?? null,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await db
    .from('bot_configs')
    .upsert(row, { onConflict: 'id' })
    .select()
    .single();

  if (error) throw new Error(`Failed to save bot config: ${error.message}`);
  return mapBotRow(data);
}

export async function deleteBotConfig(id: string): Promise<void> {
  const db = createServerClient();
  const { error } = await db.from('bot_configs').delete().eq('id', id);
  if (error) throw new Error(`Failed to delete bot config: ${error.message}`);
}

// ============================================
// Knowledge Base Documents
// ============================================

export async function getDocuments(botId: string): Promise<KBDocument[]> {
  const db = createServerClient();
  const { data, error } = await db
    .from('kb_documents')
    .select('*')
    .eq('bot_id', botId)
    .order('created_at', { ascending: false });

  if (error) throw new Error(`Failed to fetch documents: ${error.message}`);
  return (data ?? []).map(mapDocRow);
}

export async function insertDocument(doc: Omit<KBDocument, 'createdAt' | 'updatedAt'>): Promise<KBDocument> {
  const db = createServerClient();
  const { data, error } = await db
    .from('kb_documents')
    .insert({
      id: doc.id,
      bot_id: doc.botId,
      file_name: doc.fileName,
      file_type: doc.fileType,
      file_size: doc.fileSize,
      status: doc.status,
      storage_path: doc.storagePath,
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to insert document: ${error.message}`);
  return mapDocRow(data);
}

export async function updateDocumentStatus(
  id: string,
  status: KBDocument['status'],
  extra?: { chunkCount?: number; errorMessage?: string }
): Promise<void> {
  const db = createServerClient();
  const { error } = await db
    .from('kb_documents')
    .update({
      status,
      chunk_count: extra?.chunkCount,
      error_message: extra?.errorMessage,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id);

  if (error) throw new Error(`Failed to update document status: ${error.message}`);
}

export async function deleteDocument(id: string): Promise<void> {
  const db = createServerClient();
  // Chunks are cascade-deleted via FK
  const { error } = await db.from('kb_documents').delete().eq('id', id);
  if (error) throw new Error(`Failed to delete document: ${error.message}`);
}

// ============================================
// Document Chunks (for RAG)
// ============================================

export async function insertChunks(chunks: DocumentChunk[]): Promise<void> {
  const db = createServerClient();
  const rows = chunks.map((c) => ({
    id: c.id,
    document_id: c.documentId,
    bot_id: c.botId,
    content: c.content,
    metadata: c.metadata,
    embedding: c.embedding,
    chunk_index: c.chunkIndex,
  }));

  const { error } = await db.from('document_chunks').insert(rows);
  if (error) throw new Error(`Failed to insert chunks: ${error.message}`);
}

export async function searchChunks(
  queryEmbedding: number[],
  botId: string,
  topK: number = 5,
  threshold: number = 0.7
) {
  const db = createServerClient();
  const { data, error } = await db.rpc('match_chunks', {
    query_embedding: queryEmbedding,
    match_bot_id: botId,
    match_count: topK,
    match_threshold: threshold,
  });

  if (error) throw new Error(`Vector search failed: ${error.message}`);
  return data ?? [];
}

// ============================================
// Row Mappers (snake_case DB → camelCase TS)
// ============================================

function mapBotRow(row: Record<string, unknown>): BotConfig {
  return {
    id: row.id as string,
    name: row.name as string,
    systemPrompt: row.system_prompt as string,
    personality: row.personality as BotConfig['personality'],
    llmProvider: row.llm_provider as BotConfig['llmProvider'],
    llmModel: row.llm_model as string,
    sttProvider: (row.stt_provider as BotConfig['sttProvider']) ?? 'web-speech',
    ttsProvider: (row.tts_provider as BotConfig['ttsProvider']) ?? 'web-speech',
    temperature: (row.temperature as number) ?? 0.7,
    maxTokens: (row.max_tokens as number) ?? 2048,
    apiKeys: (row.api_keys as BotConfig['apiKeys']) ?? undefined,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

function mapDocRow(row: Record<string, unknown>): KBDocument {
  return {
    id: row.id as string,
    botId: row.bot_id as string,
    fileName: row.file_name as string,
    fileType: row.file_type as KBDocument['fileType'],
    fileSize: row.file_size as number,
    status: row.status as KBDocument['status'],
    chunkCount: row.chunk_count as number | undefined,
    errorMessage: row.error_message as string | undefined,
    storagePath: row.storage_path as string,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

import OpenAI from 'openai';
import { searchChunks, insertChunks } from '@/lib/db';
import type { Retriever, RetrievalResult, DocumentChunk } from '@/types';

/**
 * Generates embeddings using OpenAI's text-embedding-3-small model.
 * This is the shared embedding function used for both indexing and querying.
 * Accepts an optional apiKey override; falls back to OPENAI_API_KEY env var.
 */
export async function generateEmbedding(text: string, apiKeyOverride?: string): Promise<number[]> {
  const apiKey = apiKeyOverride || process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY is required for embeddings. Add it in Settings or as an environment variable.');

  const client = new OpenAI({ apiKey });
  const model = process.env.EMBEDDING_MODEL ?? 'text-embedding-3-small';

  const response = await client.embeddings.create({
    model,
    input: text.replace(/\n/g, ' ').trim(),
  });

  return response.data[0].embedding;
}

/**
 * Batch generate embeddings for multiple texts.
 * Uses OpenAI's batch embedding endpoint for efficiency.
 * Accepts an optional apiKey override; falls back to OPENAI_API_KEY env var.
 */
export async function generateEmbeddings(texts: string[], apiKeyOverride?: string): Promise<number[][]> {
  const apiKey = apiKeyOverride || process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY is required for embeddings. Add it in Settings or as an environment variable.');

  const client = new OpenAI({ apiKey });
  const model = process.env.EMBEDDING_MODEL ?? 'text-embedding-3-small';

  // Process in batches of 100 (OpenAI limit)
  const batchSize = 100;
  const allEmbeddings: number[][] = [];

  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize).map((t) => t.replace(/\n/g, ' ').trim());
    const response = await client.embeddings.create({ model, input: batch });
    allEmbeddings.push(...response.data.map((d) => d.embedding));
  }

  return allEmbeddings;
}

/**
 * Default retriever implementation using Supabase pgvector.
 */
export class SupabaseRetriever implements Retriever {
  async search(query: string, botId: string, topK = 5): Promise<RetrievalResult[]> {
    const queryEmbedding = await generateEmbedding(query);
    const results = await searchChunks(queryEmbedding, botId, topK);

    return results.map((r: Record<string, unknown>) => ({
      content: r.content as string,
      score: r.similarity as number,
      documentId: r.document_id as string,
      metadata: (r.metadata as Record<string, unknown>) ?? {},
    }));
  }

  async index(chunks: DocumentChunk[]): Promise<void> {
    // Generate embeddings for all chunks
    const texts = chunks.map((c) => c.content);
    const embeddings = await generateEmbeddings(texts);

    // Attach embeddings to chunks and insert
    const enrichedChunks = chunks.map((chunk, i) => ({
      ...chunk,
      embedding: embeddings[i],
    }));

    await insertChunks(enrichedChunks);
  }

  async removeByDocumentId(documentId: string): Promise<void> {
    // Handled by cascade delete from kb_documents
    const { createServerClient } = await import('@/lib/db/supabase');
    const db = createServerClient();
    await db.from('document_chunks').delete().eq('document_id', documentId);
  }
}

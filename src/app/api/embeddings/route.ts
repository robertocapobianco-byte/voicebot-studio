import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/db/supabase';
import { updateDocumentStatus } from '@/lib/db';
import { generateEmbeddings } from '@/lib/rag';

const BATCH_SIZE = 10; // Process 10 chunks per call to stay within timeout

export async function POST(request: NextRequest) {
  try {
    const { documentId } = await request.json();
    if (!documentId) {
      return NextResponse.json({ error: 'documentId is required' }, { status: 400 });
    }

    const db = createServerClient();

    // Find chunks without embeddings for this document
    const { data: chunks, error: fetchError } = await db
      .from('document_chunks')
      .select('id, content')
      .eq('document_id', documentId)
      .is('embedding', null)
      .order('chunk_index', { ascending: true })
      .limit(BATCH_SIZE);

    if (fetchError) throw new Error('Failed to fetch chunks: ' + fetchError.message);

    if (!chunks || chunks.length === 0) {
      // All chunks have embeddings — mark as indexed
      const { count } = await db
        .from('document_chunks')
        .select('id', { count: 'exact', head: true })
        .eq('document_id', documentId);

      await updateDocumentStatus(documentId, 'indexed', { chunkCount: count || 0 });

      return NextResponse.json({
        done: true,
        processed: 0,
        remaining: 0,
        total: count || 0,
        message: 'All chunks indexed',
      });
    }

    // Generate embeddings for this batch
    const texts = chunks.map((c: { content: string }) => c.content);
    const embeddings = await generateEmbeddings(texts);

    // Update each chunk with its embedding
    for (let i = 0; i < chunks.length; i++) {
      const { error: updateError } = await db
        .from('document_chunks')
        .update({ embedding: embeddings[i] })
        .eq('id', chunks[i].id);

      if (updateError) {
        console.error('Failed to update chunk ' + chunks[i].id + ':', updateError);
      }
    }

    // Check how many remain
    const { count: remaining } = await db
      .from('document_chunks')
      .select('id', { count: 'exact', head: true })
      .eq('document_id', documentId)
      .is('embedding', null);

    const { count: total } = await db
      .from('document_chunks')
      .select('id', { count: 'exact', head: true })
      .eq('document_id', documentId);

    const isDone = (remaining || 0) === 0;

    if (isDone) {
      await updateDocumentStatus(documentId, 'indexed', { chunkCount: total || 0 });
    }

    return NextResponse.json({
      done: isDone,
      processed: chunks.length,
      remaining: remaining || 0,
      total: total || 0,
      message: isDone
        ? 'All chunks indexed'
        : 'Processed ' + chunks.length + ' chunks, ' + remaining + ' remaining',
    });
  } catch (err) {
    console.error('Embeddings API error:', err);
    const message = err instanceof Error ? err.message : 'Embedding generation failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

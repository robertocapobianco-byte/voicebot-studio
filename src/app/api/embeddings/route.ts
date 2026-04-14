import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/db/supabase';
import { updateDocumentStatus } from '@/lib/db';
import { generateEmbeddings } from '@/lib/rag';

const BATCH_SIZE = 10;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const documentId = body.documentId;
    if (!documentId) {
      return NextResponse.json({ error: 'documentId is required' }, { status: 400 });
    }

    const db = createServerClient();

    const { data: chunks, error: fetchError } = await db
      .from('document_chunks')
      .select('id, content')
      .eq('document_id', documentId)
      .is('embedding', null)
      .order('chunk_index', { ascending: true })
      .limit(BATCH_SIZE);

    if (fetchError) throw new Error('Failed to fetch chunks: ' + fetchError.message);

    if (!chunks || chunks.length === 0) {
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

    const texts = chunks.map((c: { id: string; content: string }) => c.content);
    const embeddings = await generateEmbeddings(texts);

    for (let i = 0; i < chunks.length; i++) {
      const embeddingStr = '[' + embeddings[i].join(',') + ']';
      const { error: updateError } = await db
        .from('document_chunks')
        .update({ embedding: embeddingStr })
        .eq('id', chunks[i].id);

      if (updateError) {
        console.error('Failed to update chunk embedding:', updateError.message);
      }
    }

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
    });
  } catch (err) {
    console.error('Embeddings API error:', err);
    const message = err instanceof Error ? err.message : 'Embedding generation failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

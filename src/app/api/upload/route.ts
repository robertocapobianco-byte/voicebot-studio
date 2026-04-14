import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/db/supabase';
import { insertDocument, updateDocumentStatus } from '@/lib/db';
import { generateId } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { botId, fileName, fileSize, fileType, chunks } = body;

    if (!botId || !fileName || !chunks || !Array.isArray(chunks) || chunks.length === 0) {
      return NextResponse.json(
        { error: 'botId, fileName, and chunks[] are required' },
        { status: 400 }
      );
    }

    // Limit: max 50 chunks per request to stay within memory
    if (chunks.length > 50) {
      return NextResponse.json(
        { error: 'Too many chunks. Send max 50 per request.' },
        { status: 400 }
      );
    }

    const docId = body.documentId || generateId();
    const isFirstBatch = !body.documentId;

    if (isFirstBatch) {
      const storagePath = 'kb/' + botId + '/' + docId + '/' + fileName;
      await insertDocument({
        id: docId,
        botId,
        fileName,
        fileType: fileType || 'txt',
        fileSize: fileSize || 0,
        status: 'processing',
        storagePath,
      });
    }

    const db = createServerClient();
    const chunkOffset = body.chunkOffset || 0;

    const chunkRows = chunks.map((content: string, index: number) => ({
      id: generateId(),
      document_id: docId,
      bot_id: botId,
      content,
      metadata: { fileName, chunkIndex: chunkOffset + index },
      chunk_index: chunkOffset + index,
    }));

    const { error: chunkError } = await db
      .from('document_chunks')
      .insert(chunkRows);

    if (chunkError) {
      throw new Error('Failed to save chunks: ' + chunkError.message);
    }

    return NextResponse.json({
      documentId: docId,
      savedChunks: chunks.length,
      chunkOffset: chunkOffset + chunks.length,
    });
  } catch (err) {
    console.error('Upload error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Upload failed' },
      { status: 500 }
    );
  }
}

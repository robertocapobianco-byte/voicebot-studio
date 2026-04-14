import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/db/supabase';
import { insertDocument, updateDocumentStatus } from '@/lib/db';
import { generateId } from '@/lib/utils';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

function chunkText(text: string): string[] {
  const cleaned = text.replace(/\s+/g, ' ').trim();
  if (cleaned.length <= 1000) return cleaned.length > 50 ? [cleaned] : [];
  const chunks: string[] = [];
  let start = 0;
  while (start < cleaned.length) {
    let end = Math.min(start + 1000, cleaned.length);
    if (end < cleaned.length) {
      const bp = Math.max(cleaned.lastIndexOf('. ', end), cleaned.lastIndexOf('\n', end));
      if (bp > start + 500) end = bp + 1;
    }
    const chunk = cleaned.slice(start, end).trim();
    if (chunk.length > 50) chunks.push(chunk);
    start = end - 200;
    if (start >= cleaned.length) break;
  }
  return chunks;
}

export async function POST(request: NextRequest) {
  try {
    const { botId, fileName, fileSize, fileType, text } = await request.json();

    if (!botId || !text || !fileName) {
      return NextResponse.json({ error: 'botId, fileName, and text are required' }, { status: 400 });
    }

    const docId = generateId();
    const storagePath = 'kb/' + botId + '/' + docId + '/' + fileName;

    const doc = await insertDocument({
      id: docId,
      botId,
      fileName,
      fileType: fileType || 'docx',
      fileSize: fileSize || text.length,
      status: 'processing',
      storagePath,
    });

    const chunks = chunkText(text);
    if (chunks.length === 0) {
      await updateDocumentStatus(docId, 'error', { errorMessage: 'No usable text found' });
      return NextResponse.json({ document: { ...doc, status: 'error' }, message: 'No text' });
    }

    const db = createServerClient();
    const chunkRows = chunks.map((content, index) => ({
      id: generateId(),
      document_id: docId,
      bot_id: botId,
      content,
      metadata: { fileName, chunkIndex: index },
      chunk_index: index,
    }));

    for (let i = 0; i < chunkRows.length; i += 50) {
      const { error: chunkError } = await db.from('document_chunks').insert(chunkRows.slice(i, i + 50));
      if (chunkError) throw new Error('Failed to save chunks: ' + chunkError.message);
    }

    await updateDocumentStatus(docId, 'processing', { chunkCount: chunks.length });

    return NextResponse.json({
      document: { ...doc, status: 'processing', chunkCount: chunks.length },
      needsEmbeddings: true,
    });
  } catch (err) {
    console.error('Upload error:', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Upload failed' }, { status: 500 });
  }
}

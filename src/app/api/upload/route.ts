import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/db/supabase';
import { insertDocument, updateDocumentStatus } from '@/lib/db';
import { generateId } from '@/lib/utils';

// Increase serverless function limits
export const maxDuration = 60; // 60 seconds (requires Vercel Pro, 10s on free)
export const dynamic = 'force-dynamic';

const MAX_FILE_SIZE = 20 * 1024 * 1024;

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const botId = formData.get('botId') as string | null;

    if (!file || !botId) {
      return NextResponse.json({ error: 'file and botId are required' }, { status: 400 });
    }

    if (!file.name.endsWith('.pdf') && !file.name.endsWith('.docx')) {
      return NextResponse.json({ error: 'Only PDF and DOCX files are supported' }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: 'File size exceeds 20 MB limit' }, { status: 400 });
    }

    const docId = generateId();
    const fileType = file.name.endsWith('.pdf') ? 'pdf' : 'docx';
    const storagePath = 'kb/' + botId + '/' + docId + '/' + file.name;

    const db = createServerClient();
    const buffer = Buffer.from(await file.arrayBuffer());

    // 1. Upload to storage
    const { error: uploadError } = await db.storage
      .from('documents')
      .upload(storagePath, buffer, { contentType: file.type, upsert: false });

    if (uploadError) throw new Error('Storage upload failed: ' + uploadError.message);

    // 2. Create document record
    const doc = await insertDocument({
      id: docId, botId, fileName: file.name, fileType, fileSize: file.size,
      status: 'processing', storagePath,
    });

    // 3. Extract text - use dynamic imports to reduce cold start
    let text = '';
    try {
      if (fileType === 'pdf') {
        const pdfParse = (await import('pdf-parse')).default;
        const result = await pdfParse(buffer);
        text = result.text;
      } else {
        const mammoth = await import('mammoth');
        const result = await mammoth.extractRawText({ buffer });
        text = result.value;
      }
    } catch (parseErr) {
      const msg = parseErr instanceof Error ? parseErr.message : 'Parse failed';
      await updateDocumentStatus(docId, 'error', { errorMessage: 'Text extraction failed: ' + msg });
      return NextResponse.json({ document: { ...doc, status: 'error' }, message: 'Text extraction failed' }, { status: 500 });
    }

    if (!text || text.trim().length < 10) {
      await updateDocumentStatus(docId, 'error', { errorMessage: 'No extractable text found' });
      return NextResponse.json({ document: { ...doc, status: 'error' }, message: 'No text found' });
    }

    // 4. Chunk text
    const cleaned = text.replace(/\s+/g, ' ').trim();
    const chunkSize = 1000;
    const overlap = 200;
    const chunks: string[] = [];
    let start = 0;

    while (start < cleaned.length) {
      let end = Math.min(start + chunkSize, cleaned.length);
      if (end < cleaned.length) {
        const lastPeriod = cleaned.lastIndexOf('. ', end);
        const lastNewline = cleaned.lastIndexOf('\n', end);
        const breakPoint = Math.max(lastPeriod, lastNewline);
        if (breakPoint > start + chunkSize * 0.5) end = breakPoint + 1;
      }
      const chunk = cleaned.slice(start, end).trim();
      if (chunk.length > 50) chunks.push(chunk);
      start = end - overlap;
      if (start >= cleaned.length) break;
    }

    // 5. Save chunks without embeddings
    const chunkRows = chunks.map((content, index) => ({
      id: generateId(),
      document_id: docId,
      bot_id: botId,
      content,
      metadata: { fileName: file.name, chunkIndex: index },
      chunk_index: index,
    }));

    // Insert in batches of 50 to avoid payload limits
    for (let i = 0; i < chunkRows.length; i += 50) {
      const batch = chunkRows.slice(i, i + 50);
      const { error: chunkError } = await db.from('document_chunks').insert(batch);
      if (chunkError) throw new Error('Failed to save chunks: ' + chunkError.message);
    }

    await updateDocumentStatus(docId, 'processing', { chunkCount: chunks.length });

    return NextResponse.json({
      document: { ...doc, status: 'processing', chunkCount: chunks.length },
      needsEmbeddings: true,
    });
  } catch (err) {
    console.error('Upload API error:', err);
    const message = err instanceof Error ? err.message : 'Upload failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/db/supabase';
import { insertDocument, updateDocumentStatus } from '@/lib/db';
import { generateId } from '@/lib/utils';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

const MAX_FILE_SIZE = 20 * 1024 * 1024;

async function extractTextFromDocx(arrayBuffer: ArrayBuffer): Promise<string> {
  const mammoth = await import('mammoth');
  const result = await mammoth.extractRawText({ arrayBuffer });
  return result.value;
}

async function extractTextFromPdf(arrayBuffer: ArrayBuffer): Promise<string> {
  const pdfParse = (await import('pdf-parse')).default;
  const buffer = Buffer.from(arrayBuffer);
  const result = await pdfParse(buffer);
  return result.text;
}

function chunkTextSimple(text: string): string[] {
  const cleaned = text.replace(/\s+/g, ' ').trim();
  if (cleaned.length <= 1000) return [cleaned];
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
    const arrayBuffer = await file.arrayBuffer();

    // 1. Upload to storage
    const db = createServerClient();
    const { error: uploadError } = await db.storage
      .from('documents')
      .upload(storagePath, Buffer.from(arrayBuffer), { contentType: file.type, upsert: false });

    if (uploadError) throw new Error('Storage upload failed: ' + uploadError.message);

    // 2. Create document record
    const doc = await insertDocument({
      id: docId, botId, fileName: file.name, fileType,
      fileSize: file.size, status: 'processing', storagePath,
    });

    // 3. Extract text
    let text = '';
    try {
      if (fileType === 'docx') {
        text = await extractTextFromDocx(arrayBuffer);
      } else {
        text = await extractTextFromPdf(arrayBuffer);
      }
    } catch (parseErr) {
      const msg = parseErr instanceof Error ? parseErr.message : 'Parse failed';
      await updateDocumentStatus(docId, 'error', { errorMessage: msg });
      return NextResponse.json({ document: { ...doc, status: 'error' }, message: msg }, { status: 500 });
    }

    if (!text || text.trim().length < 10) {
      await updateDocumentStatus(docId, 'error', { errorMessage: 'No extractable text' });
      return NextResponse.json({ document: { ...doc, status: 'error' }, message: 'No text found' });
    }

    // 4. Chunk
    const chunks = chunkTextSimple(text);

    // 5. Save chunks without embeddings
    const chunkRows = chunks.map((content, index) => ({
      id: generateId(),
      document_id: docId,
      bot_id: botId,
      content,
      metadata: { fileName: file.name, chunkIndex: index },
      chunk_index: index,
    }));

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

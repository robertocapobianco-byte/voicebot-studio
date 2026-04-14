import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/db/supabase';
import { insertDocument, updateDocumentStatus } from '@/lib/db';
import { DefaultDocumentProcessor, chunkText } from '@/lib/documents';
import { generateId } from '@/lib/utils';
import type { DocumentChunk } from '@/types';

const MAX_FILE_SIZE = 20 * 1024 * 1024;
const ALLOWED_TYPES = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const botId = formData.get('botId') as string | null;

    if (!file || !botId) {
      return NextResponse.json({ error: 'file and botId are required' }, { status: 400 });
    }

    if (!ALLOWED_TYPES.includes(file.type) && !file.name.endsWith('.pdf') && !file.name.endsWith('.docx')) {
      return NextResponse.json({ error: 'Only PDF and DOCX files are supported' }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: 'File size exceeds 20 MB limit' }, { status: 400 });
    }

    const docId = generateId();
    const fileType = file.name.endsWith('.pdf') ? 'pdf' : 'docx';
    const storagePath = 'kb/' + botId + '/' + docId + '/' + file.name;

    // 1. Upload to Supabase Storage
    const db = createServerClient();
    const buffer = Buffer.from(await file.arrayBuffer());

    const { error: uploadError } = await db.storage
      .from('documents')
      .upload(storagePath, buffer, { contentType: file.type, upsert: false });

    if (uploadError) throw new Error('Storage upload failed: ' + uploadError.message);

    // 2. Create document record
    const doc = await insertDocument({
      id: docId, botId, fileName: file.name, fileType, fileSize: file.size, status: 'processing', storagePath,
    });

    // 3. Extract text and save chunks (without embeddings yet)
    try {
      const processor = new DefaultDocumentProcessor();
      const text = await processor.extractText(buffer, fileType);

      if (!text || text.trim().length < 10) {
        await updateDocumentStatus(docId, 'error', { errorMessage: 'No extractable text found' });
        return NextResponse.json({ document: { ...doc, status: 'error' }, message: 'No text found' });
      }

      const chunks = chunkText(text, { chunkSize: 1000, overlap: 200 });

      // Save chunks to DB without embeddings
      const chunkRows = chunks.map((content, index) => ({
        id: generateId(),
        document_id: docId,
        bot_id: botId,
        content,
        metadata: { fileName: file.name, chunkIndex: index },
        chunk_index: index,
      }));

      const { error: chunkError } = await db.from('document_chunks').insert(chunkRows);
      if (chunkError) throw new Error('Failed to save chunks: ' + chunkError.message);

      await updateDocumentStatus(docId, 'processing', { chunkCount: chunks.length });

      return NextResponse.json({
        document: { ...doc, status: 'processing', chunkCount: chunks.length },
        message: 'Text extracted, ' + chunks.length + ' chunks saved. Call /api/embeddings to generate embeddings.',
        needsEmbeddings: true,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Processing failed';
      await updateDocumentStatus(docId, 'error', { errorMessage: msg });
      return NextResponse.json({ document: { ...doc, status: 'error' }, message: msg }, { status: 500 });
    }
  } catch (err) {
    console.error('Upload API error:', err);
    const message = err instanceof Error ? err.message : 'Upload failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

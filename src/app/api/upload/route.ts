import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/db/supabase';
import { insertDocument, updateDocumentStatus } from '@/lib/db';
import { DefaultDocumentProcessor, chunkText } from '@/lib/documents';
import { SupabaseRetriever } from '@/lib/rag';
import { generateId } from '@/lib/utils';
import type { KBDocument, DocumentChunk } from '@/types';

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB
const ALLOWED_TYPES = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const botId = formData.get('botId') as string | null;

    if (!file || !botId) {
      return NextResponse.json({ error: 'file and botId are required' }, { status: 400 });
    }

    // Validate file
    if (!ALLOWED_TYPES.includes(file.type) && !file.name.endsWith('.pdf') && !file.name.endsWith('.docx')) {
      return NextResponse.json({ error: 'Only PDF and DOCX files are supported' }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: 'File size exceeds 20 MB limit' }, { status: 400 });
    }

    const docId = generateId();
    const fileType = file.name.endsWith('.pdf') ? 'pdf' : 'docx';
    const storagePath = `kb/${botId}/${docId}/${file.name}`;

    // 1. Upload file to Supabase Storage
    const db = createServerClient();
    const buffer = Buffer.from(await file.arrayBuffer());

    const { error: uploadError } = await db.storage
      .from('documents')
      .upload(storagePath, buffer, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      throw new Error(`Storage upload failed: ${uploadError.message}`);
    }

    // 2. Create document record
    const doc = await insertDocument({
      id: docId,
      botId,
      fileName: file.name,
      fileType,
      fileSize: file.size,
      status: 'processing',
      storagePath,
    });

    // 3. Process document in background (non-blocking for the response)
    processDocumentAsync(docId, botId, buffer, fileType).catch((err) => {
      console.error(`Background processing failed for document ${docId}:`, err);
    });

    return NextResponse.json({ document: doc, message: 'Upload successful, processing started' });
  } catch (err) {
    console.error('Upload API error:', err);
    const message = err instanceof Error ? err.message : 'Upload failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * Process document: extract text → chunk → embed → index.
 * Runs after the upload response is sent.
 */
async function processDocumentAsync(
  docId: string,
  botId: string,
  buffer: Buffer,
  fileType: string
): Promise<void> {
  try {
    // Extract text
    const processor = new DefaultDocumentProcessor();
    const text = await processor.extractText(buffer, fileType);

    if (!text || text.trim().length < 10) {
      await updateDocumentStatus(docId, 'error', { errorMessage: 'No extractable text found' });
      return;
    }

    // Chunk
    const chunks = chunkText(text, { chunkSize: 1000, overlap: 200 });

    // Build chunk objects
    const docChunks: DocumentChunk[] = chunks.map((content, index) => ({
      id: generateId(),
      documentId: docId,
      botId,
      content,
      metadata: { fileName: docId, chunkIndex: index },
      chunkIndex: index,
    }));

    // Generate embeddings and store
    const retriever = new SupabaseRetriever();
    await retriever.index(docChunks);

    // Mark as indexed
    await updateDocumentStatus(docId, 'indexed', { chunkCount: chunks.length });
  } catch (err) {
    console.error(`Document processing error for ${docId}:`, err);
    const errorMessage = err instanceof Error ? err.message : 'Processing failed';
    await updateDocumentStatus(docId, 'error', { errorMessage });
  }
}

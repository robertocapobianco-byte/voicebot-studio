import { NextRequest, NextResponse } from 'next/server';
import { updateDocumentStatus } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const { documentId, chunkCount } = await request.json();
    if (!documentId) {
      return NextResponse.json({ error: 'documentId required' }, { status: 400 });
    }
    await updateDocumentStatus(documentId, 'processing', { chunkCount: chunkCount || 0 });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Finalize error:', err);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}

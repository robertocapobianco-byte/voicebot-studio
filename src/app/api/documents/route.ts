import { NextRequest, NextResponse } from 'next/server';
import { getDocuments, deleteDocument } from '@/lib/db';
import { createServerClient } from '@/lib/db/supabase';

export async function GET(request: NextRequest) {
  try {
    const botId = request.nextUrl.searchParams.get('botId');
    if (!botId) {
      return NextResponse.json({ error: 'botId is required' }, { status: 400 });
    }

    const documents = await getDocuments(botId);
    return NextResponse.json({ documents });
  } catch (err) {
    console.error('Documents GET error:', err);
    return NextResponse.json({ error: 'Failed to fetch documents' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { id, storagePath } = await request.json();
    if (!id) {
      return NextResponse.json({ error: 'document id is required' }, { status: 400 });
    }

    // Delete from storage if path provided
    if (storagePath) {
      const db = createServerClient();
      await db.storage.from('documents').remove([storagePath]);
    }

    // Delete from database (chunks cascade)
    await deleteDocument(id);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Documents DELETE error:', err);
    return NextResponse.json({ error: 'Failed to delete document' }, { status: 500 });
  }
}

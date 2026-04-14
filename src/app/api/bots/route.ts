import { NextRequest, NextResponse } from 'next/server';
import { getBotConfigs, getBotConfig, upsertBotConfig, deleteBotConfig } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const id = request.nextUrl.searchParams.get('id');
    if (id) {
      const config = await getBotConfig(id);
      if (!config) return NextResponse.json({ error: 'Bot not found' }, { status: 404 });
      return NextResponse.json({ config });
    }
    const configs = await getBotConfigs();
    return NextResponse.json({ configs });
  } catch (err) {
    console.error('Bots GET error:', err);
    return NextResponse.json({ error: 'Failed to fetch bot configs' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const config = await upsertBotConfig(body);
    return NextResponse.json({ config });
  } catch (err) {
    console.error('Bots POST error:', err);
    const message = err instanceof Error ? err.message : 'Failed to save bot config';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { id } = await request.json();
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });
    await deleteBotConfig(id);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Bots DELETE error:', err);
    return NextResponse.json({ error: 'Failed to delete bot config' }, { status: 500 });
  }
}

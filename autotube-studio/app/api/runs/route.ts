export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { startRun } from '@/lib/process-manager';

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const topicHint = String(body.topicHint ?? '').trim();
  const characterId = body.characterId ? String(body.characterId) : undefined;

  if (!topicHint) {
    return NextResponse.json({ error: 'topicHint es requerido' }, { status: 400 });
  }

  const runId = `run_${Date.now()}`;
  startRun(runId, topicHint, { characterId });
  return NextResponse.json({ runId });
}

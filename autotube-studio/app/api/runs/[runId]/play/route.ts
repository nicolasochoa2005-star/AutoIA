export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { isRunning, startRun, confirmWaiting } from '@/lib/process-manager';
import { readManifest } from '@/lib/manifest';

/** "Play del grafo": si hay un proceso activo en pausa, lo confirma (ENTER); si no, arranca/continúa. */
export async function POST(_req: NextRequest, { params }: { params: Promise<{ runId: string }> }) {
  const { runId } = await params;

  if (isRunning(runId)) {
    const ok = confirmWaiting(runId);
    return NextResponse.json({ action: 'confirmed', ok });
  }

  const manifest = await readManifest(runId);
  if (!manifest) {
    return NextResponse.json(
      { error: 'No existe manifest para esta corrida; creala primero con POST /api/runs' },
      { status: 404 },
    );
  }

  startRun(runId, manifest.topicHint, { characterId: manifest.characterId });
  return NextResponse.json({ action: 'started' });
}

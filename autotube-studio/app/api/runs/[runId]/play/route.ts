export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { isRunning, startRun, confirmWaiting } from '@/lib/process-manager';
import { readManifest } from '@/lib/manifest';
import { parseStartOptions, loadWorkflowAssets } from '@/lib/start-options';

/** "Play del grafo": si hay un proceso activo en pausa, lo confirma (ENTER); si no, arranca/continúa. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ runId: string }> }) {
  const { runId } = await params;
  const body = await req.json().catch(() => ({}));
  const opts = parseStartOptions(body);
  const assets = await loadWorkflowAssets(runId);

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

  startRun(runId, manifest.topicHint, {
    ...opts,
    characterId: opts.characterId ?? manifest.characterId,
    composeImagePaths: opts.composeImagePaths?.length ? opts.composeImagePaths : assets.composeImagePaths,
    backgroundMusicPath: opts.backgroundMusicPath ?? assets.backgroundMusicPath,
  });
  return NextResponse.json({ action: 'started' });
}

export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { isRunning, startRun } from '@/lib/process-manager';
import { readManifest } from '@/lib/manifest';
import { STAGE_ORDER, StageName } from '@/lib/engine-paths';
import { parseStartOptions, loadWorkflowAssets } from '@/lib/start-options';

/** "Play de un nodo suelto": regenera esa etapa (y las siguientes) desde cero. */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ runId: string; stage: string }> },
) {
  const { runId, stage } = await params;
  const body = await req.json().catch(() => ({}));
  const opts = parseStartOptions(body);
  const assets = await loadWorkflowAssets(runId);

  if (!STAGE_ORDER.includes(stage as StageName)) {
    return NextResponse.json({ error: `etapa inválida: ${stage}` }, { status: 400 });
  }
  if (isRunning(runId)) {
    return NextResponse.json(
      { error: 'la corrida ya tiene un proceso activo; esperá a que termine o se pause' },
      { status: 409 },
    );
  }

  const manifest = await readManifest(runId);
  if (!manifest) {
    return NextResponse.json({ error: 'no existe manifest para esta corrida' }, { status: 404 });
  }

  startRun(runId, manifest.topicHint, {
    ...opts,
    characterId: opts.characterId ?? manifest.characterId,
    from: stage as StageName,
    composeImagePaths: opts.composeImagePaths?.length ? opts.composeImagePaths : assets.composeImagePaths,
    backgroundMusicPath: opts.backgroundMusicPath ?? assets.backgroundMusicPath,
  });
  return NextResponse.json({ action: 'regenerating', stage });
}

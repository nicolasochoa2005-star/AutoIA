export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import * as fs from 'fs/promises';
import * as path from 'path';
import { startRun } from '@/lib/process-manager';
import { runDirFor } from '@/lib/engine-paths';
import { parseStartOptions } from '@/lib/start-options';

async function saveFile(targetPath: string, file: File): Promise<void> {
  const buffer = Buffer.from(await file.arrayBuffer());
  await fs.mkdir(path.dirname(targetPath), { recursive: true });
  await fs.writeFile(targetPath, buffer);
}

export async function POST(req: NextRequest) {
  const contentType = req.headers.get('content-type') ?? '';
  if (contentType.includes('multipart/form-data')) {
    return fromForm(req);
  }

  const body = await req.json().catch(() => ({}));
  const topicHint = String(body.topicHint ?? '').trim();
  if (!topicHint) {
    return NextResponse.json({ error: 'topicHint es requerido' }, { status: 400 });
  }

  const opts = parseStartOptions(body);
  const runId = `run_${Date.now()}`;
  startRun(runId, topicHint, opts);
  return NextResponse.json({ runId });
}

async function fromForm(req: NextRequest) {
  const form = await req.formData();
  const topicHint = String(form.get('topicHint') ?? '').trim();
  if (!topicHint) {
    return NextResponse.json({ error: 'topicHint es requerido' }, { status: 400 });
  }

  const runId = `run_${Date.now()}`;
  const runDir = runDirFor(runId);
  await fs.mkdir(path.join(runDir, 'workflow'), { recursive: true });

  const workflowRaw = form.get('workflow');
  if (typeof workflowRaw === 'string' && workflowRaw.trim()) {
    await fs.writeFile(path.join(runDir, 'workflow.json'), workflowRaw, 'utf-8');
  }

  const composeImagePaths: string[] = [];
  for (const [key, value] of form.entries()) {
    if (!key.startsWith('composeImage') || !(value instanceof File)) continue;
    const ext = path.extname(value.name) || '.jpg';
    const dest = path.join(runDir, 'workflow', `compose_${composeImagePaths.length}${ext}`);
    await saveFile(dest, value);
    composeImagePaths.push(dest);
  }

  let backgroundMusicPath: string | undefined;
  const music = form.get('backgroundMusic');
  if (music instanceof File && music.size > 0) {
    const ext = path.extname(music.name) || '.mp3';
    backgroundMusicPath = path.join(runDir, 'workflow', `music${ext}`);
    await saveFile(backgroundMusicPath, music);
  }

  const opts = parseStartOptions({
    characterId: form.get('characterId') || undefined,
    ttsProvider: form.get('ttsProvider') || undefined,
    identityProvider: form.get('identityProvider') || undefined,
    narrativeProfile: form.get('narrativeProfile') || undefined,
    promptOverride: form.get('promptOverride') || undefined,
    width: form.get('width') || undefined,
    height: form.get('height') || undefined,
    fps: form.get('fps') || undefined,
    vcodec: form.get('vcodec') || undefined,
    acodec: form.get('acodec') || undefined,
    durationSec: form.get('durationSec') || undefined,
    composeImagePaths,
    backgroundMusicPath,
  });

  startRun(runId, topicHint, opts);
  return NextResponse.json({ runId });
}

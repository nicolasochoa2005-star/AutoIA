export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import * as fs from 'fs/promises';
import * as path from 'path';
import { runDirFor } from '@/lib/engine-paths';

async function saveFile(targetPath: string, file: File): Promise<void> {
  const buffer = Buffer.from(await file.arrayBuffer());
  await fs.mkdir(path.dirname(targetPath), { recursive: true });
  await fs.writeFile(targetPath, buffer);
}

/**
 * Dropzone del operador. Escribe directamente en el artefacto esperado por
 * el Engine; el proceso en pausa lo detecta por poll (ver stage-gate/compose)
 * dentro del segundo siguiente, sin necesidad de un "confirmar" aparte.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ runId: string }> }) {
  const { runId } = await params;
  const runDir = runDirFor(runId);
  const form = await req.formData();
  const slot = String(form.get('slot') ?? '');

  if (slot === 'script') {
    const file = form.get('file');
    if (!(file instanceof File)) return NextResponse.json({ error: 'falta el archivo' }, { status: 400 });
    await saveFile(path.join(runDir, '01_script.json'), file);
  } else if (slot === 'tts') {
    const audio = form.get('audio');
    const subtitles = form.get('subtitles');
    if (!(audio instanceof File) || !(subtitles instanceof File)) {
      return NextResponse.json({ error: 'faltan audio y/o subtitles' }, { status: 400 });
    }
    await saveFile(path.join(runDir, '02_audio', 'voice.mp3'), audio);
    await saveFile(path.join(runDir, '02_audio', 'subtitles.ass'), subtitles);
  } else if (slot === 'beat') {
    const beatIndex = Number(form.get('beatIndex'));
    const file = form.get('file');
    if (!(file instanceof File) || !beatIndex) {
      return NextResponse.json({ error: 'faltan file y/o beatIndex' }, { status: 400 });
    }
    await saveFile(path.join(runDir, '03_visuals', `beat_${beatIndex}.jpg`), file);
  } else if (slot === 'render') {
    const file = form.get('file');
    if (!(file instanceof File)) return NextResponse.json({ error: 'falta el archivo' }, { status: 400 });
    await saveFile(path.join(runDir, '04_render', 'final.mp4'), file);
  } else {
    return NextResponse.json({ error: `slot desconocido: ${slot}` }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}

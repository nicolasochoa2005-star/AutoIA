export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import * as fs from 'fs/promises';
import * as path from 'path';
import { runDirFor } from '@/lib/engine-paths';

const CONTENT_TYPES: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.mp4': 'video/mp4',
  '.mp3': 'audio/mpeg',
  '.json': 'application/json',
};

/** Sirve un artefacto de la corrida para thumbnail/preview (ej. ?path=03_visuals/beat_1.jpg). */
export async function GET(req: NextRequest, { params }: { params: Promise<{ runId: string }> }) {
  const { runId } = await params;
  const relativePath = req.nextUrl.searchParams.get('path');
  if (!relativePath) {
    return NextResponse.json({ error: 'falta el parámetro path' }, { status: 400 });
  }

  const runDir = runDirFor(runId);
  const resolved = path.resolve(runDir, relativePath);

  // Evita path traversal: el archivo resuelto debe quedar dentro del run dir.
  if (!resolved.startsWith(path.resolve(runDir) + path.sep) && resolved !== path.resolve(runDir)) {
    return NextResponse.json({ error: 'ruta inválida' }, { status: 400 });
  }

  try {
    const data = await fs.readFile(resolved);
    const contentType = CONTENT_TYPES[path.extname(resolved).toLowerCase()] ?? 'application/octet-stream';
    return new NextResponse(new Uint8Array(data), { headers: { 'Content-Type': contentType } });
  } catch {
    return NextResponse.json({ error: 'artefacto no encontrado' }, { status: 404 });
  }
}

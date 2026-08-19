export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import * as fs from 'fs/promises';
import * as path from 'path';
import { ENGINE_DIR } from '@/lib/engine-paths';

export async function GET() {
  const charactersDir = path.join(ENGINE_DIR, 'assets', 'library', 'characters');
  try {
    const files = await fs.readdir(charactersDir);
    const characters = await Promise.all(
      files
        .filter((f) => f.endsWith('.json'))
        .map(async (f) => {
          const raw = await fs.readFile(path.join(charactersDir, f), 'utf-8');
          const parsed = JSON.parse(raw);
          return { id: parsed.id ?? path.basename(f, '.json'), name: parsed.name ?? parsed.id };
        }),
    );
    return NextResponse.json({ characters });
  } catch {
    return NextResponse.json({ characters: [] });
  }
}

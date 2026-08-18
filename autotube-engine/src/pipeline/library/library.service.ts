import { Injectable, Logger } from '@nestjs/common';
import * as path from 'path';
import * as fs from 'fs/promises';
import { CharacterBible } from './library.types';

const LIBRARY_ROOT = path.join(process.cwd(), 'assets', 'library');

@Injectable()
export class LibraryService {
  private readonly logger = new Logger(LibraryService.name);

  async loadCharacter(characterId: string): Promise<CharacterBible> {
    const filePath = path.join(LIBRARY_ROOT, 'characters', `${characterId}.json`);
    let raw: string;
    try {
      raw = await fs.readFile(filePath, 'utf-8');
    } catch {
      throw new Error(`INVALID_SCRIPT: no se encontró el character bible en ${filePath}`);
    }

    const parsed = JSON.parse(raw) as Partial<CharacterBible>;
    if (!parsed.id || !parsed.name || !parsed.description || !parsed.subjectId) {
      throw new Error(`INVALID_SCRIPT: character bible incompleto en ${filePath}`);
    }
    return { ...parsed, outfits: parsed.outfits ?? [] } as CharacterBible;
  }

  /** `assets/library/scenes/beat-<N>.jpg` (escena ya compuesta por el operador). */
  async resolveScene(beatIndex: number): Promise<string | null> {
    const padded = String(beatIndex).padStart(2, '0');
    const candidate = path.join(LIBRARY_ROOT, 'scenes', `beat-${padded}.jpg`);
    return (await this.exists(candidate)) ? candidate : null;
  }

  outfitFile(outfitId: string): string {
    return path.join(LIBRARY_ROOT, 'outfits', `${outfitId}.png`);
  }

  subjectRefFile(subjectId: string, kind: 'face' | 'full' | 'body'): string {
    return path.join(LIBRARY_ROOT, 'subjects', subjectId, `${kind}.jpg`);
  }

  private async exists(p: string): Promise<boolean> {
    try {
      await fs.access(p);
      return true;
    } catch {
      return false;
    }
  }
}

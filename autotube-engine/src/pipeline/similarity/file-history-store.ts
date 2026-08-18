import { Injectable } from '@nestjs/common';
import * as path from 'path';
import * as fs from 'fs/promises';
import { ScriptHistoryEntry, ScriptHistoryStore } from './history-store';

const HISTORY_PATH = path.join(process.cwd(), 'data', 'script-history.json');

@Injectable()
export class FileScriptHistoryStore implements ScriptHistoryStore {
  async getRecent(limit: number): Promise<ScriptHistoryEntry[]> {
    const all = await this.readAll();
    return all.slice(-limit);
  }

  async save(entry: ScriptHistoryEntry): Promise<void> {
    const all = await this.readAll();
    all.push(entry);
    await fs.mkdir(path.dirname(HISTORY_PATH), { recursive: true });
    await fs.writeFile(HISTORY_PATH, JSON.stringify(all, null, 2), 'utf-8');
  }

  private async readAll(): Promise<ScriptHistoryEntry[]> {
    try {
      const raw = await fs.readFile(HISTORY_PATH, 'utf-8');
      return JSON.parse(raw) as ScriptHistoryEntry[];
    } catch {
      return [];
    }
  }
}

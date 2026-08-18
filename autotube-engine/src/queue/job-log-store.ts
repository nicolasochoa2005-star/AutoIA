import { Injectable } from '@nestjs/common';
import * as path from 'path';
import * as fs from 'fs/promises';

export interface JobLogEntry {
  jobId: string;
  topicHint: string;
  success: boolean;
  errorReason?: string;
  errorDetail?: string;
  createdAt: string;
}

const LOG_PATH = path.join(process.cwd(), 'data', 'job-logs.json');

/**
 * Registro de resultado por corrida del pipeline (interin de Fase 2; ver
 * FuncionalDoc.md sección 6 — se reemplaza por la tabla `video_logs` en Fase 3).
 */
@Injectable()
export class JobLogStore {
  async append(entry: JobLogEntry): Promise<void> {
    const all = await this.readAll();
    all.push(entry);
    await fs.mkdir(path.dirname(LOG_PATH), { recursive: true });
    await fs.writeFile(LOG_PATH, JSON.stringify(all, null, 2), 'utf-8');
  }

  private async readAll(): Promise<JobLogEntry[]> {
    try {
      const raw = await fs.readFile(LOG_PATH, 'utf-8');
      return JSON.parse(raw) as JobLogEntry[];
    } catch {
      return [];
    }
  }
}

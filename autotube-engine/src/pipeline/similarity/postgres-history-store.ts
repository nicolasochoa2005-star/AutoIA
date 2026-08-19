import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../db/prisma.service';
import { VideoLifecycleService } from '../../db/video-lifecycle.service';
import { ScriptHistoryEntry, ScriptHistoryStore } from './history-store';

interface HistoryRow {
  id: string;
  title: string;
  embedding: string;
  hook_type: string | null;
  created_at: Date;
}

@Injectable()
export class PostgresScriptHistoryStore implements ScriptHistoryStore {
  constructor(
    private readonly prisma: PrismaService,
    private readonly videos: VideoLifecycleService,
  ) {}

  async getRecent(limit: number): Promise<ScriptHistoryEntry[]> {
    const rows = await this.prisma.$queryRawUnsafe<HistoryRow[]>(
      `SELECT id, title, embedding::text AS embedding, hook_type, created_at
       FROM videos
       WHERE embedding IS NOT NULL
       ORDER BY created_at DESC
       LIMIT $1`,
      limit,
    );

    const entries: ScriptHistoryEntry[] = [];
    for (const row of rows) {
      const embedding = this.parseVector(row.embedding);
      if (!embedding) continue;
      entries.push({
        videoId: row.id,
        title: row.title,
        hookType: row.hook_type ?? 'otro',
        embedding,
        createdAt: row.created_at.toISOString(),
      });
    }
    return entries.reverse();
  }

  async save(entry: ScriptHistoryEntry): Promise<void> {
    if (!entry.videoId) {
      throw new Error('HISTORY_STORE: videoId es obligatorio para persistir el embedding');
    }
    await this.videos.setEmbedding(entry.videoId, entry.embedding);
    await this.prisma.video.update({
      where: { id: entry.videoId },
      data: {
        hookType: entry.hookType,
        title: entry.title.slice(0, 255),
      },
    });
  }

  private parseVector(raw: string): number[] | null {
    const trimmed = raw.trim().replace(/^\[/, '').replace(/\]$/, '');
    if (!trimmed) return null;
    return trimmed.split(',').map((part) => Number(part.trim()));
  }
}

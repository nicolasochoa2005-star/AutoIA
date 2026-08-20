import { Inject, Injectable, Logger } from '@nestjs/common';
import { VideoStatus } from '@prisma/client';
import { PrismaService } from '../db/prisma.service';
import { VideoLogService } from '../db/video-log.service';
import { isQuotaExceeded } from '../publish/quota';
import { YOUTUBE_ANALYTICS_CLIENT } from './youtube-analytics.client';
import type { YoutubeAnalyticsClient } from './youtube-analytics.client';

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly logs: VideoLogService,
    @Inject(YOUTUBE_ANALYTICS_CLIENT) private readonly youtube: YoutubeAnalyticsClient,
  ) {}

  async syncPublished(): Promise<{ synced: number; skipped: number }> {
    const videos = await this.prisma.video.findMany({
      where: { status: VideoStatus.PUBLISHED, youtubeVideoId: { not: null } },
      select: { id: true, youtubeVideoId: true, publishedAt: true, createdAt: true },
    });

    let synced = 0;
    let skipped = 0;
    const endDate = isoDate(new Date());

    for (const video of videos) {
      if (!video.youtubeVideoId) {
        skipped += 1;
        continue;
      }
      const start = video.publishedAt ?? video.createdAt;
      try {
        const snapshot = await this.youtube.fetchVideoMetrics(
          video.youtubeVideoId,
          isoDate(start),
          endDate,
        );
        await this.prisma.videoMetric.create({
          data: {
            videoId: video.id,
            views: snapshot.views,
            likes: snapshot.likes,
            comments: snapshot.comments,
            retentionRate: snapshot.retentionRate,
            estimatedRevenue: snapshot.estimatedRevenue,
          },
        });
        synced += 1;
      } catch (error) {
        if (isQuotaExceeded(error)) {
          this.logger.warn('YouTube Analytics quota exceeded; stopping this run');
          break;
        }
        this.logger.warn(`Analytics skip ${video.id}: ${(error as Error).message}`);
        skipped += 1;
      }
    }

    return { synced, skipped };
  }

  async summary(days: number): Promise<{
    days: number;
    views: number;
    retention: number;
    estimatedRevenue: number;
    videos: number;
    snapshots: { fetchedAt: string; views: number; retentionRate: number; estimatedRevenue: number }[];
  }> {
    const since = new Date();
    since.setUTCDate(since.getUTCDate() - days);
    const rows = await this.prisma.videoMetric.findMany({
      where: { fetchedAt: { gte: since } },
      orderBy: { fetchedAt: 'desc' },
      take: 50,
    });
    const latestByVideo = new Map<string, (typeof rows)[number]>();
    for (const row of rows) {
      if (!latestByVideo.has(row.videoId)) {
        latestByVideo.set(row.videoId, row);
      }
    }
    const latest = [...latestByVideo.values()];
    const views = latest.reduce((sum, row) => sum + row.views, 0);
    const retention =
      latest.length === 0 ? 0 : latest.reduce((sum, row) => sum + row.retentionRate, 0) / latest.length;
    const estimatedRevenue = latest.reduce((sum, row) => sum + Number(row.estimatedRevenue), 0);
    return {
      days,
      views,
      retention,
      estimatedRevenue,
      videos: latest.length,
      snapshots: rows.slice(0, 14).map((row) => ({
        fetchedAt: row.fetchedAt.toISOString(),
        views: row.views,
        retentionRate: row.retentionRate,
        estimatedRevenue: Number(row.estimatedRevenue),
      })),
    };
  }

  async spend() {
    const startOfUtcDay = new Date();
    startOfUtcDay.setUTCHours(0, 0, 0, 0);
    return {
      today: await this.logs.spendByProvider(startOfUtcDay),
      all: await this.logs.spendByProvider(),
    };
  }

  async health() {
    const exceededAt = await this.logs.latestQuotaExceededAt();
    return {
      youtubeQuota: exceededAt ? 'exceeded' : 'ok',
      lastExceededAt: exceededAt?.toISOString() ?? null,
    };
  }
}

function isoDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

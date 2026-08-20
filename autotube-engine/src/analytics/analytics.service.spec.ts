import { VideoStatus } from '@prisma/client';
import { PrismaService } from '../db/prisma.service';
import { VideoLogService } from '../db/video-log.service';
import { AnalyticsService } from './analytics.service';
import type { YoutubeAnalyticsClient } from './youtube-analytics.client';

describe('AnalyticsService.syncPublished', () => {
  const prisma = {
    video: { findMany: jest.fn() },
    videoMetric: { create: jest.fn() },
  };
  const logs = {};
  const youtube: YoutubeAnalyticsClient = { fetchVideoMetrics: jest.fn() };
  const service = new AnalyticsService(
    prisma as unknown as PrismaService,
    logs as unknown as VideoLogService,
    youtube,
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('stores a snapshot for published videos with a YouTube id', async () => {
    prisma.video.findMany.mockResolvedValue([
      { id: 'v1', youtubeVideoId: 'yt1', publishedAt: new Date('2026-08-01'), createdAt: new Date() },
    ]);
    (youtube.fetchVideoMetrics as jest.Mock).mockResolvedValue({
      views: 10,
      likes: 1,
      comments: 0,
      retentionRate: 0.4,
      estimatedRevenue: 0,
    });

    const result = await service.syncPublished();
    expect(result.synced).toBe(1);
    expect(prisma.videoMetric.create).toHaveBeenCalled();
  });

  it('does not fetch metrics for unpublished videos', async () => {
    prisma.video.findMany.mockResolvedValue([]);
    await service.syncPublished();
    expect(youtube.fetchVideoMetrics).not.toHaveBeenCalled();
    expect(prisma.video.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: VideoStatus.PUBLISHED }),
      }),
    );
  });
});

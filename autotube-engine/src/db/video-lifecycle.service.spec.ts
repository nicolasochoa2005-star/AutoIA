import { VideoStatus } from '@prisma/client';
import { PrismaService } from './prisma.service';
import { VideoLifecycleService } from './video-lifecycle.service';
import { PublishConflictError, ReviewConflictError, ReviewValidationError, VideoNotFoundError } from './video-review.errors';

describe('VideoLifecycleService.review', () => {
  const prisma = {
    video: {
      findUnique: jest.fn(),
      update: jest.fn(),
      findMany: jest.fn(),
    },
  };
  const service = new VideoLifecycleService(prisma as unknown as PrismaService);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('approves a video in READY_FOR_REVIEW', async () => {
    prisma.video.findUnique.mockResolvedValue({ id: 'v1', status: VideoStatus.READY_FOR_REVIEW });
    prisma.video.update.mockResolvedValue({
      id: 'v1',
      title: 'Short',
      status: VideoStatus.APPROVED,
      errorReason: null,
      createdAt: new Date(),
      reviewedAt: new Date(),
      description: null,
      tags: [],
      script: null,
      runDir: null,
      videoUrl: null,
      reviewedBy: 'alan',
      reviewNotes: 'ok',
      characterId: null,
      hookType: null,
    });

    const result = await service.review('v1', {
      action: 'approve',
      notes: 'ok',
      reviewedBy: 'alan',
    });

    expect(result.status).toBe(VideoStatus.APPROVED);
    expect(prisma.video.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'v1' },
        data: expect.objectContaining({
          status: VideoStatus.APPROVED,
          reviewedBy: 'alan',
          reviewNotes: 'ok',
        }),
      }),
    );
  });

  it('rejects a video in READY_FOR_REVIEW with notes', async () => {
    prisma.video.findUnique.mockResolvedValue({ id: 'v1', status: VideoStatus.READY_FOR_REVIEW });
    prisma.video.update.mockResolvedValue({
      id: 'v1',
      status: VideoStatus.REJECTED,
      reviewNotes: 'sync roto',
    });

    await service.review('v1', {
      action: 'reject',
      notes: 'sync roto',
      reviewedBy: 'alan',
    });

    expect(prisma.video.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: VideoStatus.REJECTED,
          reviewNotes: 'sync roto',
        }),
      }),
    );
  });

  it('throws when rejecting without notes', async () => {
    await expect(
      service.review('v1', { action: 'reject', notes: '  ', reviewedBy: 'alan' }),
    ).rejects.toBeInstanceOf(ReviewValidationError);
    expect(prisma.video.findUnique).not.toHaveBeenCalled();
  });

  it('throws conflict when status is not READY_FOR_REVIEW', async () => {
    prisma.video.findUnique.mockResolvedValue({ id: 'v1', status: VideoStatus.ERROR });
    await expect(
      service.review('v1', { action: 'approve', reviewedBy: 'alan' }),
    ).rejects.toBeInstanceOf(ReviewConflictError);
  });

  it('throws when the video does not exist', async () => {
    prisma.video.findUnique.mockResolvedValue(null);
    await expect(
      service.review('missing', { action: 'approve', reviewedBy: 'alan' }),
    ).rejects.toBeInstanceOf(VideoNotFoundError);
  });
});

describe('VideoLifecycleService.list', () => {
  const prisma = {
    video: {
      findMany: jest.fn(),
    },
  };
  const service = new VideoLifecycleService(prisma as unknown as PrismaService);

  it('filters by status when provided', async () => {
    prisma.video.findMany.mockResolvedValue([]);
    await service.list(VideoStatus.ERROR);
    expect(prisma.video.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { status: VideoStatus.ERROR },
      }),
    );
  });
});

describe('VideoLifecycleService.markPublished', () => {
  const prisma = {
    video: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  };
  const service = new VideoLifecycleService(prisma as unknown as PrismaService);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('marks an APPROVED video as PUBLISHED', async () => {
    prisma.video.findUnique.mockResolvedValue({
      id: 'v1',
      status: VideoStatus.APPROVED,
      youtubeVideoId: null,
    });
    prisma.video.update.mockResolvedValue({
      id: 'v1',
      status: VideoStatus.PUBLISHED,
      youtubeVideoId: 'yt1',
    });

    const result = await service.markPublished('v1', 'yt1');
    expect(result.status).toBe(VideoStatus.PUBLISHED);
    expect(prisma.video.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: VideoStatus.PUBLISHED,
          youtubeVideoId: 'yt1',
          errorReason: null,
        }),
      }),
    );
  });

  it('is a no-op when already PUBLISHED', async () => {
    prisma.video.findUnique
      .mockResolvedValueOnce({
        id: 'v1',
        status: VideoStatus.PUBLISHED,
        youtubeVideoId: 'yt1',
      })
      .mockResolvedValueOnce({
        id: 'v1',
        status: VideoStatus.PUBLISHED,
        youtubeVideoId: 'yt1',
      });

    const result = await service.markPublished('v1', 'yt-other');
    expect(result.youtubeVideoId).toBe('yt1');
    expect(prisma.video.update).not.toHaveBeenCalled();
  });

  it('throws when status is not APPROVED', async () => {
    prisma.video.findUnique.mockResolvedValue({
      id: 'v1',
      status: VideoStatus.REJECTED,
      youtubeVideoId: null,
    });
    await expect(service.markPublished('v1', 'yt1')).rejects.toBeInstanceOf(PublishConflictError);
  });
});

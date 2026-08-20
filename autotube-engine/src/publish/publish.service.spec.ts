import { ConfigService } from '@nestjs/config';
import { VideoStatus } from '@prisma/client';
import { VideoLifecycleService, VideoDetail } from '../db/video-lifecycle.service';
import { VideoLogService } from '../db/video-log.service';
import { PublishConflictError } from '../db/video-review.errors';
import { PublishService } from './publish.service';
import { YoutubeClient } from './youtube-client';

jest.mock('../api/preview-path', () => ({
  resolvePreviewFilePath: jest.fn(),
}));

import { resolvePreviewFilePath } from '../api/preview-path';

const resolveFile = resolvePreviewFilePath as jest.MockedFunction<typeof resolvePreviewFilePath>;

function approvedVideo(overrides: Partial<VideoDetail> = {}): VideoDetail {
  return {
    id: 'v1',
    title: 'Short de prueba',
    status: VideoStatus.APPROVED,
    errorReason: null,
    createdAt: new Date(),
    reviewedAt: new Date(),
    description: 'desc',
    tags: ['espacio'],
    script: null,
    runDir: '/tmp/output/job_1',
    videoUrl: '/tmp/output/job_1/04_render/final.mp4',
    reviewedBy: 'alan',
    reviewNotes: 'ok',
    characterId: null,
    hookType: null,
    youtubeVideoId: null,
    publishedAt: null,
    ...overrides,
  };
}

describe('PublishService', () => {
  const videos = {
    findById: jest.fn(),
    markPublished: jest.fn(),
    setStatus: jest.fn(),
  };
  const logs = { appendStage: jest.fn() };
  const youtube: YoutubeClient = { upload: jest.fn() };
  const config = {
    get: jest.fn((key: string, fallback?: string) => {
      if (key === 'YOUTUBE_PRIVACY_STATUS') return 'unlisted';
      if (key === 'YOUTUBE_CATEGORY_ID') return '22';
      if (key === 'YOUTUBE_CONTAINS_SYNTHETIC_MEDIA') return 'true';
      return fallback;
    }),
  };

  const service = new PublishService(
    videos as unknown as VideoLifecycleService,
    logs as unknown as VideoLogService,
    youtube,
    config as unknown as ConfigService,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    resolveFile.mockReturnValue('/tmp/output/job_1/04_render/final.mp4');
    videos.markPublished.mockImplementation(async (_id: string, yt: string) =>
      approvedVideo({ status: VideoStatus.PUBLISHED, youtubeVideoId: yt }),
    );
  });

  it('uploads an APPROVED video and marks it PUBLISHED', async () => {
    videos.findById.mockResolvedValue(approvedVideo());
    (youtube.upload as jest.Mock).mockResolvedValue({ youtubeVideoId: 'yt123' });

    const result = await service.publish('v1');

    expect(result).toEqual({ kind: 'published', youtubeVideoId: 'yt123' });
    expect(youtube.upload).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Short de prueba',
        description: 'desc',
        tags: ['espacio'],
        privacyStatus: 'unlisted',
      }),
    );
    expect(videos.markPublished).toHaveBeenCalledWith('v1', 'yt123');
    expect(logs.appendStage).toHaveBeenCalledWith(
      expect.objectContaining({ stage: 'PUBLISH', success: true }),
    );
  });

  it('does not upload REJECTED videos', async () => {
    videos.findById.mockResolvedValue(approvedVideo({ status: VideoStatus.REJECTED }));
    await expect(service.publish('v1')).rejects.toBeInstanceOf(PublishConflictError);
    expect(youtube.upload).not.toHaveBeenCalled();
  });

  it('does not upload READY_FOR_REVIEW videos', async () => {
    videos.findById.mockResolvedValue(approvedVideo({ status: VideoStatus.READY_FOR_REVIEW }));
    await expect(service.publish('v1')).rejects.toBeInstanceOf(PublishConflictError);
    expect(youtube.upload).not.toHaveBeenCalled();
  });

  it('keeps APPROVED and does not tight-loop on quotaExceeded', async () => {
    videos.findById.mockResolvedValue(approvedVideo());
    (youtube.upload as jest.Mock).mockRejectedValue({
      code: 403,
      errors: [{ reason: 'quotaExceeded' }],
      message: 'quotaExceeded',
    });

    const result = await service.publish('v1');

    expect(result.kind).toBe('quota-exceeded');
    if (result.kind === 'quota-exceeded') {
      expect(result.retryAt.getTime()).toBeGreaterThan(Date.now());
    }
    expect(videos.markPublished).not.toHaveBeenCalled();
    expect(videos.setStatus).toHaveBeenCalledWith('v1', VideoStatus.APPROVED, {
      errorReason: 'QUOTA_EXCEEDED',
    });
    expect(youtube.upload).toHaveBeenCalledTimes(1);
  });
});

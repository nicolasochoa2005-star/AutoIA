import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { VideoStatus } from '@prisma/client';
import { resolvePreviewFilePath } from '../api/preview-path';
import { VideoLifecycleService } from '../db/video-lifecycle.service';
import { VideoLogService } from '../db/video-log.service';
import { PublishConflictError, VideoNotFoundError } from '../db/video-review.errors';
import { isAuthFailure, isQuotaExceeded, nextPacificQuotaReset } from './quota';
import { YOUTUBE_CLIENT } from './youtube-client';
import type { YoutubeClient, YoutubePrivacyStatus } from './youtube-client';

export type PublishResult =
  | { kind: 'published'; youtubeVideoId: string }
  | { kind: 'already-published'; youtubeVideoId: string }
  | { kind: 'quota-exceeded'; retryAt: Date };

@Injectable()
export class PublishService {
  private readonly logger = new Logger(PublishService.name);

  constructor(
    private readonly videos: VideoLifecycleService,
    private readonly logs: VideoLogService,
    @Inject(YOUTUBE_CLIENT) private readonly youtube: YoutubeClient,
    private readonly config: ConfigService,
  ) {}

  async publish(videoId: string): Promise<PublishResult> {
    const video = await this.videos.findById(videoId);
    if (!video) {
      throw new VideoNotFoundError(videoId);
    }
    if (video.status === VideoStatus.PUBLISHED && video.youtubeVideoId) {
      return { kind: 'already-published', youtubeVideoId: video.youtubeVideoId };
    }
    if (video.status !== VideoStatus.APPROVED) {
      throw new PublishConflictError(`Video is ${video.status}, expected APPROVED`);
    }

    const filePath = resolvePreviewFilePath(video);
    if (!filePath) {
      await this.fail(videoId, 'PUBLISH_FAILED', 'Preview MP4 not found under output/');
      throw new Error('PUBLISH_FAILED: Preview MP4 not found under output/');
    }

    try {
      const uploaded = await this.youtube.upload({
        title: video.title,
        description: video.description ?? '',
        tags: video.tags,
        filePath,
        privacyStatus: this.privacyStatus(),
        categoryId: this.config.get<string>('YOUTUBE_CATEGORY_ID', '22'),
        containsSyntheticMedia: this.config.get<string>('YOUTUBE_CONTAINS_SYNTHETIC_MEDIA', 'true') !== 'false',
      });
      await this.videos.markPublished(videoId, uploaded.youtubeVideoId);
      await this.logs.appendStage({
        videoId,
        stage: 'PUBLISH',
        success: true,
        provider: 'youtube',
      });
      return { kind: 'published', youtubeVideoId: uploaded.youtubeVideoId };
    } catch (error) {
      if (isQuotaExceeded(error)) {
        const retryAt = nextPacificQuotaReset();
        await this.videos.setStatus(videoId, VideoStatus.APPROVED, { errorReason: 'QUOTA_EXCEEDED' });
        await this.logs.appendStage({
          videoId,
          stage: 'PUBLISH',
          success: false,
          provider: 'youtube',
          errorDetail: error instanceof Error ? error.message : String(error),
        });
        this.logger.warn(`Quota exceeded for ${videoId}; retry after ${retryAt.toISOString()}`);
        return { kind: 'quota-exceeded', retryAt };
      }

      const reason = isAuthFailure(error) ? 'AUTH_FAILED' : 'PUBLISH_REJECTED';
      const detail = error instanceof Error ? error.message : String(error);
      await this.fail(videoId, reason, detail);
      throw new Error(`${reason}: ${detail}`);
    }
  }

  private async fail(videoId: string, reason: string, detail: string): Promise<void> {
    await this.videos.setStatus(videoId, VideoStatus.ERROR, { errorReason: reason });
    await this.logs.appendStage({
      videoId,
      stage: 'PUBLISH',
      success: false,
      provider: 'youtube',
      errorDetail: detail,
    });
  }

  private privacyStatus(): YoutubePrivacyStatus {
    const raw = (this.config.get<string>('YOUTUBE_PRIVACY_STATUS', 'unlisted') || 'unlisted').toLowerCase();
    if (raw === 'public' || raw === 'private' || raw === 'unlisted') {
      return raw;
    }
    return 'unlisted';
  }
}

import { Injectable } from '@nestjs/common';
import { VideoStatus } from '@prisma/client';
import { PrismaService } from './prisma.service';
import { GeneratedScript, VisualClip } from '../pipeline/types/script.types';
import {
  PublishConflictError,
  ReviewConflictError,
  ReviewValidationError,
  VideoNotFoundError,
} from './video-review.errors';

const VIDEO_LIST_SELECT = {
  id: true,
  title: true,
  status: true,
  errorReason: true,
  createdAt: true,
  reviewedAt: true,
} as const;

const VIDEO_DETAIL_SELECT = {
  id: true,
  title: true,
  status: true,
  errorReason: true,
  createdAt: true,
  reviewedAt: true,
  description: true,
  tags: true,
  script: true,
  runDir: true,
  videoUrl: true,
  reviewedBy: true,
  reviewNotes: true,
  characterId: true,
  hookType: true,
  youtubeVideoId: true,
  publishedAt: true,
} as const;

export type VideoListItem = {
  id: string;
  title: string;
  status: VideoStatus;
  errorReason: string | null;
  createdAt: Date;
  reviewedAt: Date | null;
};

export type VideoDetail = VideoListItem & {
  description: string | null;
  tags: string[];
  script: string | null;
  runDir: string | null;
  videoUrl: string | null;
  reviewedBy: string | null;
  reviewNotes: string | null;
  characterId: string | null;
  hookType: string | null;
  youtubeVideoId: string | null;
  publishedAt: Date | null;
};

export type ReviewAction = 'approve' | 'reject';

export interface ReviewInput {
  action: ReviewAction;
  notes?: string;
  reviewedBy: string;
}

export interface CreateQueuedVideoInput {
  topicHint: string;
  characterId?: string;
  runDir?: string;
}

export interface VideoStatusPatch {
  errorReason?: string | null;
  title?: string;
  description?: string | null;
  script?: string | null;
  tags?: string[];
  characterId?: string | null;
  videoUrl?: string | null;
  runDir?: string | null;
  hookType?: string | null;
}

@Injectable()
export class VideoLifecycleService {
  constructor(private readonly prisma: PrismaService) {}

  async createQueued(input: CreateQueuedVideoInput): Promise<{ id: string }> {
    const video = await this.prisma.video.create({
      data: {
        title: input.topicHint.slice(0, 255),
        status: VideoStatus.QUEUED,
        characterId: input.characterId,
        runDir: input.runDir,
      },
      select: { id: true },
    });
    return video;
  }

  async findByRunDir(runDir: string): Promise<{ id: string } | null> {
    return this.prisma.video.findFirst({
      where: { runDir },
      orderBy: { createdAt: 'desc' },
      select: { id: true },
    });
  }

  async list(status?: VideoStatus): Promise<VideoListItem[]> {
    return this.prisma.video.findMany({
      where: status ? { status } : undefined,
      orderBy: { createdAt: 'desc' },
      select: VIDEO_LIST_SELECT,
    });
  }

  async findById(id: string): Promise<VideoDetail | null> {
    return this.prisma.video.findUnique({
      where: { id },
      select: VIDEO_DETAIL_SELECT,
    });
  }

  async review(id: string, input: ReviewInput): Promise<VideoDetail> {
    if (input.action === 'reject' && !input.notes?.trim()) {
      throw new ReviewValidationError('Reject requires notes');
    }

    const current = await this.prisma.video.findUnique({
      where: { id },
      select: { id: true, status: true },
    });
    if (!current) {
      throw new VideoNotFoundError(id);
    }
    if (current.status !== VideoStatus.READY_FOR_REVIEW) {
      throw new ReviewConflictError(
        `Video is ${current.status}, expected READY_FOR_REVIEW`,
      );
    }

    const status = input.action === 'approve' ? VideoStatus.APPROVED : VideoStatus.REJECTED;
    return this.prisma.video.update({
      where: { id },
      data: {
        status,
        reviewedAt: new Date(),
        reviewedBy: input.reviewedBy.trim().slice(0, 100) || 'operator',
        reviewNotes: input.notes?.trim() || null,
      },
      select: VIDEO_DETAIL_SELECT,
    });
  }

  async markPublished(id: string, youtubeVideoId: string): Promise<VideoDetail> {
    const current = await this.prisma.video.findUnique({
      where: { id },
      select: { id: true, status: true, youtubeVideoId: true },
    });
    if (!current) {
      throw new VideoNotFoundError(id);
    }
    if (current.status === VideoStatus.PUBLISHED && current.youtubeVideoId) {
      const existing = await this.findById(id);
      if (!existing) {
        throw new VideoNotFoundError(id);
      }
      return existing;
    }
    if (current.status !== VideoStatus.APPROVED) {
      throw new PublishConflictError(`Video is ${current.status}, expected APPROVED`);
    }

    return this.prisma.video.update({
      where: { id },
      data: {
        status: VideoStatus.PUBLISHED,
        youtubeVideoId: youtubeVideoId.trim().slice(0, 50),
        publishedAt: new Date(),
        errorReason: null,
      },
      select: VIDEO_DETAIL_SELECT,
    });
  }

  async setStatus(id: string, status: VideoStatus, patch: VideoStatusPatch = {}): Promise<void> {
    await this.prisma.video.update({
      where: { id },
      data: {
        status,
        errorReason: patch.errorReason === undefined ? undefined : patch.errorReason,
        title: patch.title,
        description: patch.description,
        script: patch.script,
        tags: patch.tags,
        characterId: patch.characterId,
        videoUrl: patch.videoUrl,
        runDir: patch.runDir,
        hookType: patch.hookType,
      },
    });
  }

  async applyScript(id: string, script: GeneratedScript, characterId?: string): Promise<void> {
    await this.prisma.video.update({
      where: { id },
      data: {
        title: script.titulo.slice(0, 255),
        description: script.descripcion,
        script: script.guion_locucion,
        tags: script.etiquetas,
        characterId: characterId ?? undefined,
      },
    });
  }

  async addAssets(videoId: string, clips: VisualClip[]): Promise<void> {
    if (clips.length === 0) return;
    await this.prisma.videoAsset.createMany({
      data: clips.map((clip) => ({
        videoId,
        assetType: clip.kind === 'still' ? 'compose' : 'visual',
        source: clip.source,
        sourceAssetId: clip.sourceAssetId,
        licenseType: clip.licenseType,
        licenseUrl: clip.licenseUrl,
      })),
    });
  }

  async setEmbedding(videoId: string, embedding: number[]): Promise<void> {
    const literal = `[${embedding.join(',')}]`;
    await this.prisma.$executeRawUnsafe(
      'UPDATE videos SET embedding = $1::vector WHERE id = $2::uuid',
      literal,
      videoId,
    );
  }
}

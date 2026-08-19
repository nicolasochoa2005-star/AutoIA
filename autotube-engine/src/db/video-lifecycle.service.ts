import { Injectable } from '@nestjs/common';
import { VideoStatus } from '@prisma/client';
import { PrismaService } from './prisma.service';
import { GeneratedScript, VisualClip } from '../pipeline/types/script.types';

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

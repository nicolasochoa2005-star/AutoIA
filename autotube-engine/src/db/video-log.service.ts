import { Injectable } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { StageLogInput } from './video-log.types';

@Injectable()
export class VideoLogService {
  constructor(private readonly prisma: PrismaService) {}

  async appendStage(input: StageLogInput): Promise<void> {
    await this.prisma.videoLog.create({
      data: {
        videoId: input.videoId,
        stage: input.stage,
        success: input.success,
        provider: input.provider,
        costUsd: input.costUsd ?? 0,
        errorDetail: input.errorDetail,
        attempt: input.attempt ?? 1,
        nodeId: input.nodeId,
      },
    });
  }
}

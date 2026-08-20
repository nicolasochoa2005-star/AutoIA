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

  async sumCostUsd(params: { since?: Date; videoId?: string } = {}): Promise<number> {
    const result = await this.prisma.videoLog.aggregate({
      _sum: { costUsd: true },
      where: {
        videoId: params.videoId,
        createdAt: params.since ? { gte: params.since } : undefined,
      },
    });
    return Number(result._sum.costUsd ?? 0);
  }

  async spendByProvider(since?: Date): Promise<{ provider: string; costUsd: number }[]> {
    const rows = await this.prisma.videoLog.groupBy({
      by: ['provider'],
      _sum: { costUsd: true },
      where: {
        createdAt: since ? { gte: since } : undefined,
        provider: { not: null },
      },
    });
    return rows.map((row) => ({
      provider: row.provider ?? 'unknown',
      costUsd: Number(row._sum.costUsd ?? 0),
    }));
  }

  async latestQuotaExceededAt(): Promise<Date | null> {
    const row = await this.prisma.video.findFirst({
      where: { errorReason: 'QUOTA_EXCEEDED' },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    });
    return row?.createdAt ?? null;
  }
}

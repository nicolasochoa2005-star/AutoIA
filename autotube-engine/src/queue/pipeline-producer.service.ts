import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { Queue } from 'bullmq';
import { VideoLifecycleService } from '../db/video-lifecycle.service';
import { VIDEO_GENERATION_QUEUE, VideoGenerationJobData } from './pipeline.queue';

@Injectable()
export class PipelineProducerService {
  private readonly logger = new Logger(PipelineProducerService.name);

  constructor(
    @InjectQueue(VIDEO_GENERATION_QUEUE) private readonly queue: Queue<VideoGenerationJobData>,
    private readonly config: ConfigService,
    private readonly videos: VideoLifecycleService,
  ) {}

  async enqueue(topicHint: string): Promise<string> {
    const video = await this.videos.createQueued({ topicHint });
    const job = await this.queue.add(
      'generate-video',
      { topicHint, videoId: video.id },
      { attempts: 1, removeOnComplete: 100, removeOnFail: 500 },
    );
    this.logger.log(`Job encolado (${job.id}, video ${video.id}): "${topicHint}"`);
    return String(job.id);
  }

  /**
   * CRON 1 (diario), ver FuncionalDoc.md sección 2.1. El horario y el tema
   * base son configurables por env; en Fase 3 el tema vendrá de un backlog
   * gestionado desde el Dashboard en vez de una única variable fija.
   */
  @Cron(process.env.DAILY_CRON_SCHEDULE || '0 9 * * *', { name: 'daily-generation' })
  async handleDailyGeneration(): Promise<void> {
    const topicHint = this.config.get<string>('NICHE_TOPIC', 'curiosidades del espacio');
    this.logger.log(`Disparando generación diaria programada para: "${topicHint}"`);
    await this.enqueue(topicHint);
  }
}

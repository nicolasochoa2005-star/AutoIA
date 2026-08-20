import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { DbModule } from '../db/db.module';
import { PipelineProducerService } from './pipeline-producer.service';
import { VIDEO_GENERATION_QUEUE } from './pipeline.queue';
import { PublishProducerService } from '../publish/publish-producer.service';
import { VIDEO_PUBLISH_QUEUE } from '../publish/publish.queue';
import { AnalyticsProducerService } from '../analytics/analytics-producer.service';
import { VIDEO_ANALYTICS_QUEUE } from '../analytics/analytics.queue';

/**
 * Módulo liviano para procesos que solo encolan jobs (CLI de enqueue, cron
 * diario) sin registrar ningún @Processor — así no terminan también
 * consumiendo/procesando jobs, responsabilidad exclusiva de WorkerModule.
 */
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    DbModule,
    ScheduleModule.forRoot(),
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: {
          host: config.get<string>('REDIS_HOST', 'localhost'),
          port: config.get<number>('REDIS_PORT', 6379),
        },
      }),
    }),
    BullModule.registerQueue({ name: VIDEO_GENERATION_QUEUE }),
    BullModule.registerQueue({ name: VIDEO_PUBLISH_QUEUE }),
    BullModule.registerQueue({ name: VIDEO_ANALYTICS_QUEUE }),
  ],
  providers: [PipelineProducerService, PublishProducerService, AnalyticsProducerService],
  exports: [PipelineProducerService, PublishProducerService, AnalyticsProducerService],
})
export class ProducerModule {}

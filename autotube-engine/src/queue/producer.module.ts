import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { PipelineProducerService } from './pipeline-producer.service';
import { VIDEO_GENERATION_QUEUE } from './pipeline.queue';

/**
 * Módulo liviano para procesos que solo encolan jobs (CLI de enqueue, cron
 * diario) sin registrar ningún @Processor — así no terminan también
 * consumiendo/procesando jobs, responsabilidad exclusiva de WorkerModule.
 */
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
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
  ],
  providers: [PipelineProducerService],
  exports: [PipelineProducerService],
})
export class ProducerModule {}

import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { ProducerModule } from './queue/producer.module';
import { PipelineProducerService } from './queue/pipeline-producer.service';

const logger = new Logger('Enqueue');

async function bootstrap() {
  const topicHint = process.argv[2];
  if (!topicHint) {
    logger.error('Uso: npm run enqueue -- "<tema sugerido>"');
    process.exit(1);
  }

  const app = await NestFactory.createApplicationContext(ProducerModule, {
    logger: ['log', 'warn', 'error'],
  });

  const producer = app.get(PipelineProducerService);
  const jobId = await producer.enqueue(topicHint);
  logger.log(`Job ${jobId} encolado. Corré "npm run worker" para procesarlo.`);

  await app.close();
}

bootstrap();

import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { ProducerModule } from './queue/producer.module';
import { PublishProducerService } from './publish/publish-producer.service';

const logger = new Logger('Publish');

async function bootstrap() {
  const videoId = process.argv[2];
  if (!videoId) {
    logger.error('Uso: npm run publish -- <videoId>');
    process.exit(1);
  }

  const app = await NestFactory.createApplicationContext(ProducerModule, {
    logger: ['log', 'warn', 'error'],
  });
  const producer = app.get(PublishProducerService);
  const jobId = await producer.enqueue(videoId);
  logger.log(`Publish job ${jobId} encolado. Corré "npm run worker" para subirlo.`);
  await app.close();
}

void bootstrap();

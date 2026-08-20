import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { WorkerModule } from './queue/worker.module';

const logger = new Logger('Worker');

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(WorkerModule, {
    logger: ['log', 'warn', 'error'],
  });

  logger.log('Worker iniciado. Escuchando video-generation, video-publish y video-analytics...');

  const shutdown = async () => {
    logger.log('Cerrando worker...');
    await app.close();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

bootstrap();

import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import * as path from 'path';
import { PipelineModule } from './pipeline/pipeline.module';
import { PipelineService } from './pipeline/pipeline.service';

const logger = new Logger('CLI');

async function bootstrap() {
  const topicHint = process.argv[2];
  if (!topicHint) {
    logger.error('Uso: npm run cli -- "<tema sugerido>"');
    process.exit(1);
  }

  const app = await NestFactory.createApplicationContext(PipelineModule, {
    logger: ['log', 'warn', 'error'],
  });

  const pipeline = app.get(PipelineService);
  const workDir = path.join(process.cwd(), 'output', `run_${Date.now()}`);

  try {
    const result = await pipeline.run(topicHint, workDir);
    logger.log(`Pipeline completo. Video listo en: ${result.render.videoPath}`);
    logger.log('Publicación NO ejecutada (pendiente de QA manual + Fase 4).');
  } catch (err) {
    logger.error(`Pipeline falló: ${(err as Error).message}`);
    process.exitCode = 1;
  } finally {
    await app.close();
  }
}

bootstrap();

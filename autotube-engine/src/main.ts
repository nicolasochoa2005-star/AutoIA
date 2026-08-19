import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './api/app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const origin = process.env.DASHBOARD_ORIGIN ?? 'http://localhost:3000';
  app.enableCors({ origin });
  const port = Number(process.env.ENGINE_PORT ?? 3001);
  await app.listen(port);
  new Logger('API').log(`Engine API listening on ${port} (CORS ${origin})`);
}

void bootstrap();

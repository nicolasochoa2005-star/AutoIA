import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import * as path from 'path';
import { PipelineModule } from './pipeline/pipeline.module';
import { PipelineService } from './pipeline/pipeline.service';
import { DEFAULT_STAGE_MODES, StageModesConfig, StageName } from './pipeline/manifest/manifest.types';
import { RunOptions } from './pipeline/run-options.types';
import { CliArgs, parseCliArgs } from './cli-args';

const logger = new Logger('CLI');
const STAGE_NAMES: StageName[] = ['script', 'tts', 'visuals', 'render'];

function buildStageModes(args: CliArgs): StageModesConfig {
  const modes: StageModesConfig = { ...DEFAULT_STAGE_MODES };
  if (args.interactive) {
    for (const stage of STAGE_NAMES) modes[stage] = 'pause';
  }
  for (const stage of STAGE_NAMES) {
    if (args.overridePaths[stage]) modes[stage] = 'override';
  }
  return modes;
}

async function bootstrap() {
  const args = parseCliArgs(process.argv.slice(2));

  if (!args.topicHint && !args.resumeDir) {
    logger.error(
      'Uso: npm run cli -- "<tema sugerido>" [--interactive] [--character <id>] [--narrative-profile autopilot|directed] [--tts-provider edge-tts|elevenlabs] [--identity-provider local|fal] [--prompt-override <texto>] [--compose-image <archivo>] [--background-music <archivo>] [--width <n>] [--height <n>] [--fps <n>] [--vcodec <codec>] [--acodec <codec>] [--duration <s>] [--resume <dir> [--from <etapa>]] [--override-<etapa> <archivo>]',
    );
    process.exit(1);
  }
  if (args.from && !STAGE_NAMES.includes(args.from)) {
    logger.error(`--from debe ser una de: ${STAGE_NAMES.join(', ')}`);
    process.exit(1);
  }
  if (args.ttsProvider && args.ttsProvider !== 'edge-tts' && args.ttsProvider !== 'elevenlabs') {
    logger.error('--tts-provider debe ser edge-tts o elevenlabs');
    process.exit(1);
  }
  if (args.identityProvider && args.identityProvider !== 'local' && args.identityProvider !== 'fal') {
    logger.error('--identity-provider debe ser local o fal');
    process.exit(1);
  }
  if (args.narrativeProfile && args.narrativeProfile !== 'autopilot' && args.narrativeProfile !== 'directed') {
    logger.error('--narrative-profile debe ser autopilot o directed');
    process.exit(1);
  }

  const app = await NestFactory.createApplicationContext(PipelineModule, {
    logger: ['log', 'warn', 'error'],
  });

  const pipeline = app.get(PipelineService);
  const runDir = path.resolve(
    args.resumeDir ?? path.join(process.cwd(), 'output', `run_${Date.now()}`),
  );

  const options: RunOptions = {
    topicHint: args.topicHint,
    runDir,
    modes: buildStageModes(args),
    characterId: args.characterId,
    ttsProvider: args.ttsProvider,
    identityProvider: args.identityProvider,
    narrativeProfile: args.narrativeProfile,
    overridePaths: args.overridePaths,
    resumeFrom: args.from,
    promptOverride: args.promptOverride,
    composeImagePaths: args.composeImagePaths.length ? args.composeImagePaths : undefined,
    backgroundMusicPath: args.backgroundMusicPath,
    render: Object.keys(args.render).length ? args.render : undefined,
  };

  try {
    const result = await pipeline.runWithOptions(options);
    logger.log(`Pipeline completo. Video listo en: ${result.render.videoPath}`);
    logger.log('Publicación NO ejecutada (pendiente de QA manual + Fase 4).');
  } catch (err) {
    logger.error(`Pipeline falló: ${(err as Error).message}`);
    logger.error(`Para reanudar: npm run cli -- "${args.topicHint}" --resume "${runDir}"`);
    process.exitCode = 1;
  } finally {
    await app.close();
  }
}

bootstrap();

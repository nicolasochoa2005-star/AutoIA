import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import * as path from 'path';
import { PipelineModule } from './pipeline/pipeline.module';
import { PipelineService } from './pipeline/pipeline.service';
import { DEFAULT_STAGE_MODES, StageModesConfig, StageName } from './pipeline/manifest/manifest.types';
import { RunOptions } from './pipeline/run-options.types';

const logger = new Logger('CLI');
const STAGE_NAMES: StageName[] = ['script', 'tts', 'visuals', 'render'];

interface CliArgs {
  topicHint: string;
  resumeDir?: string;
  from?: StageName;
  interactive: boolean;
  characterId?: string;
  overridePaths: Partial<Record<StageName, string>>;
}

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = { topicHint: '', interactive: false, overridePaths: {} };
  const positional: string[] = [];

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    switch (arg) {
      case '--resume':
        args.resumeDir = argv[++i];
        break;
      case '--from':
        args.from = argv[++i] as StageName;
        break;
      case '--interactive':
        args.interactive = true;
        break;
      case '--character':
        args.characterId = argv[++i];
        break;
      case '--override-script':
        args.overridePaths.script = argv[++i];
        break;
      case '--override-tts':
        args.overridePaths.tts = argv[++i];
        break;
      case '--override-visuals':
        args.overridePaths.visuals = argv[++i];
        break;
      case '--override-render':
        args.overridePaths.render = argv[++i];
        break;
      default:
        positional.push(arg);
    }
  }

  args.topicHint = positional.join(' ');
  return args;
}

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
  const args = parseArgs(process.argv.slice(2));

  if (!args.topicHint && !args.resumeDir) {
    logger.error(
      'Uso: npm run cli -- "<tema sugerido>" [--interactive] [--character <id>] [--resume <dir> [--from <etapa>]] [--override-<etapa> <archivo>]',
    );
    process.exit(1);
  }
  if (args.from && !STAGE_NAMES.includes(args.from)) {
    logger.error(`--from debe ser una de: ${STAGE_NAMES.join(', ')}`);
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
    overridePaths: args.overridePaths,
    resumeFrom: args.from,
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

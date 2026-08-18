import { Injectable, Logger } from '@nestjs/common';
import * as path from 'path';
import { TtsService } from './tts/tts.service';
import { VisualsService } from './visuals/visuals.service';
import { RenderService } from './render/render.service';
import { AntiRepetitionService } from './similarity/anti-repetition.service';
import { PipelineResult } from './types/script.types';

@Injectable()
export class PipelineService {
  private readonly logger = new Logger(PipelineService.name);

  constructor(
    private readonly antiRepetitionService: AntiRepetitionService,
    private readonly ttsService: TtsService,
    private readonly visualsService: VisualsService,
    private readonly renderService: RenderService,
  ) {}

  async run(topicHint: string, workDir: string): Promise<PipelineResult> {
    this.logger.log('Etapa 1/4: generando guion (con filtro anti-repetición)...');
    const { script, embedding, attempts } =
      await this.antiRepetitionService.generateNonRepetitive(topicHint);
    this.logger.log(`Guion generado en ${attempts} intento(s): "${script.titulo}"`);

    this.logger.log('Etapa 2/4: sintetizando locución...');
    const audio = await this.ttsService.synthesize(
      script.guion_locucion,
      path.join(workDir, 'audio'),
    );
    this.logger.log(`Audio generado (${(audio.durationMs / 1000).toFixed(1)}s)`);

    this.logger.log('Etapa 3/4: recolectando clips visuales...');
    const clips = await this.visualsService.fetchClips(
      script.prompts_visuales,
      path.join(workDir, 'clips'),
    );
    this.logger.log(`${clips.length} clip(s) descargado(s)`);

    this.logger.log('Etapa 4/4: renderizando video final...');
    const render = await this.renderService.render(
      clips,
      audio,
      path.join(workDir, 'render'),
    );
    this.logger.log(`Video renderizado en ${render.videoPath}`);

    // Aproximación de Fase 2: se registra en el histórico tras un render exitoso
    // (todavía no existe el estado PUBLISHED real, que llega con QA + DB en Fase 3).
    await this.antiRepetitionService.recordPublished(script, embedding);

    return { script, audio, clips, render };
  }
}

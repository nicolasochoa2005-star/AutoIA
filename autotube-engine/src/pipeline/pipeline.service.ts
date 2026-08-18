import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs/promises';
import * as path from 'path';
import { TtsService } from './tts/tts.service';
import { VisualsService } from './visuals/visuals.service';
import { RenderService } from './render/render.service';
import { AntiRepetitionService } from './similarity/anti-repetition.service';
import { GeneratedScript, PipelineResult, VisualBeat } from './types/script.types';
import { ManifestService } from './manifest/manifest.service';
import { StageGateService } from './manifest/stage-gate.service';
import { runPaths } from './manifest/run-paths';
import { DEFAULT_STAGE_MODES, RunManifest } from './manifest/manifest.types';
import { LibraryService } from './library/library.service';
import { CharacterBible } from './library/library.types';
import { RunOptions } from './run-options.types';

@Injectable()
export class PipelineService {
  private readonly logger = new Logger(PipelineService.name);

  constructor(
    private readonly antiRepetitionService: AntiRepetitionService,
    private readonly ttsService: TtsService,
    private readonly visualsService: VisualsService,
    private readonly renderService: RenderService,
    private readonly manifestService: ManifestService,
    private readonly stageGate: StageGateService,
    private readonly library: LibraryService,
  ) {}

  /** Firma simple usada por Fase 2 (queue/cli sin gates): siempre modo `auto`, sin resume. */
  async run(topicHint: string, runDir: string): Promise<PipelineResult> {
    return this.runWithOptions({ topicHint, runDir, modes: DEFAULT_STAGE_MODES });
  }

  async runWithOptions(options: RunOptions): Promise<PipelineResult> {
    const { runDir } = options;

    const character = options.characterId ? await this.library.loadCharacter(options.characterId) : undefined;

    let manifest = await this.manifestService.load(runDir);
    if (!manifest) {
      manifest = await this.manifestService.initialize(
        runDir,
        path.basename(runDir),
        options.topicHint,
        options.modes,
        options.characterId,
      );
    } else {
      options.topicHint = options.topicHint || manifest.topicHint;
      if (options.resumeFrom) {
        manifest = this.manifestService.invalidateFrom(manifest, options.resumeFrom);
      }
    }

    const { script, embedding } = await this.runScriptStage(options, manifest, character);
    const audio = await this.runTtsStage(options, manifest, script);
    const clips = await this.runVisualsStage(options, manifest, script);
    const render = await this.runRenderStage(options, manifest, clips, audio);

    // Aproximación de Fase 2: se registra en el histórico tras un render exitoso
    // (todavía no existe el estado PUBLISHED real, que llega con QA + DB en Fase 3).
    await this.antiRepetitionService.recordPublished(script, embedding);

    return { script, audio, clips, render };
  }

  private async runScriptStage(
    options: RunOptions,
    manifest: RunManifest,
    character: CharacterBible | undefined,
  ): Promise<{ script: GeneratedScript; embedding: number[] }> {
    const paths = runPaths(options.runDir);

    if (this.manifestService.isStageDone(manifest, 'script')) {
      this.logger.log('Etapa 1/4 (guion): ya completada, se reutiliza el artefacto.');
      const script = await this.loadScriptArtifact(paths.script);
      const embedding = await this.antiRepetitionService.embedForResume(script);
      return { script, embedding };
    }

    this.logger.log('Etapa 1/4: generando guion (con filtro anti-repetición)...');
    const mode = this.manifestService.getMode(manifest, 'script');

    const { script, embedding } = await this.stageGate.gate({
      mode,
      overridePath: options.overridePaths?.script,
      expectedPaths: [paths.script],
      slotDir: options.runDir,
      interactiveLabel: 'guion (01_script.json)',
      loadExisting: async () => {
        const loaded = await this.loadScriptArtifact(paths.script);
        const emb = await this.antiRepetitionService.embedForResume(loaded);
        return { script: loaded, embedding: emb };
      },
      generate: async () => {
        const result = await this.antiRepetitionService.generateNonRepetitive(
          options.topicHint,
          character,
        );
        await fs.writeFile(paths.script, JSON.stringify(result.script, null, 2), 'utf-8');
        return { script: result.script, embedding: result.embedding };
      },
    });

    this.logger.log(`Guion listo: "${script.titulo}"`);
    await this.manifestService.markDone(options.runDir, manifest, 'script', [paths.script]);
    return { script, embedding };
  }

  private async runTtsStage(options: RunOptions, manifest: RunManifest, script: GeneratedScript) {
    const paths = runPaths(options.runDir);

    if (this.manifestService.isStageDone(manifest, 'tts')) {
      this.logger.log('Etapa 2/4 (TTS): ya completada, se reutiliza el artefacto.');
      return this.ttsService.loadExisting(paths.audioDir);
    }

    this.logger.log('Etapa 2/4: sintetizando locución...');
    const mode = this.manifestService.getMode(manifest, 'tts');

    const audio = await this.stageGate.gate({
      mode,
      overridePath: options.overridePaths?.tts,
      expectedPaths: [paths.audio, paths.subtitles],
      slotDir: paths.audioDir,
      interactiveLabel: 'audio (02_audio/voice.mp3 + subtitles.ass)',
      loadExisting: () => this.ttsService.loadExisting(paths.audioDir),
      generate: () => this.ttsService.synthesize(script.guion_locucion, paths.audioDir),
    });

    this.logger.log(`Audio listo (${(audio.durationMs / 1000).toFixed(1)}s)`);
    await this.manifestService.markDone(options.runDir, manifest, 'tts', [paths.audio, paths.subtitles]);
    return audio;
  }

  private async runVisualsStage(options: RunOptions, manifest: RunManifest, script: GeneratedScript) {
    const paths = runPaths(options.runDir);
    const beats: VisualBeat[] =
      script.beats_visuales && script.beats_visuales.length > 0
        ? script.beats_visuales
        : script.prompts_visuales.map((prompt) => ({ prompt }));

    if (this.manifestService.isStageDone(manifest, 'visuals')) {
      this.logger.log('Etapa 3/4 (visuales): ya completada, se reutilizan los artefactos.');
      return this.visualsService.loadExisting(paths.visualsDir);
    }

    this.logger.log('Etapa 3/4: recolectando clips visuales...');
    const mode = this.manifestService.getMode(manifest, 'visuals');

    const clips = await this.stageGate.gate({
      mode,
      overridePath: options.overridePaths?.visuals,
      expectedPaths: [paths.visualsDir],
      slotDir: paths.visualsDir,
      interactiveLabel: 'visuales (03_visuals/)',
      loadExisting: () => this.visualsService.loadExisting(paths.visualsDir),
      generate: () => this.visualsService.fetchClips(beats, paths.visualsDir),
    });

    this.logger.log(`${clips.length} clip(s) listo(s)`);
    await this.manifestService.markDone(options.runDir, manifest, 'visuals', [paths.visualsDir]);
    return clips;
  }

  private async runRenderStage(
    options: RunOptions,
    manifest: RunManifest,
    clips: Awaited<ReturnType<VisualsService['fetchClips']>>,
    audio: Awaited<ReturnType<TtsService['synthesize']>>,
  ) {
    const paths = runPaths(options.runDir);

    if (this.manifestService.isStageDone(manifest, 'render')) {
      this.logger.log('Etapa 4/4 (render): ya completada, se reutiliza el artefacto.');
      return { videoPath: paths.render, durationMs: audio.durationMs };
    }

    this.logger.log('Etapa 4/4: renderizando video final...');
    const mode = this.manifestService.getMode(manifest, 'render');

    const render = await this.stageGate.gate({
      mode,
      overridePath: options.overridePaths?.render,
      expectedPaths: [paths.render],
      slotDir: paths.renderDir,
      interactiveLabel: 'render (04_render/final.mp4)',
      loadExisting: async () => ({ videoPath: paths.render, durationMs: audio.durationMs }),
      generate: () => this.renderService.render(clips, audio, paths.renderDir),
    });

    this.logger.log(`Video listo en ${render.videoPath}`);
    await this.manifestService.markDone(options.runDir, manifest, 'render', [paths.render]);
    return render;
  }

  private async loadScriptArtifact(scriptPath: string): Promise<GeneratedScript> {
    const raw = await fs.readFile(scriptPath, 'utf-8');
    return JSON.parse(raw) as GeneratedScript;
  }
}

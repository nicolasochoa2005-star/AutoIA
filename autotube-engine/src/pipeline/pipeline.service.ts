import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs/promises';
import * as path from 'path';
import { VideoStatus } from '@prisma/client';
import { TtsService } from './tts/tts.service';
import { VisualsService } from './visuals/visuals.service';
import { RenderService } from './render/render.service';
import { AntiRepetitionService } from './similarity/anti-repetition.service';
import { ScriptService } from './script/script.service';
import { GeneratedScript, PipelineResult, VisualBeat, VisualClip } from './types/script.types';
import { ManifestService } from './manifest/manifest.service';
import { StageGateService } from './manifest/stage-gate.service';
import { runPaths } from './manifest/run-paths';
import { DEFAULT_STAGE_MODES, RunManifest } from './manifest/manifest.types';
import { LibraryService } from './library/library.service';
import { CharacterBible } from './library/library.types';
import { RunOptions } from './run-options.types';
import { VideoLifecycleService } from '../db/video-lifecycle.service';
import { VideoLogService } from '../db/video-log.service';
import { PipelineStageName } from '../db/video-status';

@Injectable()
export class PipelineService {
  private readonly logger = new Logger(PipelineService.name);

  constructor(
    private readonly antiRepetitionService: AntiRepetitionService,
    private readonly scriptService: ScriptService,
    private readonly ttsService: TtsService,
    private readonly visualsService: VisualsService,
    private readonly renderService: RenderService,
    private readonly manifestService: ManifestService,
    private readonly stageGate: StageGateService,
    private readonly library: LibraryService,
    private readonly videos: VideoLifecycleService,
    private readonly videoLogs: VideoLogService,
  ) {}

  /** Firma simple usada por Fase 2 (queue/cli sin gates): siempre modo `auto`, sin resume. */
  async run(topicHint: string, runDir: string): Promise<PipelineResult> {
    return this.runWithOptions({ topicHint, runDir, modes: DEFAULT_STAGE_MODES });
  }

  async runWithOptions(options: RunOptions): Promise<PipelineResult> {
    const { runDir } = options;
    options.videoId = await this.ensureVideoId(options);

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

    await this.antiRepetitionService.recordPublished(script, embedding, options.videoId);
    if (options.videoId) {
      await this.videos.setStatus(options.videoId, VideoStatus.READY_FOR_REVIEW, {
        videoUrl: render.videoPath,
        errorReason: null,
      });
    }

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
    await this.setVideoStatus(options.videoId, VideoStatus.GENERATING_SCRIPT);
    const mode = this.manifestService.getMode(manifest, 'script');

    const { script, embedding } = await this.withStageLog(options.videoId, 'SCRIPT', () =>
      this.stageGate.gate({
        mode,
        overridePath: options.overridePaths?.script,
        expectedPaths: [paths.script],
        slotDir: options.runDir,
        interactiveLabel: 'guion (01_script.json)',
        onWaiting: () => this.setVideoStatus(options.videoId, VideoStatus.WAITING_FOR_INPUT),
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
      }),
      () => this.scriptService.lastSuccessfulProvider ?? 'gemini',
    );

    this.logger.log(`Guion listo: "${script.titulo}"`);
    if (options.videoId) {
      await this.videos.applyScript(options.videoId, script, options.characterId);
    }
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
    await this.setVideoStatus(options.videoId, VideoStatus.SYNTHESIZING_AUDIO);
    const mode = this.manifestService.getMode(manifest, 'tts');

    const audio = await this.withStageLog(options.videoId, 'TTS', () =>
      this.stageGate.gate({
        mode,
        overridePath: options.overridePaths?.tts,
        expectedPaths: [paths.audio, paths.subtitles],
        slotDir: paths.audioDir,
        interactiveLabel: 'audio (02_audio/voice.mp3 + subtitles.ass)',
        onWaiting: () => this.setVideoStatus(options.videoId, VideoStatus.WAITING_FOR_INPUT),
        loadExisting: () => this.ttsService.loadExisting(paths.audioDir),
        generate: () => this.ttsService.synthesize(script.guion_locucion, paths.audioDir),
      }),
      () => 'edge-tts',
    );

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
    await this.setVideoStatus(options.videoId, VideoStatus.COLLECTING_VISUALS);
    const mode = this.manifestService.getMode(manifest, 'visuals');

    const clips = await this.withStageLog(options.videoId, 'VISUALS', () =>
      this.stageGate.gate({
        mode,
        overridePath: options.overridePaths?.visuals,
        expectedPaths: [paths.visualsDir],
        slotDir: paths.visualsDir,
        interactiveLabel: 'visuales (03_visuals/)',
        onWaiting: () => this.setVideoStatus(options.videoId, VideoStatus.WAITING_FOR_INPUT),
        loadExisting: () => this.visualsService.loadExisting(paths.visualsDir),
        generate: () => this.visualsService.fetchClips(beats, paths.visualsDir),
      }),
      (result) => this.visualsProvider(result),
    );

    this.logger.log(`${clips.length} clip(s) listo(s)`);
    if (options.videoId) {
      await this.videos.addAssets(options.videoId, clips);
    }
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
    await this.setVideoStatus(options.videoId, VideoStatus.RENDERING_VIDEO);
    const mode = this.manifestService.getMode(manifest, 'render');

    const render = await this.withStageLog(options.videoId, 'RENDER', () =>
      this.stageGate.gate({
        mode,
        overridePath: options.overridePaths?.render,
        expectedPaths: [paths.render],
        slotDir: paths.renderDir,
        interactiveLabel: 'render (04_render/final.mp4)',
        onWaiting: () => this.setVideoStatus(options.videoId, VideoStatus.WAITING_FOR_INPUT),
        loadExisting: async () => ({ videoPath: paths.render, durationMs: audio.durationMs }),
        generate: () => this.renderService.render(clips, audio, paths.renderDir),
      }),
      () => 'ffmpeg',
    );

    this.logger.log(`Video listo en ${render.videoPath}`);
    await this.manifestService.markDone(options.runDir, manifest, 'render', [paths.render]);
    return render;
  }

  private async loadScriptArtifact(scriptPath: string): Promise<GeneratedScript> {
    const raw = await fs.readFile(scriptPath, 'utf-8');
    return JSON.parse(raw) as GeneratedScript;
  }

  private async ensureVideoId(options: RunOptions): Promise<string> {
    if (options.videoId) {
      await this.videos.setStatus(options.videoId, VideoStatus.QUEUED, { runDir: options.runDir });
      return options.videoId;
    }
    const existing = await this.videos.findByRunDir(options.runDir);
    if (existing) return existing.id;
    const created = await this.videos.createQueued({
      topicHint: options.topicHint || path.basename(options.runDir),
      characterId: options.characterId,
      runDir: options.runDir,
    });
    return created.id;
  }

  private async setVideoStatus(videoId: string | undefined, status: VideoStatus): Promise<void> {
    if (!videoId) return;
    await this.videos.setStatus(videoId, status, status === VideoStatus.WAITING_FOR_INPUT ? {} : { errorReason: null });
  }

  private async withStageLog<T>(
    videoId: string | undefined,
    stage: PipelineStageName,
    fn: () => Promise<T>,
    providerOf: (result?: T) => string | undefined,
  ): Promise<T> {
    try {
      const result = await fn();
      if (videoId) {
        await this.videoLogs.appendStage({
          videoId,
          stage,
          success: true,
          provider: providerOf(result),
        });
      }
      return result;
    } catch (error) {
      if (videoId) {
        await this.videoLogs.appendStage({
          videoId,
          stage,
          success: false,
          provider: providerOf(),
          errorDetail: error instanceof Error ? error.message : String(error),
        });
      }
      throw error;
    }
  }

  private visualsProvider(clips?: VisualClip[]): string {
    if (!clips || clips.length === 0) return 'pexels';
    return clips.some((c) => c.source === 'pexels') ? 'pexels' : 'local';
  }
}

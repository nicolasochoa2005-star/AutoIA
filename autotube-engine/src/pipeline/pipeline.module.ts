import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DbModule } from '../db/db.module';
import { ScriptService } from './script/script.service';
import { GeminiProvider } from './script/providers/gemini.provider';
import { GroqProvider } from './script/providers/groq.provider';
import { TtsService } from './tts/tts.service';
import { VisualsService } from './visuals/visuals.service';
import { RenderService } from './render/render.service';
import { PipelineService } from './pipeline.service';
import { EmbeddingService } from './similarity/embedding.service';
import { AntiRepetitionService } from './similarity/anti-repetition.service';
import { PostgresScriptHistoryStore } from './similarity/postgres-history-store';
import { HISTORY_STORE } from './similarity/history-store.token';
import { ManifestService } from './manifest/manifest.service';
import { StageGateService } from './manifest/stage-gate.service';
import { LibraryService } from './library/library.service';
import { ComposeService } from './compose/compose.service';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), DbModule],
  providers: [
    ScriptService,
    GeminiProvider,
    GroqProvider,
    TtsService,
    VisualsService,
    RenderService,
    PipelineService,
    EmbeddingService,
    AntiRepetitionService,
    ManifestService,
    StageGateService,
    LibraryService,
    ComposeService,
    { provide: HISTORY_STORE, useClass: PostgresScriptHistoryStore },
  ],
  exports: [PipelineService],
})
export class PipelineModule {}

import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScriptService } from './script/script.service';
import { GeminiProvider } from './script/providers/gemini.provider';
import { GroqProvider } from './script/providers/groq.provider';
import { TtsService } from './tts/tts.service';
import { VisualsService } from './visuals/visuals.service';
import { RenderService } from './render/render.service';
import { PipelineService } from './pipeline.service';
import { EmbeddingService } from './similarity/embedding.service';
import { AntiRepetitionService } from './similarity/anti-repetition.service';
import { FileScriptHistoryStore } from './similarity/file-history-store';
import { HISTORY_STORE } from './similarity/history-store.token';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true })],
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
    { provide: HISTORY_STORE, useClass: FileScriptHistoryStore },
  ],
  exports: [PipelineService],
})
export class PipelineModule {}

import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScriptService } from './script/script.service';
import { TtsService } from './tts/tts.service';
import { VisualsService } from './visuals/visuals.service';
import { RenderService } from './render/render.service';
import { PipelineService } from './pipeline.service';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true })],
  providers: [ScriptService, TtsService, VisualsService, RenderService, PipelineService],
  exports: [PipelineService],
})
export class PipelineModule {}

import { Module } from '@nestjs/common';
import { PipelineModule } from '../pipeline/pipeline.module';
import { ProducerModule } from './producer.module';
import { PipelineProcessor } from './pipeline.processor';
import { JobLogStore } from './job-log-store';

/**
 * Proceso consumidor real (equivalente al "Generation Worker" del diagrama,
 * FuncionalDoc.md sección 2.1). Importa ProducerModule para heredar la
 * conexión a Redis/la cola ya registrada, y agrega el @Processor que
 * efectivamente ejecuta el pipeline.
 */
@Module({
  imports: [ProducerModule, PipelineModule],
  providers: [PipelineProcessor, JobLogStore],
})
export class WorkerModule {}

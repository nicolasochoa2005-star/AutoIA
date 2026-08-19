import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { VideoLifecycleService } from './video-lifecycle.service';
import { VideoLogService } from './video-log.service';

@Global()
@Module({
  providers: [PrismaService, VideoLifecycleService, VideoLogService],
  exports: [PrismaService, VideoLifecycleService, VideoLogService],
})
export class DbModule {}

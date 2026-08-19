import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DbModule } from '../db/db.module';
import { VideosModule } from './videos.module';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), DbModule, VideosModule],
})
export class AppModule {}

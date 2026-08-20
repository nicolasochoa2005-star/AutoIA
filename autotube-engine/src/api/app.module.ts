import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DbModule } from '../db/db.module';
import { VideosModule } from './videos.module';
import { AnalyticsModule } from '../analytics/analytics.module';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), DbModule, VideosModule, AnalyticsModule],
})
export class AppModule {}

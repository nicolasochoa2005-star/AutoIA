import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { google } from 'googleapis';
import type { YoutubeAnalyticsClient, YoutubeVideoMetrics } from './youtube-analytics.client';

@Injectable()
export class GoogleYoutubeAnalyticsClient implements YoutubeAnalyticsClient {
  constructor(private readonly config: ConfigService) {}

  async fetchVideoMetrics(
    youtubeVideoId: string,
    startDate: string,
    endDate: string,
  ): Promise<YoutubeVideoMetrics> {
    const auth = this.oauth();
    const analytics = google.youtubeAnalytics({ version: 'v2', auth });
    const channelId = this.config.get<string>('YOUTUBE_CHANNEL_ID');
    if (!channelId) {
      throw new Error('AUTH_FAILED: missing YOUTUBE_CHANNEL_ID');
    }

    const base = await analytics.reports.query({
      ids: `channel==${channelId}`,
      startDate,
      endDate,
      metrics: 'views,likes,comments,averageViewPercentage',
      filters: `video==${youtubeVideoId}`,
    });
    const row = (base.data.rows?.[0] ?? []) as number[];
    const metrics: YoutubeVideoMetrics = {
      views: Number(row[0] ?? 0),
      likes: Number(row[1] ?? 0),
      comments: Number(row[2] ?? 0),
      retentionRate: Number(row[3] ?? 0) / 100,
      estimatedRevenue: 0,
    };

    try {
      const money = await analytics.reports.query({
        ids: `channel==${channelId}`,
        startDate,
        endDate,
        metrics: 'estimatedRevenue',
        filters: `video==${youtubeVideoId}`,
      });
      metrics.estimatedRevenue = Number((money.data.rows?.[0] as number[] | undefined)?.[0] ?? 0);
    } catch {
      metrics.estimatedRevenue = 0;
    }

    return metrics;
  }

  private oauth() {
    const clientId = this.config.get<string>('GOOGLE_CLIENT_ID');
    const clientSecret = this.config.get<string>('GOOGLE_CLIENT_SECRET');
    const refreshToken = this.config.get<string>('YOUTUBE_REFRESH_TOKEN');
    if (!clientId || !clientSecret || !refreshToken) {
      throw new Error('AUTH_FAILED: missing YouTube OAuth env');
    }
    const auth = new google.auth.OAuth2(clientId, clientSecret);
    auth.setCredentials({ refresh_token: refreshToken });
    return auth;
  }
}

export const YOUTUBE_ANALYTICS_CLIENT = Symbol('YOUTUBE_ANALYTICS_CLIENT');

export interface YoutubeVideoMetrics {
  views: number;
  likes: number;
  comments: number;
  retentionRate: number;
  estimatedRevenue: number;
}

export interface YoutubeAnalyticsClient {
  fetchVideoMetrics(youtubeVideoId: string, startDate: string, endDate: string): Promise<YoutubeVideoMetrics>;
}

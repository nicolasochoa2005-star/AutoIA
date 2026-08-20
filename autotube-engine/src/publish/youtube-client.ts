export const YOUTUBE_CLIENT = Symbol('YOUTUBE_CLIENT');

export type YoutubePrivacyStatus = 'unlisted' | 'public' | 'private';

export interface YoutubeUploadInput {
  title: string;
  description: string;
  tags: string[];
  filePath: string;
  privacyStatus: YoutubePrivacyStatus;
  categoryId: string;
  containsSyntheticMedia: boolean;
}

export interface YoutubeClient {
  upload(input: YoutubeUploadInput): Promise<{ youtubeVideoId: string }>;
}

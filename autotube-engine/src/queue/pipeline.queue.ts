export const VIDEO_GENERATION_QUEUE = 'video-generation';

export interface VideoGenerationJobData {
  topicHint: string;
  videoId: string;
}

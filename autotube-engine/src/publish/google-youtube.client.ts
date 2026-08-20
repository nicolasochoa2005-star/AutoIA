import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { google } from 'googleapis';
import * as fs from 'fs';
import type { YoutubeClient, YoutubeUploadInput } from './youtube-client';

@Injectable()
export class GoogleYoutubeClient implements YoutubeClient {
  constructor(private readonly config: ConfigService) {}

  async upload(input: YoutubeUploadInput): Promise<{ youtubeVideoId: string }> {
    const clientId = this.config.get<string>('GOOGLE_CLIENT_ID');
    const clientSecret = this.config.get<string>('GOOGLE_CLIENT_SECRET');
    const refreshToken = this.config.get<string>('YOUTUBE_REFRESH_TOKEN');
    if (!clientId || !clientSecret || !refreshToken) {
      throw new Error('AUTH_FAILED: missing GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, or YOUTUBE_REFRESH_TOKEN');
    }

    const auth = new google.auth.OAuth2(clientId, clientSecret);
    auth.setCredentials({ refresh_token: refreshToken });
    const youtube = google.youtube({ version: 'v3', auth });

    const response = await youtube.videos.insert({
      part: ['snippet', 'status'],
      requestBody: {
        snippet: {
          title: input.title.slice(0, 100),
          description: input.description,
          tags: input.tags,
          categoryId: input.categoryId,
        },
        status: {
          privacyStatus: input.privacyStatus,
          selfDeclaredMadeForKids: false,
          containsSyntheticMedia: input.containsSyntheticMedia,
        },
      },
      media: {
        body: fs.createReadStream(input.filePath),
      },
    });

    const youtubeVideoId = response.data.id;
    if (!youtubeVideoId) {
      throw new Error('PUBLISH_FAILED: YouTube did not return a video id');
    }
    return { youtubeVideoId };
  }
}

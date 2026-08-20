import { Module } from '@nestjs/common';
import { GoogleYoutubeClient } from './google-youtube.client';
import { PublishService } from './publish.service';
import { YOUTUBE_CLIENT } from './youtube-client';

@Module({
  providers: [
    PublishService,
    GoogleYoutubeClient,
    { provide: YOUTUBE_CLIENT, useExisting: GoogleYoutubeClient },
  ],
  exports: [PublishService],
})
export class PublishModule {}

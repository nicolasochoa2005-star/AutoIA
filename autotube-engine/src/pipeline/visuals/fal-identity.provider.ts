import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';

@Injectable()
export class FalIdentityProvider {
  readonly name = 'fal';
  private readonly logger = new Logger(FalIdentityProvider.name);

  constructor(private readonly config: ConfigService) {}

  async generateStill(prompt: string, destPath: string): Promise<void> {
    const apiKey = this.config.get<string>('FAL_KEY');
    if (!apiKey) {
      throw new Error('AUTH_FAILED: missing FAL_KEY');
    }
    this.logger.log(`Fal still: ${prompt.slice(0, 80)}`);
    const response = await axios.post(
      this.config.get<string>('FAL_IDENTITY_MODEL', 'https://fal.run/fal-ai/flux/schnell'),
      {
        prompt: `${prompt}, vertical 9:16 portrait still, cinematic`,
        image_size: 'portrait_16_9',
        num_images: 1,
      },
      {
        headers: { Authorization: `Key ${apiKey}`, 'Content-Type': 'application/json' },
        timeout: 120_000,
      },
    );
    const url = response.data?.images?.[0]?.url as string | undefined;
    if (!url) {
      throw new Error('NO_VISUAL_MATCH: Fal no devolvió una imagen');
    }
    const image = await axios.get(url, { responseType: 'stream' });
    await pipeline(image.data, createWriteStream(destPath));
  }
}

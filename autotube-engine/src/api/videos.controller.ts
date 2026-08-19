import {
  BadRequestException,
  ConflictException,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  Query,
  Body,
  Res,
} from '@nestjs/common';
import { VideoStatus } from '@prisma/client';
import type { Response } from 'express';
import { VideoLifecycleService } from '../db/video-lifecycle.service';
import { ReviewConflictError, ReviewValidationError, VideoNotFoundError } from '../db/video-review.errors';
import { resolvePreviewFilePath } from './preview-path';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type ReviewBody = {
  action?: string;
  notes?: string;
  reviewedBy?: string;
};

@Controller('videos')
export class VideosController {
  constructor(private readonly videos: VideoLifecycleService) {}

  @Get()
  async list(@Query('status') status?: string) {
    return this.videos.list(this.parseStatus(status));
  }

  @Get(':id/preview')
  async preview(@Param('id') id: string, @Res() res: Response): Promise<void> {
    if (!UUID_RE.test(id)) {
      res.status(400).json({ statusCode: 400, message: 'Invalid video id' });
      return;
    }
    const video = await this.videos.findById(id);
    if (!video) {
      res.status(404).json({ statusCode: 404, message: `Video ${id} not found` });
      return;
    }
    const filePath = resolvePreviewFilePath(video);
    if (!filePath) {
      res.status(404).json({ statusCode: 404, message: 'Preview file not found' });
      return;
    }
    res.sendFile(filePath, {
      headers: {
        'Content-Type': 'video/mp4',
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'private, max-age=0, must-revalidate',
      },
    });
  }

  @Get(':id')
  async getOne(@Param('id') id: string) {
    return this.requireVideo(id);
  }

  @Post(':id/review')
  async review(@Param('id') id: string, @Body() body: ReviewBody) {
    this.assertId(id);
    const action = body?.action;
    if (action !== 'approve' && action !== 'reject') {
      throw new BadRequestException('action must be approve or reject');
    }
    const reviewedBy = (body?.reviewedBy || process.env.OPERATOR_NAME || 'operator').trim();
    try {
      return await this.videos.review(id, {
        action,
        notes: body?.notes,
        reviewedBy,
      });
    } catch (error) {
      this.rethrowReview(error);
    }
  }

  private parseStatus(status?: string): VideoStatus | undefined {
    if (!status) {
      return undefined;
    }
    if (!Object.values(VideoStatus).includes(status as VideoStatus)) {
      throw new BadRequestException(`Unknown status: ${status}`);
    }
    return status as VideoStatus;
  }

  private assertId(id: string): void {
    if (!UUID_RE.test(id)) {
      throw new BadRequestException('Invalid video id');
    }
  }

  private async requireVideo(id: string) {
    this.assertId(id);
    const video = await this.videos.findById(id);
    if (!video) {
      throw new NotFoundException(`Video ${id} not found`);
    }
    return video;
  }

  private rethrowReview(error: unknown): never {
    if (error instanceof VideoNotFoundError) {
      throw new NotFoundException(error.message);
    }
    if (error instanceof ReviewConflictError) {
      throw new ConflictException(error.message);
    }
    if (error instanceof ReviewValidationError) {
      throw new BadRequestException(error.message);
    }
    throw error;
  }
}

import { BadRequestException, Controller, Get, Query } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';

@Controller('metrics')
export class MetricsController {
  constructor(private readonly analytics: AnalyticsService) {}

  @Get('summary')
  summary(@Query('days') days?: string) {
    const parsed = Number(days ?? 7);
    if (![7, 30, 90].includes(parsed)) {
      throw new BadRequestException('days must be 7, 30 or 90');
    }
    return this.analytics.summary(parsed);
  }

  @Get('spend')
  spend() {
    return this.analytics.spend();
  }

  @Get('health')
  health() {
    return this.analytics.health();
  }
}

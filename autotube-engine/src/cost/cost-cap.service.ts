import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { VideoLogService } from '../db/video-log.service';
import type { PaidOnCap } from './cost-rates';

@Injectable()
export class CostCapService {
  constructor(
    private readonly config: ConfigService,
    private readonly logs: VideoLogService,
  ) {}

  onCap(): PaidOnCap {
    const raw = (this.config.get<string>('PAID_ON_CAP', 'zero') || 'zero').toLowerCase();
    return raw === 'waiting' ? 'waiting' : 'zero';
  }

  async canAfford(estimateUsd: number, videoId?: string): Promise<boolean> {
    const runCap = this.numberEnv('PAID_COST_CAP_USD_PER_RUN');
    const dayCap = this.numberEnv('PAID_COST_CAP_USD_PER_DAY');
    if (runCap <= 0 && dayCap <= 0) {
      return true;
    }

    if (runCap > 0 && videoId) {
      const runSpent = await this.logs.sumCostUsd({ videoId });
      if (runSpent + estimateUsd > runCap) {
        return false;
      }
    }

    if (dayCap > 0) {
      const startOfUtcDay = new Date();
      startOfUtcDay.setUTCHours(0, 0, 0, 0);
      const daySpent = await this.logs.sumCostUsd({ since: startOfUtcDay });
      if (daySpent + estimateUsd > dayCap) {
        return false;
      }
    }

    return true;
  }

  capExceededError(): Error {
    if (this.onCap() === 'waiting') {
      return new Error('WAITING_FOR_INPUT: tope de costo pago alcanzado, esperando fallback manual');
    }
    return new Error('PAID_CAP_EXCEEDED: tope de costo, usar proveedor $0');
  }

  private numberEnv(key: string): number {
    const raw = this.config.get<string>(key, '0');
    const value = Number(raw);
    return Number.isFinite(value) ? value : 0;
  }
}

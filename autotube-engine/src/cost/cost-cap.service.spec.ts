import { CostCapService } from './cost-cap.service';
import { VideoLogService } from '../db/video-log.service';
import { ConfigService } from '@nestjs/config';

describe('CostCapService', () => {
  const logs = { sumCostUsd: jest.fn() };
  const config = {
    get: jest.fn((key: string, fallback?: string) => {
      if (key === 'PAID_COST_CAP_USD_PER_RUN') return '1';
      if (key === 'PAID_COST_CAP_USD_PER_DAY') return '2';
      if (key === 'PAID_ON_CAP') return 'zero';
      return fallback;
    }),
  };
  const cap = new CostCapService(
    config as unknown as ConfigService,
    logs as unknown as VideoLogService,
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('blocks a paid call when the daily cap would be exceeded', async () => {
    logs.sumCostUsd.mockResolvedValue(1.9);
    await expect(cap.canAfford(0.2, 'v1')).resolves.toBe(false);
  });

  it('allows a paid call under both caps', async () => {
    logs.sumCostUsd.mockResolvedValue(0.1);
    await expect(cap.canAfford(0.2, 'v1')).resolves.toBe(true);
  });
});

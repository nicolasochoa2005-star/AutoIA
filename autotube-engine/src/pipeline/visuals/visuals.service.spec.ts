import { ConfigService } from '@nestjs/config';
import { CostCapService } from '../../cost/cost-cap.service';
import { ComposeService } from '../compose/compose.service';
import { LibraryService } from '../library/library.service';
import { FalIdentityProvider } from './fal-identity.provider';
import { VisualsService } from './visuals.service';

describe('VisualsService Fal routing', () => {
  const library = { resolveScene: jest.fn() };
  const compose = { resolveBeatStill: jest.fn() };
  const fal = { generateStill: jest.fn() };
  const caps = { canAfford: jest.fn(), onCap: jest.fn(), capExceededError: jest.fn() };
  const config = {
    get: jest.fn((key: string, fallback?: string) => {
      if (key === 'IDENTITY_VISUAL_PROVIDER') return 'fal';
      if (key === 'PEXELS_API_KEY') return 'pexels';
      return fallback;
    }),
    getOrThrow: jest.fn().mockReturnValue('pexels'),
  };

  const service = new VisualsService(
    config as unknown as ConfigService,
    library as unknown as LibraryService,
    compose as unknown as ComposeService,
    fal as unknown as FalIdentityProvider,
    caps as unknown as CostCapService,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    library.resolveScene.mockResolvedValue(null);
    caps.canAfford.mockResolvedValue(true);
    caps.onCap.mockReturnValue('zero');
    config.get.mockImplementation((key: string, fallback?: string) => {
      if (key === 'IDENTITY_VISUAL_PROVIDER') return 'fal';
      if (key === 'PEXELS_API_KEY') return 'pexels';
      return fallback;
    });
  });

  it('does not call Fal when identity provider is local, even for character beats', async () => {
    config.get.mockImplementation((key: string, fallback?: string) => {
      if (key === 'IDENTITY_VISUAL_PROVIDER') return 'local';
      return fallback;
    });
    jest.spyOn(service as unknown as { exists: (p: string) => Promise<boolean> }, 'exists').mockResolvedValue(false);
    jest
      .spyOn(service as unknown as { fetchStockClip: (...args: unknown[]) => Promise<null> }, 'fetchStockClip')
      .mockResolvedValue({
        source: 'pexels',
        kind: 'video',
        sourceAssetId: '1',
        licenseType: 'Pexels',
        localPath: '/tmp/clip.mp4',
      } as never);

    await service.fetchClips(
      [{ prompt: 'ana en el lab', source_hint: 'character', subject_id: 'ana' }],
      '/tmp/visuals',
    );
    expect(fal.generateStill).not.toHaveBeenCalled();
  });

  it('does not call Fal for stock beats', async () => {
    jest.spyOn(service as unknown as { exists: (p: string) => Promise<boolean> }, 'exists').mockResolvedValue(false);
    jest
      .spyOn(service as unknown as { fetchStockClip: (...args: unknown[]) => Promise<null> }, 'fetchStockClip')
      .mockResolvedValue({
        source: 'pexels',
        kind: 'video',
        sourceAssetId: '1',
        licenseType: 'Pexels',
        localPath: '/tmp/clip.mp4',
      } as never);

    await service.fetchClips([{ prompt: 'nebula', source_hint: 'stock' }], '/tmp/visuals');
    expect(fal.generateStill).not.toHaveBeenCalled();
  });

  it('does not call Fal when the daily cap is full', async () => {
    caps.canAfford.mockResolvedValue(false);
    jest.spyOn(service as unknown as { exists: (p: string) => Promise<boolean> }, 'exists').mockResolvedValue(false);
    jest
      .spyOn(service as unknown as { fetchStockClip: (...args: unknown[]) => Promise<null> }, 'fetchStockClip')
      .mockResolvedValue({
        source: 'pexels',
        kind: 'video',
        sourceAssetId: '1',
        licenseType: 'Pexels',
        localPath: '/tmp/clip.mp4',
      } as never);

    await service.fetchClips(
      [{ prompt: 'ana en el lab', source_hint: 'character', subject_id: 'ana' }],
      '/tmp/visuals',
    );
    expect(fal.generateStill).not.toHaveBeenCalled();
  });

  it('calls Fal for character beats when the identity provider is fal', async () => {
    jest.spyOn(service as unknown as { exists: (p: string) => Promise<boolean> }, 'exists').mockResolvedValue(false);
    fal.generateStill.mockResolvedValue(undefined);

    await service.fetchClips(
      [{ prompt: 'ana close-up', source_hint: 'character', subject_id: 'ana' }],
      '/tmp/visuals',
      { identityProvider: 'fal' },
    );
    expect(fal.generateStill).toHaveBeenCalledTimes(1);
  });
});

import { CostCapService } from '../../cost/cost-cap.service';
import { estimateElevenLabsUsd } from '../../cost/cost-rates';
import { EdgeTtsProvider } from './providers/edge-tts.provider';
import { ElevenLabsTtsProvider } from './providers/elevenlabs-tts.provider';
import { TtsService } from './tts.service';

describe('TtsService paid fallback', () => {
  const edge = { name: 'edge-tts', synthesize: jest.fn() };
  const eleven = { name: 'elevenlabs', synthesize: jest.fn() };
  const caps = { canAfford: jest.fn(), onCap: jest.fn(), capExceededError: jest.fn() };
  const config = { get: jest.fn().mockReturnValue('elevenlabs') };

  const service = new TtsService(
    config as never,
    edge as unknown as EdgeTtsProvider,
    eleven as unknown as ElevenLabsTtsProvider,
    caps as unknown as CostCapService,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    config.get.mockReturnValue('elevenlabs');
    caps.onCap.mockReturnValue('zero');
    edge.synthesize.mockResolvedValue({
      audioPath: 'a.mp3',
      subtitlesAssPath: 's.ass',
      words: [{ word: 'hola', startMs: 0, endMs: 200 }],
      durationMs: 200,
    });
  });

  it('uses Edge-TTS by default when TTS_PROVIDER is unset', async () => {
    config.get.mockImplementation((_key: string, fallback?: string) => fallback ?? 'edge-tts');
    caps.canAfford.mockResolvedValue(true);
    await service.synthesize('hola', '/tmp/audio');
    expect(eleven.synthesize).not.toHaveBeenCalled();
    expect(edge.synthesize).toHaveBeenCalled();
    expect(service.lastProvider).toBe('edge-tts');
    expect(service.lastCostUsd).toBe(0);
  });

  it('does not call ElevenLabs when the daily cap is full and falls back to Edge-TTS', async () => {
    caps.canAfford.mockResolvedValue(false);
    await service.synthesize('hola mundo', '/tmp/audio', { videoId: 'v1' });
    expect(eleven.synthesize).not.toHaveBeenCalled();
    expect(edge.synthesize).toHaveBeenCalled();
    expect(service.lastProvider).toBe('edge-tts');
    expect(service.lastCostUsd).toBe(0);
  });

  it('fails when paid TTS returns no timestamps instead of writing empty ASS', async () => {
    caps.canAfford.mockResolvedValue(true);
    eleven.synthesize.mockRejectedValue(
      new Error('TTS_NO_TIMESTAMPS: ElevenLabs no devolvió marcas de tiempo por palabra'),
    );
    await expect(service.synthesize('hola', '/tmp/audio')).rejects.toThrow(/^TTS_NO_TIMESTAMPS:/);
    expect(edge.synthesize).not.toHaveBeenCalled();
  });

  it('estimates cost before a paid call', () => {
    expect(estimateElevenLabsUsd('a'.repeat(1000))).toBeCloseTo(0.015);
  });
});

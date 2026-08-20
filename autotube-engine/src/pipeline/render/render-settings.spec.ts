import { resolveRenderSettings, rewriteAssPlayRes } from './render-settings';

describe('render-settings', () => {
  it('usa 1080x1920@60 libx264/aac por defecto', () => {
    expect(resolveRenderSettings()).toEqual({
      width: 1080,
      height: 1920,
      fps: 60,
      vcodec: 'libx264',
      acodec: 'aac',
      durationSec: undefined,
    });
  });

  it('reescribe PlayRes del ASS al tamaño de la corrida', () => {
    const ass = 'PlayResX: 1080\nPlayResY: 1920\n';
    expect(rewriteAssPlayRes(ass, 1280, 720)).toBe('PlayResX: 1280\nPlayResY: 720\n');
  });
});

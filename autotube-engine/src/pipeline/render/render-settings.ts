export interface RenderSettings {
  width: number;
  height: number;
  fps: number;
  vcodec: string;
  acodec: string;
  durationSec?: number;
}

export const DEFAULT_RENDER_SETTINGS: RenderSettings = {
  width: 1080,
  height: 1920,
  fps: 60,
  vcodec: 'libx264',
  acodec: 'aac',
};

export function resolveRenderSettings(partial?: Partial<RenderSettings> | null): RenderSettings {
  return {
    width: partial?.width ?? DEFAULT_RENDER_SETTINGS.width,
    height: partial?.height ?? DEFAULT_RENDER_SETTINGS.height,
    fps: partial?.fps ?? DEFAULT_RENDER_SETTINGS.fps,
    vcodec: partial?.vcodec ?? DEFAULT_RENDER_SETTINGS.vcodec,
    acodec: partial?.acodec ?? DEFAULT_RENDER_SETTINGS.acodec,
    durationSec: partial?.durationSec,
  };
}

export function rewriteAssPlayRes(ass: string, width: number, height: number): string {
  return ass
    .replace(/PlayResX:\s*\d+/i, `PlayResX: ${width}`)
    .replace(/PlayResY:\s*\d+/i, `PlayResY: ${height}`);
}

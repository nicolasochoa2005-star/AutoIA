import { parseCliArgs } from './cli-args';

describe('parseCliArgs', () => {
  it('lee flags de render, BGM, compose y prompt', () => {
    const args = parseCliArgs([
      'tema de prueba',
      '--prompt-override', 'lookbook streetwear',
      '--compose-image', 'a.jpg',
      '--compose-image', 'b.jpg',
      '--background-music', 'bgm.mp3',
      '--width', '1280',
      '--height', '720',
      '--fps', '25',
      '--vcodec', 'libx264',
      '--acodec', 'aac',
      '--duration', '5',
    ]);

    expect(args.topicHint).toBe('tema de prueba');
    expect(args.promptOverride).toBe('lookbook streetwear');
    expect(args.composeImagePaths).toEqual(['a.jpg', 'b.jpg']);
    expect(args.backgroundMusicPath).toBe('bgm.mp3');
    expect(args.render).toEqual({
      width: 1280,
      height: 720,
      fps: 25,
      vcodec: 'libx264',
      acodec: 'aac',
      durationSec: 5,
    });
  });
});

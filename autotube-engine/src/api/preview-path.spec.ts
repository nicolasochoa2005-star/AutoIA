import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { resolvePreviewFilePath } from './preview-path';

describe('resolvePreviewFilePath', () => {
  let cwd: string;
  let mp4: string;

  beforeEach(() => {
    cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'preview-'));
    const renderDir = path.join(cwd, 'output', 'job_1', '04_render');
    fs.mkdirSync(renderDir, { recursive: true });
    mp4 = path.join(renderDir, 'final.mp4');
    fs.writeFileSync(mp4, 'mp4');
  });

  afterEach(() => {
    fs.rmSync(cwd, { recursive: true, force: true });
  });

  it('resolves via runDir under output/', () => {
    const resolved = resolvePreviewFilePath(
      { videoUrl: null, runDir: path.join(cwd, 'output', 'job_1') },
      cwd,
    );
    expect(resolved).toBe(fs.realpathSync(mp4));
  });

  it('resolves via videoUrl under output/', () => {
    const resolved = resolvePreviewFilePath({ videoUrl: mp4, runDir: null }, cwd);
    expect(resolved).toBe(fs.realpathSync(mp4));
  });

  it('rejects a path outside output/', () => {
    const outside = path.join(cwd, 'secret.mp4');
    fs.writeFileSync(outside, 'x');
    expect(resolvePreviewFilePath({ videoUrl: outside, runDir: null }, cwd)).toBeNull();
  });

  it('rejects traversal that escapes output/', () => {
    const escaped = path.join(cwd, 'output', '..', 'secret.mp4');
    fs.writeFileSync(path.join(cwd, 'secret.mp4'), 'x');
    expect(resolvePreviewFilePath({ videoUrl: escaped, runDir: null }, cwd)).toBeNull();
  });
});

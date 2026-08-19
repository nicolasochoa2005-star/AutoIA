import * as fs from 'fs';
import * as path from 'path';
import { runPaths } from '../pipeline/manifest/run-paths';

export function outputRoot(cwd = process.cwd()): string {
  const root = path.resolve(cwd, 'output');
  try {
    return fs.realpathSync(root);
  } catch {
    return root;
  }
}

export function isPathInside(child: string, parent: string): boolean {
  const relative = path.relative(parent, child);
  return relative !== '' && !relative.startsWith('..') && !path.isAbsolute(relative);
}

export function resolvePreviewFilePath(
  video: { videoUrl: string | null; runDir: string | null },
  cwd = process.cwd(),
): string | null {
  const root = outputRoot(cwd);
  const candidates: string[] = [];
  if (video.videoUrl) {
    candidates.push(video.videoUrl);
  }
  if (video.runDir) {
    candidates.push(runPaths(video.runDir).render);
  }

  for (const candidate of candidates) {
    const resolved = path.resolve(cwd, candidate);
    let real: string;
    try {
      real = fs.realpathSync(resolved);
    } catch {
      continue;
    }
    if (!isPathInside(real, root)) {
      continue;
    }
    try {
      if (fs.statSync(real).isFile()) {
        return real;
      }
    } catch {
      continue;
    }
  }

  return null;
}

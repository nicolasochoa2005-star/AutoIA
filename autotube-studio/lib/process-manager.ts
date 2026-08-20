import { spawn, ChildProcess } from 'child_process';
import * as path from 'path';
import { ENGINE_DIR, runDirFor } from './engine-paths';
import type { StageName } from './types';

interface RunProcess {
  child: ChildProcess;
  logs: string[];
  exited: boolean;
  exitCode: number | null;
}

const processes = new Map<string, RunProcess>();

const TS_NODE_BIN = path.join(ENGINE_DIR, 'node_modules', 'ts-node', 'dist', 'bin.js');
const CLI_ENTRY = path.join(ENGINE_DIR, 'src', 'cli.ts');

export function isRunning(runId: string): boolean {
  const p = processes.get(runId);
  return !!p && !p.exited;
}

export function hasProcess(runId: string): boolean {
  return processes.has(runId);
}

export interface StartRunOptions {
  characterId?: string;
  from?: StageName;
  ttsProvider?: 'edge-tts' | 'elevenlabs';
  identityProvider?: 'local' | 'fal';
  narrativeProfile?: 'autopilot' | 'directed';
  promptOverride?: string;
  composeImagePaths?: string[];
  backgroundMusicPath?: string;
  width?: number;
  height?: number;
  fps?: number;
  vcodec?: string;
  acodec?: string;
  durationSec?: number;
}

/** Arranca (o continúa) una corrida vía CLI en modo `--interactive`. */
export function startRun(runId: string, topicHint: string, opts: StartRunOptions = {}): void {
  if (isRunning(runId)) return;

  const args = [
    '-r', 'tsconfig-paths/register',
    CLI_ENTRY,
    topicHint,
    '--interactive',
    '--resume', runDirFor(runId),
  ];
  if (opts.characterId) args.push('--character', opts.characterId);
  if (opts.from) args.push('--from', opts.from);
  if (opts.ttsProvider) args.push('--tts-provider', opts.ttsProvider);
  if (opts.identityProvider) args.push('--identity-provider', opts.identityProvider);
  if (opts.narrativeProfile) args.push('--narrative-profile', opts.narrativeProfile);
  if (opts.promptOverride) args.push('--prompt-override', opts.promptOverride);
  for (const imagePath of opts.composeImagePaths ?? []) {
    args.push('--compose-image', imagePath);
  }
  if (opts.backgroundMusicPath) args.push('--background-music', opts.backgroundMusicPath);
  if (opts.width) args.push('--width', String(opts.width));
  if (opts.height) args.push('--height', String(opts.height));
  if (opts.fps) args.push('--fps', String(opts.fps));
  if (opts.vcodec) args.push('--vcodec', opts.vcodec);
  if (opts.acodec) args.push('--acodec', opts.acodec);
  if (opts.durationSec) args.push('--duration', String(opts.durationSec));

  const child = spawn(process.execPath, [TS_NODE_BIN, ...args], { cwd: ENGINE_DIR });
  const record: RunProcess = { child, logs: [], exited: false, exitCode: null };

  child.stdout?.on('data', (chunk: Buffer) => record.logs.push(chunk.toString()));
  child.stderr?.on('data', (chunk: Buffer) => record.logs.push(chunk.toString()));
  child.on('close', (code) => {
    record.exited = true;
    record.exitCode = code;
  });

  processes.set(runId, record);
}

export function confirmWaiting(runId: string): boolean {
  const p = processes.get(runId);
  if (!p || p.exited || !p.child.stdin) return false;
  p.child.stdin.write('\n');
  return true;
}

export function getLogs(runId: string): string {
  return processes.get(runId)?.logs.join('') ?? '';
}

export function getProcessState(runId: string): { running: boolean; exitCode: number | null } {
  const p = processes.get(runId);
  if (!p) return { running: false, exitCode: null };
  return { running: !p.exited, exitCode: p.exitCode };
}

export function lastWaitingLabel(runId: string): string | null {
  const logs = getLogs(runId);
  const matches = [...logs.matchAll(/⏸[^\n]*/g)];
  return matches.length > 0 ? matches[matches.length - 1][0] : null;
}

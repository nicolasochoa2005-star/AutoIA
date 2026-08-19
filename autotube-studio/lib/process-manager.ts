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

// Next.js dev/prod corre en un único proceso Node; un Map a nivel de módulo
// alcanza para uso local de un operador (no está pensado para multi-instancia).
const processes = new Map<string, RunProcess>();

// Se invoca ts-node directo (vía `node`, sin `npm run` ni shell) para evitar
// dos problemas de Windows: `spawn EINVAL` al ejecutar `npm.cmd` sin shell, y
// el escapado roto de argumentos con espacios (ej. "...YT IA\...") que
// `shell: true` produce en cmd.exe. Sin shell, Node arma el argv correctamente.
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

/** Equivale a apretar ENTER en la terminal: confirma generar automáticamente la etapa en pausa. */
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

/** Última etiqueta de pausa emitida por el Engine (StageGateService/ComposeService), si la hay. */
export function lastWaitingLabel(runId: string): string | null {
  const logs = getLogs(runId);
  const matches = [...logs.matchAll(/⏸[^\n]*/g)];
  return matches.length > 0 ? matches[matches.length - 1][0] : null;
}

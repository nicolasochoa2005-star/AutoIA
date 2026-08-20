import type { Edge, Node } from '@xyflow/react';
import { getNodeDef } from './registry';
import { makeHandleId, type StudioNodeType } from './types';

export interface StudioNodeData extends Record<string, unknown> {
  label: string;
  nodeType: StudioNodeType;
  text?: string;
  fileName?: string;
  previewUrl?: string;
  ttsProvider?: 'edge-tts' | 'elevenlabs';
  identityProvider?: 'local' | 'fal';
  narrativeProfile?: 'autopilot' | 'directed';
  width?: number;
  height?: number;
  fps?: number;
  duration?: number;
  vcodec?: string;
  acodec?: string;
  filenamePrefix?: string;
}

export function defaultNodeData(type: StudioNodeType): StudioNodeData {
  const def = getNodeDef(type);
  const base: StudioNodeData = { label: def?.label ?? type, nodeType: type };
  switch (type) {
    case 'tts':
      return { ...base, ttsProvider: 'edge-tts' };
    case 'compose':
      return { ...base, identityProvider: 'local' };
    case 'script':
      return { ...base, narrativeProfile: 'autopilot' };
    case 'saveVideo':
      return {
        ...base,
        width: 1080,
        height: 1920,
        fps: 60,
        vcodec: 'libx264',
        acodec: 'aac',
        filenamePrefix: 'video/autotube',
      };
    default:
      return base;
  }
}

function node(
  id: string,
  type: StudioNodeType,
  x: number,
  y: number,
  extra?: Partial<StudioNodeData>,
): Node<StudioNodeData> {
  return {
    id,
    type: 'comfy',
    position: { x, y },
    data: { ...defaultNodeData(type), ...extra },
  };
}

function edge(
  id: string,
  source: string,
  sourceHandle: string,
  target: string,
  targetHandle: string,
): Edge {
  return { id, source, sourceHandle, target, targetHandle };
}

/** Plantilla Short cableable: prompt + guion + TTS + dos imágenes → compose → guardar video + BGM. */
export function buildDefaultTemplate(): { nodes: Node<StudioNodeData>[]; edges: Edge[] } {
  const nodes: Node<StudioNodeData>[] = [
    node('prompt', 'prompt', 0, 40),
    node('script', 'script', 280, 0),
    node('tts', 'tts', 560, 0),
    node('loadImage_subject', 'loadImage', 0, 280, { label: 'Imagen sujeto' }),
    node('loadImage_outfit', 'loadImage', 0, 500, { label: 'Imagen outfit' }),
    node('compose', 'compose', 280, 360),
    node('loadAudio', 'loadAudio', 560, 220),
    node('saveVideo', 'saveVideo', 840, 80),
  ];

  const edges: Edge[] = [
    edge('e-prompt-script', 'prompt', makeHandleId('out', 'TEXT', 'text'), 'script', makeHandleId('in', 'TEXT', 'prompt')),
    edge('e-prompt-compose', 'prompt', makeHandleId('out', 'TEXT', 'text'), 'compose', makeHandleId('in', 'TEXT', 'prompt')),
    edge('e-script-tts', 'script', makeHandleId('out', 'TEXT', 'narration'), 'tts', makeHandleId('in', 'TEXT', 'text')),
    edge(
      'e-tts-save',
      'tts',
      makeHandleId('out', 'AUDIO', 'audio'),
      'saveVideo',
      makeHandleId('in', 'AUDIO', 'voice'),
    ),
    edge(
      'e-subject-compose',
      'loadImage_subject',
      makeHandleId('out', 'IMAGE', 'image'),
      'compose',
      makeHandleId('in', 'IMAGE', 'subject'),
    ),
    edge(
      'e-outfit-compose',
      'loadImage_outfit',
      makeHandleId('out', 'IMAGE', 'image'),
      'compose',
      makeHandleId('in', 'IMAGE', 'outfit'),
    ),
    edge(
      'e-compose-save',
      'compose',
      makeHandleId('out', 'IMAGE', 'image'),
      'saveVideo',
      makeHandleId('in', 'IMAGE', 'frame'),
    ),
    edge(
      'e-audio-save',
      'loadAudio',
      makeHandleId('out', 'AUDIO', 'audio'),
      'saveVideo',
      makeHandleId('in', 'AUDIO', 'music'),
    ),
  ];

  return { nodes, edges };
}

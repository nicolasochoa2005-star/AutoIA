import { STUDIO_NODE_TYPES, type NodeDef, type StudioNodeType } from './types';

const DEFS: NodeDef[] = [
  {
    type: 'loadImage',
    label: 'Cargar imagen',
    category: 'image',
    inputs: [],
    outputs: [{ name: 'image', socket: 'IMAGE', label: 'imagen' }],
  },
  {
    type: 'prompt',
    label: 'Prompt',
    category: 'text',
    inputs: [],
    outputs: [{ name: 'text', socket: 'TEXT', label: 'texto' }],
  },
  {
    type: 'compose',
    label: 'Compose',
    category: 'image',
    inputs: [
      { name: 'subject', socket: 'IMAGE', label: 'sujeto' },
      { name: 'outfit', socket: 'IMAGE', label: 'outfit' },
      { name: 'prompt', socket: 'TEXT', label: 'prompt' },
    ],
    outputs: [{ name: 'image', socket: 'IMAGE', label: 'imagen' }],
  },
  {
    type: 'script',
    label: 'Guion',
    category: 'text',
    inputs: [{ name: 'prompt', socket: 'TEXT', label: 'prompt' }],
    outputs: [
      { name: 'script', socket: 'SCRIPT', label: 'guion' },
      { name: 'narration', socket: 'TEXT', label: 'locución' },
    ],
  },
  {
    type: 'tts',
    label: 'TTS',
    category: 'audio',
    inputs: [{ name: 'text', socket: 'TEXT', label: 'texto' }],
    outputs: [{ name: 'audio', socket: 'AUDIO', label: 'audio' }],
  },
  {
    type: 'loadAudio',
    label: 'Banda sonora',
    category: 'audio',
    inputs: [],
    outputs: [{ name: 'audio', socket: 'AUDIO', label: 'audio' }],
  },
  {
    type: 'saveVideo',
    label: 'Guardar video',
    category: 'output',
    inputs: [
      { name: 'frame', socket: 'IMAGE', label: 'imagen' },
      { name: 'voice', socket: 'AUDIO', label: 'voz' },
      { name: 'music', socket: 'AUDIO', label: 'música' },
    ],
    outputs: [{ name: 'video', socket: 'VIDEO', label: 'video' }],
  },
];

const BY_TYPE = new Map<StudioNodeType, NodeDef>(DEFS.map((d) => [d.type, d]));

export function listNodeDefs(): NodeDef[] {
  return DEFS;
}

export function getNodeDef(type: string): NodeDef | undefined {
  if (!STUDIO_NODE_TYPES.includes(type as StudioNodeType)) return undefined;
  return BY_TYPE.get(type as StudioNodeType);
}

export function isStudioNodeType(type: string): type is StudioNodeType {
  return STUDIO_NODE_TYPES.includes(type as StudioNodeType);
}

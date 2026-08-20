export const SOCKET_TYPES = ['IMAGE', 'TEXT', 'AUDIO', 'VIDEO', 'SCRIPT'] as const;
export type SocketType = (typeof SOCKET_TYPES)[number];

export const STUDIO_NODE_TYPES = [
  'loadImage',
  'prompt',
  'compose',
  'script',
  'tts',
  'loadAudio',
  'saveVideo',
] as const;
export type StudioNodeType = (typeof STUDIO_NODE_TYPES)[number];

export type NodeCategory = 'image' | 'text' | 'audio' | 'output';

export interface SocketDef {
  name: string;
  socket: SocketType;
  label: string;
}

export interface NodeDef {
  type: StudioNodeType;
  label: string;
  category: NodeCategory;
  inputs: SocketDef[];
  outputs: SocketDef[];
}

export type HandleDir = 'in' | 'out';

export function makeHandleId(dir: HandleDir, socket: SocketType, name: string): string {
  return `${dir}:${socket}:${name}`;
}

export function parseHandleId(
  id: string | null | undefined,
): { dir: HandleDir; socket: SocketType; name: string } | null {
  if (!id) return null;
  const [dir, socket, name] = id.split(':');
  if ((dir !== 'in' && dir !== 'out') || !name) return null;
  if (!SOCKET_TYPES.includes(socket as SocketType)) return null;
  return { dir, socket: socket as SocketType, name };
}

export const SOCKET_COLORS: Record<SocketType, string> = {
  IMAGE: '#60a5fa',
  TEXT: '#f472b6',
  AUDIO: '#34d399',
  VIDEO: '#e5e7eb',
  SCRIPT: '#fb923c',
};

export const CATEGORY_COLORS: Record<NodeCategory, string> = {
  image: '#2563eb',
  text: '#db2777',
  audio: '#059669',
  output: '#6b7280',
};

import type { Edge, Node } from '@xyflow/react';
import { getNodeDef } from './registry';
import { parseHandleId, type StudioNodeType } from './types';
import type { StudioNodeData } from './template';

export interface CompiledRenderSettings {
  width: number;
  height: number;
  fps: number;
  vcodec: string;
  acodec: string;
  durationSec?: number;
  filenamePrefix?: string;
}

export interface CompiledRun {
  topicHint?: string;
  promptOverride?: string;
  ttsProvider?: 'edge-tts' | 'elevenlabs';
  identityProvider?: 'local' | 'fal';
  narrativeProfile?: 'autopilot' | 'directed';
  render: CompiledRenderSettings;
  composeImageNodeIds: string[];
  backgroundMusicNodeId?: string;
  hasVoiceCable: boolean;
}

function incoming(
  edges: Edge[],
  targetId: string,
  handleName: string,
): Edge | undefined {
  return edges.find((e) => {
    if (e.target !== targetId) return false;
    const parsed = parseHandleId(e.targetHandle);
    return parsed?.name === handleName;
  });
}

function nodeById(nodes: Node<StudioNodeData>[], id: string | undefined): Node<StudioNodeData> | undefined {
  if (!id) return undefined;
  return nodes.find((n) => n.id === id);
}

function textFrom(node: Node<StudioNodeData> | undefined): string {
  return typeof node?.data.text === 'string' ? node.data.text.trim() : '';
}

export function socketsCompatible(
  sourceHandle: string | null | undefined,
  targetHandle: string | null | undefined,
): boolean {
  const src = parseHandleId(sourceHandle);
  const tgt = parseHandleId(targetHandle);
  return Boolean(src && tgt && src.socket === tgt.socket && src.dir === 'out' && tgt.dir === 'in');
}

export function compileWorkflow(
  nodes: Node<StudioNodeData>[],
  edges: Edge[],
  fallbackTopic: string,
): CompiledRun {
  const script = nodes.find((n) => n.data.nodeType === 'script');
  const tts = nodes.find((n) => n.data.nodeType === 'tts');
  const compose = nodes.find((n) => n.data.nodeType === 'compose');
  const save = nodes.find((n) => n.data.nodeType === 'saveVideo');

  const promptToScript = script ? incoming(edges, script.id, 'prompt') : undefined;
  const scriptPromptNode = nodeById(nodes, promptToScript?.source);
  const topicFromPrompt = textFrom(scriptPromptNode);
  const topicHint = topicFromPrompt || fallbackTopic.trim() || undefined;

  const promptToCompose = compose ? incoming(edges, compose.id, 'prompt') : undefined;
  const composePromptNode = nodeById(nodes, promptToCompose?.source);
  const composePrompt = textFrom(composePromptNode) || undefined;
  const promptOverride = composePrompt && composePrompt !== topicHint ? composePrompt : undefined;

  const subjectEdge = compose ? incoming(edges, compose.id, 'subject') : undefined;
  const outfitEdge = compose ? incoming(edges, compose.id, 'outfit') : undefined;
  const composeImageNodeIds = [subjectEdge?.source, outfitEdge?.source].filter(
    (id): id is string => Boolean(id),
  );

  const musicEdge = save ? incoming(edges, save.id, 'music') : undefined;
  const voiceEdge = save ? incoming(edges, save.id, 'voice') : undefined;

  const render: CompiledRenderSettings = {
    width: Number(save?.data.width) || 1080,
    height: Number(save?.data.height) || 1920,
    fps: Number(save?.data.fps) || 60,
    vcodec: String(save?.data.vcodec || 'libx264'),
    acodec: String(save?.data.acodec || 'aac'),
    durationSec: save?.data.duration ? Number(save.data.duration) : undefined,
    filenamePrefix: String(save?.data.filenamePrefix || 'video/autotube'),
  };

  return {
    topicHint,
    promptOverride,
    ttsProvider: tts?.data.ttsProvider,
    identityProvider: compose?.data.identityProvider,
    narrativeProfile: script?.data.narrativeProfile,
    render,
    composeImageNodeIds,
    backgroundMusicNodeId: musicEdge?.source,
    hasVoiceCable: Boolean(voiceEdge),
  };
}

export function playStageForNode(nodeType: StudioNodeType): 'script' | 'tts' | 'visuals' | 'render' | null {
  switch (nodeType) {
    case 'script':
      return 'script';
    case 'tts':
      return 'tts';
    case 'compose':
      return 'visuals';
    case 'saveVideo':
      return 'render';
    default:
      return null;
  }
}

export function serializeWorkflow(
  nodes: Node<StudioNodeData>[],
  edges: Edge[],
): { nodes: Node<StudioNodeData>[]; edges: Edge[] } {
  return {
    nodes: nodes.map((n) => ({
      ...n,
      data: {
        label: n.data.label,
        nodeType: n.data.nodeType,
        text: n.data.text,
        fileName: n.data.fileName,
        ttsProvider: n.data.ttsProvider,
        identityProvider: n.data.identityProvider,
        narrativeProfile: n.data.narrativeProfile,
        width: n.data.width,
        height: n.data.height,
        fps: n.data.fps,
        duration: n.data.duration,
        vcodec: n.data.vcodec,
        acodec: n.data.acodec,
        filenamePrefix: n.data.filenamePrefix,
      },
    })),
    edges: edges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      sourceHandle: e.sourceHandle,
      targetHandle: e.targetHandle,
    })),
  };
}

export function hydrateWorkflow(raw: unknown): { nodes: Node<StudioNodeData>[]; edges: Edge[] } | null {
  if (!raw || typeof raw !== 'object') return null;
  const value = raw as { nodes?: unknown; edges?: unknown };
  if (!Array.isArray(value.nodes) || !Array.isArray(value.edges)) return null;
  const nodes: Node<StudioNodeData>[] = [];
  for (const item of value.nodes) {
    if (!item || typeof item !== 'object') continue;
    const n = item as Node<StudioNodeData>;
    if (!n.id || !n.data || !getNodeDef(String(n.data.nodeType))) continue;
    nodes.push({
      ...n,
      type: 'comfy',
      data: { ...n.data, nodeType: n.data.nodeType },
    });
  }
  if (nodes.length === 0) return null;
  return { nodes, edges: value.edges as Edge[] };
}

export type SerializedWorkflow = ReturnType<typeof serializeWorkflow>;

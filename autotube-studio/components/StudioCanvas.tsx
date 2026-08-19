'use client';

import { useMemo } from 'react';
import { ReactFlow, Background, Controls, type Node, type Edge, type NodeTypes } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { buildDefaultTemplate, DomainNodeData } from '@/lib/graph-layout';
import { DomainNode, RenderStatus, StudioNodeData } from './DomainNode';
import type { CharacterSummary, RunStatus, StageName } from '@/lib/types';

const nodeTypes: NodeTypes = { domain: DomainNode };

function artifactUrl(runId: string, relativePath: string): string {
  return `/api/runs/${runId}/artifact?path=${encodeURIComponent(relativePath)}`;
}

function stageStatus(status: RunStatus, stage: StageName): RenderStatus {
  const manifestStatus = status.manifest?.stages[stage]?.status ?? 'pending';
  if (manifestStatus === 'done') return 'done';
  if (status.activeStage === stage) {
    if (status.waiting) return 'waiting';
    if (status.running) return 'running';
  }
  return 'pending';
}

function composeBeatIndex(waitingLabel: string | null): number | null {
  const match = waitingLabel?.match(/beat_(\d+)\.jpg/);
  return match ? Number(match[1]) : null;
}

export interface StudioCanvasProps {
  status: RunStatus | null;
  characters: CharacterSummary[];
  selectedCharacterId?: string;
  onSelectCharacter: (id: string) => void;
  onPlay: () => void;
  onPlayNode: (stage: StageName) => void;
  onDrop: (slot: 'script' | 'render' | 'beat', file: File, beatIndex?: number) => void;
  onDropTts: (audio: File, subtitles: File) => void;
}

export function StudioCanvas(props: StudioCanvasProps) {
  const { status, characters, selectedCharacterId, onSelectCharacter, onPlay, onPlayNode, onDrop, onDropTts } = props;

  const { nodes, edges } = useMemo(() => {
    const template = buildDefaultTemplate();
    const running = status?.running ?? false;
    const waiting = status?.waiting ?? false;
    const waitingLabel = status?.waitingLabel ?? null;
    const beatIndex = composeBeatIndex(waitingLabel);
    // Deshabilitar botones solo mientras algo se está GENERANDO de verdad;
    // el proceso sigue "vivo" también mientras está en pausa esperando al
    // operador, que es justo cuando el botón Play debe estar habilitado.
    const busy = running && !waiting;

    const nodes: Node<StudioNodeData>[] = template.nodes.map((n) => {
      const base: DomainNodeData = n.data;
      let studioData: StudioNodeData = { ...base, status: 'idle', disabled: busy };

      if (!status) {
        return { ...n, data: studioData };
      }

      switch (base.nodeType) {
        case 'character':
          studioData = {
            ...studioData,
            status: selectedCharacterId ? 'done' : 'idle',
            characters,
            selectedCharacterId,
            onSelectCharacter,
          };
          break;
        case 'script': {
          const s = stageStatus(status, 'script');
          studioData = {
            ...studioData,
            status: s,
            waitingLabel: s === 'waiting' ? waitingLabel : null,
            onPlay: s === 'waiting' ? onPlay : undefined,
            onPlayNode: s === 'done' ? () => onPlayNode('script') : undefined,
            onDropFile: s === 'waiting' ? (file) => onDrop('script', file) : undefined,
          };
          break;
        }
        case 'tts': {
          const s = stageStatus(status, 'tts');
          studioData = {
            ...studioData,
            status: s,
            waitingLabel: s === 'waiting' ? waitingLabel : null,
            onPlay: s === 'waiting' ? onPlay : undefined,
            onPlayNode: s === 'done' ? () => onPlayNode('tts') : undefined,
          };
          break;
        }
        case 'visuals': {
          const s = stageStatus(status, 'visuals');
          studioData = {
            ...studioData,
            status: s,
            waitingLabel: s === 'waiting' ? waitingLabel : null,
            onPlay: s === 'waiting' ? onPlay : undefined,
            onPlayNode: s === 'done' ? () => onPlayNode('visuals') : undefined,
          };
          break;
        }
        case 'compose': {
          const visualsStatus = stageStatus(status, 'visuals');
          const isComposeWait =
            status.activeStage === 'visuals' && status.waiting && Boolean(waitingLabel?.includes('Compose'));
          const s: RenderStatus = isComposeWait ? 'waiting' : visualsStatus === 'waiting' ? 'pending' : visualsStatus;
          studioData = {
            ...studioData,
            status: s,
            waitingLabel: isComposeWait ? waitingLabel : null,
            onPlay: isComposeWait ? onPlay : undefined,
            onDropFile:
              isComposeWait && beatIndex
                ? (file) => onDrop('beat', file, beatIndex)
                : undefined,
          };
          break;
        }
        case 'render': {
          const s = stageStatus(status, 'render');
          const canPlay = stageStatus(status, 'tts') === 'done' && stageStatus(status, 'visuals') === 'done';
          studioData = {
            ...studioData,
            status: s,
            waitingLabel: s === 'waiting' ? waitingLabel : !canPlay ? 'Requiere TTS y Visuales listos antes de poder renderizar.' : null,
            onPlay: s === 'waiting' ? onPlay : undefined,
            onPlayNode: s === 'done' && canPlay ? () => onPlayNode('render') : undefined,
            onDropFile: s === 'waiting' ? (file) => onDrop('render', file) : undefined,
            thumbnailUrl:
              s === 'done' && status.manifest
                ? artifactUrl(status.runId, '04_render/final.mp4')
                : undefined,
          };
          break;
        }
        case 'preview': {
          const renderStatus = stageStatus(status, 'render');
          studioData = {
            ...studioData,
            status: renderStatus,
            thumbnailUrl:
              renderStatus === 'done' && status.manifest
                ? artifactUrl(status.runId, '04_render/final.mp4')
                : undefined,
          };
          break;
        }
      }

      return { ...n, data: studioData };
    });

    return { nodes, edges: template.edges as Edge[] };
  }, [status, characters, selectedCharacterId, onSelectCharacter, onPlay, onPlayNode, onDrop]);

  void onDropTts; // reservado para un dropzone dedicado de TTS (mp3+ass) si se necesita más adelante

  return (
    <div style={{ width: '100%', height: '70vh', background: '#0b1120' }}>
      <ReactFlow nodes={nodes} edges={edges} nodeTypes={nodeTypes} fitView>
        <Background />
        <Controls />
      </ReactFlow>
    </div>
  );
}

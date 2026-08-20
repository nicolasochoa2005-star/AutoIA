'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  addEdge,
  useEdgesState,
  useNodesState,
  type Connection,
  type Edge,
  type Node,
  type NodeTypes,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { ComfyNode, type ComfyNodeData, type RenderStatus } from './ComfyNode';
import { NodePalette } from './NodePalette';
import { compileWorkflow, hydrateWorkflow, playStageForNode, serializeWorkflow, socketsCompatible, type CompiledRun, type SerializedWorkflow } from '@/lib/nodes/compiler';
import { buildDefaultTemplate, defaultNodeData, type StudioNodeData } from '@/lib/nodes/template';
import { parseHandleId, SOCKET_COLORS, type StudioNodeType } from '@/lib/nodes/types';
import type { RunStatus, StageName } from '@/lib/types';

const nodeTypes: NodeTypes = { comfy: ComfyNode };
const WORKFLOW_KEY = 'autotube-studio:workflow';

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

function edgeStroke(edge: Edge): string {
  const parsed = parseHandleId(edge.sourceHandle);
  return parsed ? SOCKET_COLORS[parsed.socket] : '#6b7280';
}

export interface StudioCanvasProps {
  status: RunStatus | null;
  onPlay: () => void;
  onPlayNode: (stage: StageName) => void;
  onDrop: (slot: 'script' | 'render' | 'beat', file: File, beatIndex?: number) => void;
  onWorkflowChange?: (compiled: CompiledRun, files: Map<string, File>, serialized: SerializedWorkflow) => void;
}

export function StudioCanvas(props: StudioCanvasProps) {
  const { status, onPlay, onPlayNode, onDrop, onWorkflowChange } = props;
  const initial = useMemo(() => buildDefaultTemplate(), []);
  const [nodes, setNodes, onNodesChange] = useNodesState(initial.nodes as Node<ComfyNodeData>[]);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initial.edges);
  const filesRef = useRef<Map<string, File>>(new Map());
  const updateRef = useRef<(id: string, patch: Partial<StudioNodeData>) => void>(() => undefined);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(WORKFLOW_KEY);
      if (raw) {
        const stored = hydrateWorkflow(JSON.parse(raw));
        if (stored) {
          setNodes(stored.nodes as Node<ComfyNodeData>[]);
          setEdges(stored.edges);
        }
      }
    } catch {
      // ignore
    }
    setReady(true);
  }, [setNodes, setEdges]);

  updateRef.current = (id, patch) => {
    setNodes((nds) => nds.map((n) => (n.id === id ? { ...n, data: { ...n.data, ...patch } } : n)));
  };

  const persistAndCompile = useCallback(
    (nextNodes: Node<ComfyNodeData>[], nextEdges: Edge[]) => {
      const serialized = serializeWorkflow(nextNodes, nextEdges);
      try {
        window.localStorage.setItem(WORKFLOW_KEY, JSON.stringify(serialized));
      } catch {
        // quota / private mode
      }
      const compiled = compileWorkflow(nextNodes, nextEdges, '');
      onWorkflowChange?.(compiled, filesRef.current, serialized);
    },
    [onWorkflowChange],
  );

  useEffect(() => {
    if (!ready) return;
    persistAndCompile(nodes, edges);
  }, [ready, nodes, edges, persistAndCompile]);

  useEffect(() => {
    const running = status?.running ?? false;
    const waiting = status?.waiting ?? false;
    const waitingLabel = status?.waitingLabel ?? null;
    const beatIndex = composeBeatIndex(waitingLabel);
    const busy = running && !waiting;

    setNodes((nds) =>
      nds.map((n) => {
        const nodeType = n.data.nodeType;
        const overlay: Partial<ComfyNodeData> = {
          disabled: busy,
          onWidgetChange: (patch) => updateRef.current(n.id, patch),
          onPickFile: (file) => {
            filesRef.current.set(n.id, file);
            const previewUrl = file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined;
            updateRef.current(n.id, { fileName: file.name, previewUrl });
          },
        };

        if (!status) {
          return { ...n, data: { ...n.data, ...overlay, status: n.data.fileName || n.data.text ? 'done' : 'idle' } };
        }

        const stage = playStageForNode(nodeType);
        if (nodeType === 'compose') {
          const visualsStatus = stageStatus(status, 'visuals');
          const isComposeWait =
            status.activeStage === 'visuals' && status.waiting && Boolean(waitingLabel?.includes('Compose'));
          const s: RenderStatus = isComposeWait ? 'waiting' : visualsStatus === 'waiting' ? 'pending' : visualsStatus;
          overlay.status = s;
          overlay.waitingLabel = isComposeWait ? waitingLabel : null;
          overlay.onPlay = isComposeWait ? onPlay : undefined;
          overlay.onPlayNode = s === 'done' ? () => onPlayNode('visuals') : undefined;
          overlay.onDropFile =
            isComposeWait && beatIndex ? (file) => onDrop('beat', file, beatIndex) : undefined;
        } else if (stage) {
          const s = stageStatus(status, stage);
          overlay.status = s;
          overlay.waitingLabel = s === 'waiting' ? waitingLabel : null;
          overlay.onPlay = s === 'waiting' ? onPlay : undefined;
          overlay.onPlayNode = s === 'done' ? () => onPlayNode(stage) : undefined;
          if (nodeType === 'script' && s === 'waiting') {
            overlay.onDropFile = (file) => onDrop('script', file);
          }
          if (nodeType === 'saveVideo') {
            const canPlay = stageStatus(status, 'tts') === 'done' && stageStatus(status, 'visuals') === 'done';
            overlay.waitingLabel =
              s === 'waiting'
                ? waitingLabel
                : !canPlay
                  ? 'Requiere TTS y visuales listos antes de poder renderizar.'
                  : null;
            overlay.onPlayNode = s === 'done' && canPlay ? () => onPlayNode('render') : undefined;
            overlay.thumbnailUrl =
              s === 'done' && status.manifest ? artifactUrl(status.runId, '04_render/final.mp4') : undefined;
          }
        } else if (nodeType === 'loadImage' || nodeType === 'loadAudio' || nodeType === 'prompt') {
          overlay.status = n.data.fileName || n.data.text ? 'done' : 'idle';
        }

        return { ...n, data: { ...n.data, ...overlay } };
      }),
    );
  }, [status, onPlay, onPlayNode, onDrop, setNodes]);

  const onConnect = useCallback(
    (connection: Connection) => {
      if (!socketsCompatible(connection.sourceHandle, connection.targetHandle)) return;
      setEdges((eds) => {
        const replaced = eds.filter(
          (e) => !(e.target === connection.target && e.targetHandle === connection.targetHandle),
        );
        const parsed = parseHandleId(connection.sourceHandle);
        return addEdge(
          { ...connection, style: { stroke: parsed ? SOCKET_COLORS[parsed.socket] : '#6b7280' } },
          replaced,
        );
      });
    },
    [setEdges],
  );

  const isValidConnection = useCallback(
    (connection: Connection | Edge) => socketsCompatible(connection.sourceHandle, connection.targetHandle),
    [],
  );

  const addNode = useCallback(
    (type: StudioNodeType) => {
      const id = `${type}_${Date.now()}`;
      setNodes((nds) => [
        ...nds,
        {
          id,
          type: 'comfy',
          position: { x: 120 + (nds.length % 5) * 24, y: 80 + (nds.length % 8) * 24 },
          data: {
            ...defaultNodeData(type),
            onWidgetChange: (patch) => updateRef.current(id, patch),
            onPickFile: (file) => {
              filesRef.current.set(id, file);
              const previewUrl = file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined;
              updateRef.current(id, { fileName: file.name, previewUrl });
            },
          },
        },
      ]);
    },
    [setNodes],
  );

  const styledEdges = useMemo(
    () => edges.map((e) => ({ ...e, style: { ...e.style, stroke: edgeStroke(e) } })),
    [edges],
  );

  return (
    <div style={{ display: 'flex', width: '100%', height: '75vh', background: '#0b1120', borderRadius: 8, overflow: 'hidden' }}>
      <NodePalette onAdd={addNode} />
      <div style={{ flex: 1 }}>
        <ReactFlow
          nodes={nodes}
          edges={styledEdges}
          nodeTypes={nodeTypes}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          isValidConnection={isValidConnection}
          fitView
          deleteKeyCode={['Backspace', 'Delete']}
        >
          <Background />
          <Controls />
        </ReactFlow>
      </div>
    </div>
  );
}

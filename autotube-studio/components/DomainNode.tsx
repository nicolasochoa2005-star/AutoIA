'use client';

import { Handle, Position, type NodeProps, type Node } from '@xyflow/react';
import type { DomainNodeData } from '@/lib/graph-layout';
import type { CharacterSummary } from '@/lib/types';

export type RenderStatus = 'idle' | 'pending' | 'running' | 'waiting' | 'done';

export interface StudioNodeData extends DomainNodeData {
  status: RenderStatus;
  thumbnailUrl?: string;
  disabled?: boolean;
  onPlay?: () => void;
  onPlayNode?: () => void;
  onDropFile?: (file: File) => void;
  onDropTts?: (audio: File, subtitles: File) => void;
  characters?: CharacterSummary[];
  selectedCharacterId?: string;
  onSelectCharacter?: (id: string) => void;
  waitingLabel?: string | null;
}

const STATUS_COLORS: Record<RenderStatus, string> = {
  idle: '#9ca3af',
  pending: '#9ca3af',
  running: '#3b82f6',
  waiting: '#f59e0b',
  done: '#22c55e',
};

const STATUS_LABELS: Record<RenderStatus, string> = {
  idle: 'sin datos',
  pending: 'pendiente',
  running: 'generando…',
  waiting: 'esperando operador',
  done: 'listo',
};

export function DomainNode({ data }: NodeProps<Node<StudioNodeData>>) {
  const status = data.status ?? 'idle';

  return (
    <div
      style={{
        border: `2px solid ${STATUS_COLORS[status]}`,
        borderRadius: 10,
        background: '#111827',
        color: '#e5e7eb',
        padding: 10,
        width: 220,
        fontSize: 12,
      }}
    >
      <Handle type="target" position={Position.Left} />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <strong>{data.label}</strong>
        <span style={{ color: STATUS_COLORS[status], fontSize: 10 }}>{STATUS_LABELS[status]}</span>
      </div>

      {data.nodeType === 'character' && (
        <select
          className="nodrag"
          value={data.selectedCharacterId ?? ''}
          onChange={(e) => data.onSelectCharacter?.(e.target.value)}
          style={{ width: '100%', marginTop: 8 }}
        >
          <option value="">(sin personaje)</option>
          {(data.characters ?? []).map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      )}

      {data.thumbnailUrl && (data.nodeType === 'visuals' || data.nodeType === 'render' || data.nodeType === 'preview') && (
        <div style={{ marginTop: 8 }}>
          {data.nodeType === 'render' || data.nodeType === 'preview' ? (
            <video src={data.thumbnailUrl} controls style={{ width: '100%', borderRadius: 6 }} />
          ) : (
            <img src={data.thumbnailUrl} alt="" style={{ width: '100%', borderRadius: 6 }} />
          )}
        </div>
      )}

      {data.waitingLabel && (
        <div style={{ marginTop: 6, fontSize: 10, color: '#f59e0b' }}>{data.waitingLabel}</div>
      )}

      {status === 'waiting' && data.nodeType === 'compose' && (
        <input
          className="nodrag"
          type="file"
          accept="image/*"
          style={{ marginTop: 8, fontSize: 10 }}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) data.onDropFile?.(file);
          }}
        />
      )}

      {status === 'waiting' && data.nodeType === 'script' && (
        <input
          className="nodrag"
          type="file"
          accept="application/json"
          style={{ marginTop: 8, fontSize: 10 }}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) data.onDropFile?.(file);
          }}
        />
      )}

      {status === 'waiting' && data.nodeType === 'render' && (
        <input
          className="nodrag"
          type="file"
          accept="video/mp4"
          style={{ marginTop: 8, fontSize: 10 }}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) data.onDropFile?.(file);
          }}
        />
      )}

      <div style={{ marginTop: 8, display: 'flex', gap: 6 }}>
        {data.onPlay && (
          <button className="nodrag" disabled={data.disabled} onClick={data.onPlay} style={{ fontSize: 10 }}>
            ▶ Play
          </button>
        )}
        {data.onPlayNode && (
          <button className="nodrag" disabled={data.disabled} onClick={data.onPlayNode} style={{ fontSize: 10 }}>
            ⟳ Regenerar
          </button>
        )}
      </div>

      <Handle type="source" position={Position.Right} />
    </div>
  );
}

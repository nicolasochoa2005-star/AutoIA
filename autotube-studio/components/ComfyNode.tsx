'use client';

import type { CSSProperties } from 'react';
import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';
import { getNodeDef } from '@/lib/nodes/registry';
import { CATEGORY_COLORS, makeHandleId, SOCKET_COLORS, type SocketDef } from '@/lib/nodes/types';
import type { StudioNodeData } from '@/lib/nodes/template';

export type RenderStatus = 'idle' | 'pending' | 'running' | 'waiting' | 'done';

export interface ComfyNodeData extends StudioNodeData {
  status?: RenderStatus;
  thumbnailUrl?: string;
  disabled?: boolean;
  waitingLabel?: string | null;
  onPlay?: () => void;
  onPlayNode?: () => void;
  onWidgetChange?: (patch: Partial<StudioNodeData>) => void;
  onPickFile?: (file: File) => void;
  onDropFile?: (file: File) => void;
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

const inputStyle: CSSProperties = {
  width: '100%',
  marginTop: 4,
  fontSize: 11,
  background: '#1f2937',
  color: '#e5e7eb',
  border: '1px solid #374151',
  borderRadius: 4,
  padding: 4,
};

function SocketRow({
  def,
  dir,
}: {
  def: SocketDef;
  dir: 'in' | 'out';
}) {
  const isIn = dir === 'in';
  return (
    <div
      style={{
        position: 'relative',
        fontSize: 10,
        color: '#d1d5db',
        margin: '6px 0',
        textAlign: isIn ? 'left' : 'right',
        paddingLeft: isIn ? 8 : 0,
        paddingRight: isIn ? 0 : 8,
      }}
    >
      <Handle
        type={isIn ? 'target' : 'source'}
        position={isIn ? Position.Left : Position.Right}
        id={makeHandleId(dir, def.socket, def.name)}
        style={{
          background: SOCKET_COLORS[def.socket],
          width: 10,
          height: 10,
          border: '2px solid #111827',
        }}
      />
      {def.label}
    </div>
  );
}

export function ComfyNode({ data }: NodeProps<Node<ComfyNodeData>>) {
  const def = getNodeDef(data.nodeType);
  const status = data.status ?? 'idle';
  const accent = def ? CATEGORY_COLORS[def.category] : '#6b7280';

  return (
    <div
      style={{
        border: `2px solid ${STATUS_COLORS[status]}`,
        borderRadius: 10,
        background: '#111827',
        color: '#e5e7eb',
        width: 260,
        fontSize: 12,
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          background: accent,
          padding: '6px 10px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <strong>{data.label}</strong>
        <span style={{ fontSize: 10, opacity: 0.9 }}>{STATUS_LABELS[status]}</span>
      </div>

      <div style={{ display: 'flex', minHeight: 24 }}>
        <div style={{ flex: 1, padding: '4px 0' }}>
          {def?.inputs.map((sock) => (
            <SocketRow key={sock.name} def={sock} dir="in" />
          ))}
        </div>
        <div style={{ flex: 1, padding: '4px 0' }}>
          {def?.outputs.map((sock) => (
            <SocketRow key={sock.name} def={sock} dir="out" />
          ))}
        </div>
      </div>

      <div style={{ padding: '0 10px 10px' }}>
        {data.nodeType === 'prompt' && (
          <textarea
            className="nodrag nowheel"
            value={data.text ?? ''}
            placeholder="Prompt / dirección..."
            rows={4}
            onChange={(e) => data.onWidgetChange?.({ text: e.target.value })}
            style={{ ...inputStyle, resize: 'vertical' }}
          />
        )}

        {(data.nodeType === 'loadImage' || data.nodeType === 'loadAudio') && (
          <>
            <input
              className="nodrag"
              type="file"
              accept={data.nodeType === 'loadImage' ? 'image/*' : 'audio/*,.mp3,.wav'}
              style={{ ...inputStyle, fontSize: 10 }}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) data.onPickFile?.(file);
              }}
            />
            {data.fileName && <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 4 }}>{data.fileName}</div>}
            {data.previewUrl && data.nodeType === 'loadImage' && (
              <img src={data.previewUrl} alt="" style={{ width: '100%', marginTop: 6, borderRadius: 6 }} />
            )}
          </>
        )}

        {data.nodeType === 'script' && (
          <select
            className="nodrag"
            value={data.narrativeProfile ?? 'autopilot'}
            onChange={(e) =>
              data.onWidgetChange?.({ narrativeProfile: e.target.value as 'autopilot' | 'directed' })
            }
            style={inputStyle}
          >
            <option value="autopilot">Automático (libre)</option>
            <option value="directed">Dirigido (30s / hook-CTA)</option>
          </select>
        )}

        {data.nodeType === 'tts' && (
          <select
            className="nodrag"
            value={data.ttsProvider ?? 'edge-tts'}
            onChange={(e) =>
              data.onWidgetChange?.({ ttsProvider: e.target.value as 'edge-tts' | 'elevenlabs' })
            }
            style={inputStyle}
          >
            <option value="edge-tts">edge-tts ($0)</option>
            <option value="elevenlabs">elevenlabs (pago)</option>
          </select>
        )}

        {data.nodeType === 'compose' && (
          <>
            <select
              className="nodrag"
              value={data.identityProvider ?? 'local'}
              onChange={(e) =>
                data.onWidgetChange?.({ identityProvider: e.target.value as 'local' | 'fal' })
              }
              style={inputStyle}
            >
              <option value="local">identidad local ($0)</option>
              <option value="fal">fal (pago)</option>
            </select>
            {status === 'waiting' && (
              <input
                className="nodrag"
                type="file"
                accept="image/*"
                style={{ ...inputStyle, fontSize: 10 }}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) data.onDropFile?.(file);
                }}
              />
            )}
          </>
        )}

        {data.nodeType === 'saveVideo' && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, marginTop: 4 }}>
              <label style={{ fontSize: 10 }}>
                Ancho
                <input
                  className="nodrag"
                  type="number"
                  value={data.width ?? 1080}
                  onChange={(e) => data.onWidgetChange?.({ width: Number(e.target.value) })}
                  style={inputStyle}
                />
              </label>
              <label style={{ fontSize: 10 }}>
                Alto
                <input
                  className="nodrag"
                  type="number"
                  value={data.height ?? 1920}
                  onChange={(e) => data.onWidgetChange?.({ height: Number(e.target.value) })}
                  style={inputStyle}
                />
              </label>
              <label style={{ fontSize: 10 }}>
                FPS
                <input
                  className="nodrag"
                  type="number"
                  value={data.fps ?? 60}
                  onChange={(e) => data.onWidgetChange?.({ fps: Number(e.target.value) })}
                  style={inputStyle}
                />
              </label>
              <label style={{ fontSize: 10 }}>
                Duración (s)
                <input
                  className="nodrag"
                  type="number"
                  value={data.duration ?? ''}
                  placeholder="auto"
                  onChange={(e) =>
                    data.onWidgetChange?.({ duration: e.target.value ? Number(e.target.value) : undefined })
                  }
                  style={inputStyle}
                />
              </label>
            </div>
            <select
              className="nodrag"
              value={data.vcodec ?? 'libx264'}
              onChange={(e) => data.onWidgetChange?.({ vcodec: e.target.value })}
              style={inputStyle}
            >
              <option value="libx264">libx264</option>
              <option value="libx265">libx265</option>
            </select>
            <select
              className="nodrag"
              value={data.acodec ?? 'aac'}
              onChange={(e) => data.onWidgetChange?.({ acodec: e.target.value })}
              style={inputStyle}
            >
              <option value="aac">aac</option>
              <option value="mp3">mp3</option>
            </select>
            <input
              className="nodrag"
              value={data.filenamePrefix ?? 'video/autotube'}
              onChange={(e) => data.onWidgetChange?.({ filenamePrefix: e.target.value })}
              placeholder="prefijo archivo"
              style={inputStyle}
            />
            {data.thumbnailUrl && (
              <video src={data.thumbnailUrl} controls style={{ width: '100%', marginTop: 6, borderRadius: 6 }} />
            )}
          </>
        )}

        {data.nodeType === 'script' && status === 'waiting' && (
          <input
            className="nodrag"
            type="file"
            accept="application/json"
            style={{ ...inputStyle, fontSize: 10 }}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) data.onDropFile?.(file);
            }}
          />
        )}

        {data.waitingLabel && (
          <div style={{ marginTop: 6, fontSize: 10, color: '#f59e0b' }}>{data.waitingLabel}</div>
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
      </div>
    </div>
  );
}

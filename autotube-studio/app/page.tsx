'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { StudioCanvas } from '@/components/StudioCanvas';
import type { CharacterSummary, RunStatus, StageName } from '@/lib/types';
import type { CompiledRun, SerializedWorkflow } from '@/lib/nodes/compiler';

const POLL_INTERVAL_MS = 1500;
const LAST_RUN_KEY = 'autotube-studio:last-run-id';

async function postJson(url: string, body: unknown) {
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? `${url} falló`);
  return res.json();
}

function compiledPayload(compiled: CompiledRun | null, characterId: string) {
  if (!compiled) return { characterId: characterId || undefined };
  return {
    characterId: characterId || undefined,
    ttsProvider: compiled.ttsProvider,
    identityProvider: compiled.identityProvider,
    narrativeProfile: compiled.narrativeProfile,
    promptOverride: compiled.promptOverride,
    width: compiled.render.width,
    height: compiled.render.height,
    fps: compiled.render.fps,
    vcodec: compiled.render.vcodec,
    acodec: compiled.render.acodec,
    durationSec: compiled.render.durationSec,
  };
}

export default function Home() {
  const [topicHint, setTopicHint] = useState('');
  const [characterId, setCharacterId] = useState('');
  const [characters, setCharacters] = useState<CharacterSummary[]>([]);
  const [runId, setRunId] = useState<string | null>(null);
  const [status, setStatus] = useState<RunStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  const compiledRef = useRef<CompiledRun | null>(null);
  const filesRef = useRef<Map<string, File>>(new Map());
  const workflowRef = useRef<SerializedWorkflow | null>(null);

  useEffect(() => {
    fetch('/api/characters')
      .then((r) => r.json())
      .then((d) => setCharacters(d.characters ?? []))
      .catch(() => setCharacters([]));

    const lastRunId = window.localStorage.getItem(LAST_RUN_KEY);
    if (lastRunId) setRunId(lastRunId);
  }, []);

  useEffect(() => {
    if (runId) window.localStorage.setItem(LAST_RUN_KEY, runId);
  }, [runId]);

  useEffect(() => {
    if (!runId) return;
    const poll = async () => {
      try {
        const res = await fetch(`/api/runs/${runId}`);
        const data = (await res.json()) as RunStatus;
        setStatus(data);
      } catch {
        // el próximo tick reintenta
      }
    };
    poll();
    const interval = setInterval(poll, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [runId]);

  const handleWorkflowChange = useCallback(
    (compiled: CompiledRun, files: Map<string, File>, serialized: SerializedWorkflow) => {
      compiledRef.current = compiled;
      filesRef.current = files;
      workflowRef.current = serialized;
    },
    [],
  );

  const createRun = useCallback(async () => {
    setError(null);
    const compiled = compiledRef.current;
    const topic = (compiled?.topicHint || topicHint).trim();
    if (!topic) {
      setError('Escribí un tema o conectá un Prompt con texto al nodo Guion.');
      return;
    }
    try {
      const form = new FormData();
      form.set('topicHint', topic);
      const payload = compiledPayload(compiled, characterId);
      for (const [key, value] of Object.entries(payload)) {
        if (value !== undefined && value !== null && value !== '') form.set(key, String(value));
      }
      if (workflowRef.current) form.set('workflow', JSON.stringify(workflowRef.current));
      compiled?.composeImageNodeIds.forEach((nodeId, index) => {
        const file = filesRef.current.get(nodeId);
        if (file) form.set(`composeImage_${index}`, file);
      });
      if (compiled?.backgroundMusicNodeId) {
        const music = filesRef.current.get(compiled.backgroundMusicNodeId);
        if (music) form.set('backgroundMusic', music);
      }
      const res = await fetch('/api/runs', { method: 'POST', body: form });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'no se pudo crear la corrida');
      const data = await res.json();
      setRunId(data.runId);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [topicHint, characterId]);

  const handlePlay = useCallback(() => {
    if (!runId) return;
    postJson(`/api/runs/${runId}/play`, compiledPayload(compiledRef.current, characterId)).catch((e) =>
      setError((e as Error).message),
    );
  }, [runId, characterId]);

  const handlePlayNode = useCallback(
    (stage: StageName) => {
      if (!runId) return;
      postJson(`/api/runs/${runId}/play/${stage}`, compiledPayload(compiledRef.current, characterId)).catch((e) =>
        setError((e as Error).message),
      );
    },
    [runId, characterId],
  );

  const handleDrop = useCallback(
    async (slot: 'script' | 'render' | 'beat', file: File, beatIndex?: number) => {
      if (!runId) return;
      const form = new FormData();
      form.set('slot', slot);
      form.set('file', file);
      if (beatIndex) form.set('beatIndex', String(beatIndex));
      try {
        const res = await fetch(`/api/runs/${runId}/drop`, { method: 'POST', body: form });
        if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'drop falló');
      } catch (e) {
        setError((e as Error).message);
      }
    },
    [runId],
  );

  return (
    <main style={{ padding: 24, fontFamily: 'sans-serif', color: '#e5e7eb', background: '#0b1120', minHeight: '100vh' }}>
      <h1>AutoTube Estudio</h1>
      <p style={{ fontSize: 12, color: '#9ca3af', margin: '8px 0 16px' }}>
        Conectá nodos por tipo (imagen, prompt, audio, video). La paleta a la izquierda agrega nodos del registry.
      </p>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        <input
          placeholder="Tema sugerido (o usá el nodo Prompt)..."
          value={topicHint}
          onChange={(e) => setTopicHint(e.target.value)}
          style={{ flex: 1, minWidth: 220, padding: 8 }}
        />
        <select value={characterId} onChange={(e) => setCharacterId(e.target.value)} style={{ padding: 8 }}>
          <option value="">(sin personaje)</option>
          {characters.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <button onClick={createRun}>Ejecutar grafo</button>
        {runId && (
          <button
            onClick={() => {
              window.localStorage.removeItem(LAST_RUN_KEY);
              setRunId(null);
              setStatus(null);
            }}
            style={{ fontSize: 12 }}
          >
            Nueva corrida
          </button>
        )}
      </div>

      {runId && (
        <p style={{ fontSize: 12, color: '#9ca3af', marginBottom: 8 }}>
          Corrida: {runId} {status?.running ? '(proceso activo)' : status?.exitCode === 0 ? '(completa)' : ''}
        </p>
      )}

      {error && <p style={{ color: '#ef4444', marginBottom: 8 }}>{error}</p>}

      <StudioCanvas
        status={status}
        onPlay={handlePlay}
        onPlayNode={handlePlayNode}
        onDrop={handleDrop}
        onWorkflowChange={handleWorkflowChange}
      />
    </main>
  );
}

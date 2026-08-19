'use client';

import { useCallback, useEffect, useState } from 'react';
import { StudioCanvas } from '@/components/StudioCanvas';
import type { CharacterSummary, RunStatus, StageName } from '@/lib/types';

const POLL_INTERVAL_MS = 1500;
const LAST_RUN_KEY = 'autotube-studio:last-run-id';

async function postJson(url: string, body: unknown) {
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? `${url} falló`);
  return res.json();
}

export default function Home() {
  const [topicHint, setTopicHint] = useState('');
  const [characterId, setCharacterId] = useState('');
  const [characters, setCharacters] = useState<CharacterSummary[]>([]);
  const [runId, setRunId] = useState<string | null>(null);
  const [status, setStatus] = useState<RunStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

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

  const createRun = useCallback(async () => {
    setError(null);
    try {
      const { runId: newRunId } = await postJson('/api/runs', {
        topicHint,
        characterId: characterId || undefined,
      });
      setRunId(newRunId);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [topicHint, characterId]);

  const handlePlay = useCallback(() => {
    if (!runId) return;
    postJson(`/api/runs/${runId}/play`, {}).catch((e) => setError((e as Error).message));
  }, [runId]);

  const handlePlayNode = useCallback(
    (stage: StageName) => {
      if (!runId) return;
      postJson(`/api/runs/${runId}/play/${stage}`, {}).catch((e) => setError((e as Error).message));
    },
    [runId],
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

  const handleDropTts = useCallback(
    async (audio: File, subtitles: File) => {
      if (!runId) return;
      const form = new FormData();
      form.set('slot', 'tts');
      form.set('audio', audio);
      form.set('subtitles', subtitles);
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

      {!runId && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <input
            placeholder="Tema sugerido..."
            value={topicHint}
            onChange={(e) => setTopicHint(e.target.value)}
            style={{ flex: 1, padding: 8 }}
          />
          <select value={characterId} onChange={(e) => setCharacterId(e.target.value)} style={{ padding: 8 }}>
            <option value="">(sin personaje)</option>
            {characters.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <button onClick={createRun} disabled={!topicHint.trim()}>
            Nueva corrida
          </button>
        </div>
      )}

      {runId && (
        <p style={{ fontSize: 12, color: '#9ca3af' }}>
          Corrida: {runId} {status?.running ? '(proceso activo)' : status?.exitCode === 0 ? '(completa)' : ''}{' '}
          <button
            onClick={() => {
              window.localStorage.removeItem(LAST_RUN_KEY);
              setRunId(null);
              setStatus(null);
            }}
            style={{ fontSize: 11 }}
          >
            Nueva corrida
          </button>
        </p>
      )}

      {error && <p style={{ color: '#ef4444' }}>{error}</p>}

      {runId && (
        <StudioCanvas
          status={status}
          characters={characters}
          selectedCharacterId={characterId}
          onSelectCharacter={setCharacterId}
          onPlay={handlePlay}
          onPlayNode={handlePlayNode}
          onDrop={handleDrop}
          onDropTts={handleDropTts}
        />
      )}
    </main>
  );
}

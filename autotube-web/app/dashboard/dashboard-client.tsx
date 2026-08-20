'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  ENGINE_URL,
  fetchVideo,
  fetchVideos,
  previewUrl,
  reviewVideo,
  type VideoDetail,
  type VideoListItem,
} from '../../lib/engine';
import { QA_CHECKLIST } from '../../lib/qa-checklist';

const FILTERS: { id: string; label: string }[] = [
  { id: '', label: 'Todos' },
  { id: 'READY_FOR_REVIEW', label: 'Listos para QA' },
  { id: 'WAITING_FOR_INPUT', label: 'Esperando input' },
  { id: 'ERROR', label: 'Error' },
  { id: 'REJECTED', label: 'Rechazados' },
  { id: 'APPROVED', label: 'Aprobados' },
  { id: 'PUBLISHED', label: 'Publicados' },
];

function formatDate(value: string | null): string {
  if (!value) return '—';
  return new Date(value).toLocaleString('es');
}

export function DashboardClient() {
  const [status, setStatus] = useState('');
  const [videos, setVideos] = useState<VideoListItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<VideoDetail | null>(null);
  const [notes, setNotes] = useState('');
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const loadList = useCallback(async () => {
    setError(null);
    try {
      const rows = await fetchVideos(status || undefined);
      setVideos(rows);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al listar');
    }
  }, [status]);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      return;
    }
    let cancelled = false;
    void fetchVideo(selectedId)
      .then((video) => {
        if (!cancelled) {
          setDetail(video);
          setNotes(video.reviewNotes ?? '');
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Error al cargar ficha');
        }
      });
    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  async function submit(action: 'approve' | 'reject') {
    if (!selectedId) return;
    setBusy(true);
    setError(null);
    try {
      const updated = await reviewVideo(selectedId, action, notes);
      setDetail(updated);
      await loadList();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo revisar');
    } finally {
      setBusy(false);
    }
  }

  const canReview = detail?.status === 'READY_FOR_REVIEW';
  const rejectDisabled = busy || !canReview || !notes.trim();

  return (
    <div className="app">
      <header className="header">
        <h1>Dashboard QA</h1>
        <p>
          Cola lineal de Shorts. Engine: <code>{ENGINE_URL}</code>
          {' · '}
          <a href="/dashboard/kpis">KPIs</a>
        </p>
      </header>

      {error ? <p className="error-msg">{error}</p> : null}

      <div className="layout">
        <section className="panel">
          <div className="filters">
            {FILTERS.map((filter) => (
              <button
                key={filter.id || 'all'}
                type="button"
                className={status === filter.id ? 'active' : undefined}
                onClick={() => setStatus(filter.id)}
              >
                {filter.label}
              </button>
            ))}
          </div>

          {videos.length === 0 ? (
            <p className="empty">No hay videos con este filtro.</p>
          ) : (
            <div className="table">
              {videos.map((video) => {
                const waiting = video.status === 'WAITING_FOR_INPUT';
                const isError = video.status === 'ERROR';
                return (
                  <button
                    key={video.id}
                    type="button"
                    className={[
                      'row',
                      waiting ? 'waiting' : '',
                      isError ? 'error' : '',
                      selectedId === video.id ? 'selected' : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    onClick={() => setSelectedId(video.id)}
                  >
                    <div className="row-title">{video.title}</div>
                    <div className="row-meta">
                      <span className="badge">{video.status}</span>
                      <span>{formatDate(video.createdAt)}</span>
                      {isError && video.errorReason ? <span>{video.errorReason}</span> : null}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </section>

        <section className="panel">
          {!detail ? (
            <p className="empty">Elegí un video para previsualizar y hacer QA.</p>
          ) : (
            <>
              <h2>{detail.title}</h2>
              <p className="row-meta">
                <span className="badge">{detail.status}</span>
                {detail.characterId ? <span>sujeto: {detail.characterId}</span> : null}
              </p>
              {detail.status === 'ERROR' && detail.errorReason ? (
                <p className="error-msg">{detail.errorReason}</p>
              ) : null}

              <video
                key={detail.id}
                className="preview"
                controls
                preload="metadata"
                src={previewUrl(detail.id)}
              />

              <p>
                <a href={`/studio?videoId=${detail.id}`}>Abrir en Estudio</a>
                <span className="row-meta"> (disponible cuando exista el canvas)</span>
              </p>

              {detail.description ? <p>{detail.description}</p> : null}
              {detail.script ? <pre className="script">{detail.script}</pre> : null}

              <h3>Checklist QA</h3>
              <ul className="checklist">
                {QA_CHECKLIST.map((item) => (
                  <li key={item.id}>
                    <label>
                      <input
                        type="checkbox"
                        checked={Boolean(checked[item.id])}
                        onChange={(event) =>
                          setChecked((current) => ({
                            ...current,
                            [item.id]: event.target.checked,
                          }))
                        }
                      />
                      <span>
                        <strong>{item.title}</strong>
                        <small>{item.detail}</small>
                      </span>
                    </label>
                  </li>
                ))}
              </ul>

              <label>
                Notas de revisión
                <textarea
                  className="notes"
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  disabled={!canReview && detail.status !== 'READY_FOR_REVIEW'}
                  placeholder={
                    canReview
                      ? 'Obligatorias para rechazar. Opcionales al aprobar.'
                      : 'Solo se editan en READY_FOR_REVIEW'
                  }
                />
              </label>

              {detail.reviewedBy ? (
                <p className="row-meta">
                  Revisado por {detail.reviewedBy} · {formatDate(detail.reviewedAt)}
                </p>
              ) : null}

              <div className="actions">
                <button
                  type="button"
                  className="approve"
                  disabled={busy || !canReview}
                  onClick={() => void submit('approve')}
                >
                  Aprobar
                </button>
                <button
                  type="button"
                  className="reject"
                  disabled={rejectDisabled}
                  onClick={() => void submit('reject')}
                >
                  Rechazar
                </button>
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}

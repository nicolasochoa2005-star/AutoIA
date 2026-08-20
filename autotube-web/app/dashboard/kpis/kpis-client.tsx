'use client';

import { useEffect, useState } from 'react';
import {
  ENGINE_URL,
  fetchMetricsHealth,
  fetchMetricsSpend,
  fetchMetricsSummary,
  type MetricsHealth,
  type MetricsSpend,
  type MetricsSummary,
} from '../../../lib/engine';

function formatMoney(value: number): string {
  return value.toLocaleString('es', { style: 'currency', currency: 'USD', maximumFractionDigits: 4 });
}

function formatPct(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function SummaryCards({ summary }: { summary: MetricsSummary }) {
  return (
    <div className="kpi-grid">
      <article className="kpi-card">
        <h3>Vistas</h3>
        <p className="kpi-value">{summary.views.toLocaleString('es')}</p>
        <small>{summary.videos} video(s) con snapshot</small>
      </article>
      <article className="kpi-card">
        <h3>Retención media</h3>
        <p className="kpi-value">{formatPct(summary.retention)}</p>
        <small>averageViewPercentage</small>
      </article>
      <article className="kpi-card">
        <h3>Revenue estimado</h3>
        <p className="kpi-value">{formatMoney(summary.estimatedRevenue)}</p>
        <small>0 si no hay scope monetary</small>
      </article>
    </div>
  );
}

function SpendTable({ rows, empty }: { rows: { provider: string; costUsd: number }[]; empty: string }) {
  if (rows.length === 0) {
    return <p className="empty">{empty}</p>;
  }
  return (
    <table className="kpi-table">
      <thead>
        <tr>
          <th>Proveedor</th>
          <th>Gasto</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.provider}>
            <td>{row.provider}</td>
            <td>{formatMoney(row.costUsd)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function KpisClient() {
  const [days, setDays] = useState<7 | 30 | 90>(7);
  const [summaries, setSummaries] = useState<Partial<Record<7 | 30 | 90, MetricsSummary>>>({});
  const [spend, setSpend] = useState<MetricsSpend | null>(null);
  const [health, setHealth] = useState<MetricsHealth | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void Promise.all([
      fetchMetricsSummary(7),
      fetchMetricsSummary(30),
      fetchMetricsSummary(90),
      fetchMetricsSpend(),
      fetchMetricsHealth(),
    ])
      .then(([d7, d30, d90, spendResult, healthResult]) => {
        if (cancelled) return;
        setSummaries({ 7: d7, 30: d30, 90: d90 });
        setSpend(spendResult);
        setHealth(healthResult);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'No se pudieron cargar los KPIs');
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const summary = summaries[days];

  return (
    <div className="app">
      <header className="header">
        <h1>KPIs</h1>
        <p>
          Métricas de videos publicados y gasto de proveedores. Engine: <code>{ENGINE_URL}</code>
        </p>
        <p>
          <a href="/dashboard">Volver a QA</a>
        </p>
      </header>

      {error ? <p className="error-msg">{error}</p> : null}

      <section className="panel">
        <div className="filters">
          {([7, 30, 90] as const).map((value) => (
            <button
              key={value}
              type="button"
              className={days === value ? 'active' : undefined}
              onClick={() => setDays(value)}
            >
              {value} días
            </button>
          ))}
          {health ? (
            <span className={`badge quota-${health.youtubeQuota}`}>
              Cuota YouTube: {health.youtubeQuota === 'ok' ? 'ok' : 'excedida'}
              {health.lastExceededAt
                ? ` · último ${new Date(health.lastExceededAt).toLocaleString('es')}`
                : ''}
            </span>
          ) : null}
        </div>
        {summary ? <SummaryCards summary={summary} /> : <p className="empty">Cargando resumen…</p>}
      </section>

      <section className="panel">
        <h2>Gasto por proveedor</h2>
        <h3>Hoy (UTC)</h3>
        <SpendTable rows={spend?.today ?? []} empty="Sin costo registrado hoy." />
        <h3>Total</h3>
        <SpendTable rows={spend?.all ?? []} empty="Sin costo registrado." />
      </section>

      <section className="panel">
        <h2>Snapshots recientes ({days} días)</h2>
        {!summary || summary.snapshots.length === 0 ? (
          <p className="empty">Todavía no hay snapshots. El CRON 2 corre cada 6 h sobre videos PUBLISHED.</p>
        ) : (
          <table className="kpi-table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Vistas</th>
                <th>Retención</th>
                <th>Revenue</th>
              </tr>
            </thead>
            <tbody>
              {summary.snapshots.map((row, index) => (
                <tr key={`${row.fetchedAt}-${index}`}>
                  <td>{new Date(row.fetchedAt).toLocaleString('es')}</td>
                  <td>{row.views.toLocaleString('es')}</td>
                  <td>{formatPct(row.retentionRate)}</td>
                  <td>{formatMoney(row.estimatedRevenue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}

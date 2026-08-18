export interface ScriptHistoryEntry {
  title: string;
  hookType: string;
  embedding: number[];
  createdAt: string;
}

/**
 * Persists script history for the anti-repetition filter. `FileScriptHistoryStore`
 * is the Fase 1/2 implementation (local JSON); ver FuncionalDoc.md sección 6 —
 * en Fase 3 se reemplaza por una implementación respaldada por la tabla `videos`
 * de PostgreSQL (columna `embedding`, pgvector) sin tocar el resto del filtro.
 */
export interface ScriptHistoryStore {
  getRecent(limit: number): Promise<ScriptHistoryEntry[]>;
  save(entry: ScriptHistoryEntry): Promise<void>;
}

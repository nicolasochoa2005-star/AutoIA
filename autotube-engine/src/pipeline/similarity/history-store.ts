export interface ScriptHistoryEntry {
  videoId?: string;
  title: string;
  hookType: string;
  embedding: number[];
  createdAt: string;
}

/**
 * Persists script history for the anti-repetition filter. `PostgresScriptHistoryStore`
 * reads/writes `videos.embedding` (pgvector). The previous JSON file store is no
 * longer the source of truth.
 */
export interface ScriptHistoryStore {
  getRecent(limit: number): Promise<ScriptHistoryEntry[]>;
  save(entry: ScriptHistoryEntry): Promise<void>;
}

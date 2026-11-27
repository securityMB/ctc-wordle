import type { Database, QueryExecResult } from 'sql.js';

interface InitRequest {
  id: number;
  type: 'init';
  dbUrl: string;
  wasmUrl: string;
}

interface ExecRequest {
  id: number;
  type: 'exec';
  sql: string;
}

type WorkerRequest = InitRequest | ExecRequest;

export interface WorkerResponse {
  id: number;
  ok: boolean;
  results?: QueryExecResult[];
  durationMs?: number;
  error?: string;
}

let db: Database | null = null;

async function initDatabase(dbUrl: string, wasmUrl: string): Promise<void> {
  if (db) return;

  const [{ default: initSqlJs }, dbResponse] = await Promise.all([import('sql.js'), fetch(dbUrl)]);

  if (!dbResponse.ok) {
    throw new Error(`Failed to fetch ${dbUrl} (HTTP ${dbResponse.status})`);
  }

  const [SQL, dbBuffer] = await Promise.all([
    initSqlJs({
      locateFile: () => wasmUrl,
    }),
    dbResponse.arrayBuffer(),
  ]);

  const instance = new SQL.Database(new Uint8Array(dbBuffer));
  instance.run('PRAGMA query_only = ON;');
  db = instance;
}

self.addEventListener('message', async (event: MessageEvent<WorkerRequest>) => {
  const msg = event.data;

  try {
    if (msg.type === 'init') {
      await initDatabase(msg.dbUrl, msg.wasmUrl);
      const response: WorkerResponse = { id: msg.id, ok: true };
      self.postMessage(response);
      return;
    }

    if (!db) {
      throw new Error('SQLite database is not initialized.');
    }

    const start = performance.now();
    const results = db.exec(msg.sql);
    const durationMs = performance.now() - start;
    const response: WorkerResponse = { id: msg.id, ok: true, results, durationMs };
    self.postMessage(response);
  } catch (err: unknown) {
    const error = err instanceof Error ? err.message : String(err);
    const response: WorkerResponse = { id: msg.id, ok: false, error };
    self.postMessage(response);
  }
});

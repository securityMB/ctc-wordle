import type { QueryExecResult } from 'sql.js';
import type { WorkerResponse } from './sqlWorker.ts';

export interface SqlPreset {
  id: string;
  label: string;
  sql: string;
}

export const SQL_PRESETS: SqlPreset[] = [
  {
    id: 'top-openers',
    label: 'Top opening words',
    sql: `SELECT gu.word AS opener,
       COUNT(*) AS uses,
       ROUND(AVG(g.attempts), 2) AS avg_attempts,
       ROUND(100.0 * AVG(g.solved), 1) AS win_pct
FROM guesses gu
JOIN games g ON g.youtube_id = gu.youtube_id
WHERE gu.row_num = 1
GROUP BY gu.word
ORDER BY uses DESC
LIMIT 25;`,
  },
  {
    id: 'top-guesses',
    label: 'Most guessed words',
    sql: `SELECT word,
       COUNT(*) AS uses,
       COUNT(DISTINCT youtube_id) AS games,
       ROUND(AVG(row_num), 2) AS avg_row
FROM guesses
GROUP BY word
ORDER BY uses DESC
LIMIT 25;`,
  },
  {
    id: 'hardest-words',
    label: 'Hardest words',
    sql: `SELECT date,
       correct_word,
       attempts,
       CASE WHEN solved = 1 THEN 'Solved' ELSE 'Failed' END AS outcome,
       solve_time_seconds,
       youtube_id
FROM games
WHERE solved = 0 OR attempts = 6
ORDER BY solved ASC, solve_time_seconds DESC
LIMIT 50;`,
  },
  {
    id: 'avg-time-by-attempts',
    label: 'Avg time by attempts',
    sql: `SELECT attempts,
       COUNT(*) AS games,
       ROUND(AVG(solve_time_seconds), 1) AS avg_sec,
       ROUND(MIN(solve_time_seconds), 1) AS min_sec,
       ROUND(MAX(solve_time_seconds), 1) AS max_sec
FROM games
WHERE solved = 1 AND solve_time_seconds IS NOT NULL
GROUP BY attempts
ORDER BY attempts ASC;`,
  },
  {
    id: 'one-two-guess',
    label: '1–2 guess games',
    sql: `SELECT date,
       correct_word,
       attempts,
       solve_time_seconds,
       youtube_id
FROM games
WHERE solved = 1 AND attempts <= 2
ORDER BY attempts ASC, date DESC;`,
  },
  {
    id: 'fastest-solves',
    label: 'Fastest solves',
    sql: `SELECT date,
       correct_word,
       attempts,
       solve_time_seconds,
       youtube_id
FROM games
WHERE solved = 1 AND solve_time_seconds IS NOT NULL
ORDER BY solve_time_seconds ASC
LIMIT 25;`,
  },
];

interface PendingRequest {
  resolve: (res: WorkerResponse) => void;
  reject: (err: Error) => void;
}

let worker: Worker | null = null;
let initPromise: Promise<void> | null = null;
let nextRequestId = 1;
const pending = new Map<number, PendingRequest>();

function getWorker(): Worker {
  if (!worker) {
    worker = new Worker(new URL('./sqlWorker.ts', import.meta.url), { type: 'module' });
    worker.addEventListener('message', (event: MessageEvent<WorkerResponse>) => {
      const msg = event.data;
      const entry = pending.get(msg.id);
      if (!entry) return;
      pending.delete(msg.id);
      if (msg.ok) {
        entry.resolve(msg);
      } else {
        entry.reject(new Error(msg.error ?? 'Unknown SQLite worker error'));
      }
    });
    worker.addEventListener('error', (event) => {
      const err = new Error(event.message || 'SQLite worker error');
      for (const entry of pending.values()) {
        entry.reject(err);
      }
      pending.clear();
      worker?.terminate();
      worker = null;
      initPromise = null;
    });
  }
  return worker;
}

function sendWorkerRequest(payload: Record<string, unknown>): Promise<WorkerResponse> {
  const id = nextRequestId++;
  const w = getWorker();
  return new Promise<WorkerResponse>((resolve, reject) => {
    pending.set(id, { resolve, reject });
    w.postMessage({ ...payload, id });
  });
}

/**
 * Lazily initializes the SQLite Web Worker, WASM binary, and /data/wordle.sqlite once on demand.
 */
export async function getDatabase(): Promise<void> {
  if (!initPromise) {
    initPromise = sendWorkerRequest({
      type: 'init',
      dbUrl: `/data/wordle.sqlite?v=${__BUILD_ID__}`,
      wasmUrl: `/data/sql-wasm.wasm?v=${__BUILD_ID__}`,
    })
      .then(() => undefined)
      .catch((err) => {
        initPromise = null;
        throw err;
      });
  }

  return initPromise;
}

export interface QueryOutput {
  results: QueryExecResult[];
  durationMs: number;
}

/**
 * Executes a read-only SQL query against the in-browser SQLite database and returns its result sets and duration.
 */
export async function runSqlQuery(sql: string): Promise<QueryOutput> {
  await getDatabase();
  const res = await sendWorkerRequest({ type: 'exec', sql });
  return {
    results: res.results ?? [],
    durationMs: res.durationMs ?? 0,
  };
}

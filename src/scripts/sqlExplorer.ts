import type { Database, QueryExecResult } from 'sql.js';

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

let dbPromise: Promise<Database> | null = null;

/**
 * Lazily loads sql.js, the WASM binary, and /data/wordle.db once on demand.
 */
export async function getDatabase(): Promise<Database> {
  if (!dbPromise) {
    dbPromise = (async () => {
      const [{ default: initSqlJs }, dbResponse] = await Promise.all([
        import('sql.js'),
        fetch('/data/wordle.db'),
      ]);

      if (!dbResponse.ok) {
        throw new Error(`Failed to fetch /data/wordle.db (HTTP ${dbResponse.status})`);
      }

      const [SQL, dbBuffer] = await Promise.all([
        initSqlJs({
          locateFile: () => '/data/sql-wasm.wasm',
        }),
        dbResponse.arrayBuffer(),
      ]);

      return new SQL.Database(new Uint8Array(dbBuffer));
    })().catch((err) => {
      dbPromise = null;
      throw err;
    });
  }

  return dbPromise;
}

export interface QueryOutput {
  results: QueryExecResult[];
  durationMs: number;
}

export async function runSqlQuery(sql: string): Promise<QueryOutput> {
  const db = await getDatabase();
  const start = performance.now();
  const results = db.exec(sql);
  const durationMs = performance.now() - start;
  return { results, durationMs };
}

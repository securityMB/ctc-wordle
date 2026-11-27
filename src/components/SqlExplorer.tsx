import { useCallback, useEffect, useRef, useState } from 'preact/hooks';
import {
  getDatabase,
  runSqlQuery,
  SQL_PRESETS,
  type QueryOutput,
} from '#src/scripts/sqlExplorer.ts';

const MAX_DISPLAY_ROWS = 500;

type StatusState = 'idle' | 'loading' | 'ready' | 'error';

/**
 * Interactive SQLite query editor and results viewer backed by the `sql.js` Web Worker.
 */
export default function SqlExplorer() {
  const [status, setStatus] = useState<{ state: StatusState; text: string }>({
    state: 'idle',
    text: 'Idle — activates on open',
  });
  const [activePreset, setActivePreset] = useState(SQL_PRESETS[0]?.id ?? '');
  const [sql, setSql] = useState(SQL_PRESETS[0]?.sql ?? '');
  const [running, setRunning] = useState(false);
  const [error, setError] = useState('');
  const [output, setOutput] = useState<QueryOutput | null>(null);

  const initializedRef = useRef(false);
  const initializingRef = useRef(false);
  const requestIdRef = useRef(0);
  const initialSqlRef = useRef(sql);

  const execute = useCallback(async (queryText: string) => {
    const reqId = ++requestIdRef.current;
    const trimmed = queryText.trim();
    if (!trimmed) {
      setError('Please enter a SQL query.');
      setRunning(false);
      return;
    }

    setError('');
    setRunning(true);
    try {
      const res = await runSqlQuery(trimmed);
      if (reqId !== requestIdRef.current) return;
      setOutput(res);
      setStatus({ state: 'ready', text: 'SQLite WASM ready' });
    } catch (err: unknown) {
      if (reqId !== requestIdRef.current) return;
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      setOutput(null);
    } finally {
      if (reqId === requestIdRef.current) {
        setRunning(false);
      }
    }
  }, []);

  const activate = useCallback(async () => {
    if (initializedRef.current || initializingRef.current) return;
    initializingRef.current = true;
    setStatus({ state: 'loading', text: 'Loading SQLite WASM & wordle.sqlite…' });

    try {
      await getDatabase();
      initializedRef.current = true;
      setStatus({ state: 'ready', text: 'SQLite WASM ready' });
      await execute(initialSqlRef.current);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setStatus({ state: 'error', text: 'Failed to load SQLite' });
      setError(msg);
    } finally {
      initializingRef.current = false;
    }
  }, [execute]);

  useEffect(() => {
    void activate();
  }, [activate]);

  const firstSet = output?.results?.[0];
  const columns = firstSet?.columns ?? [];
  const rows = firstSet?.values ?? [];
  const ytColIdx = columns.findIndex((c) => c === 'youtube_id');
  const displayedRows = rows.slice(0, MAX_DISPLAY_ROWS);

  return (
    <section class="sql-explorer" aria-label="SQL Explorer">
      <div class="sql-card">
        <div class="sql-header">
          <div>
            <h2 class="sql-title">SQL Explorer</h2>
            <p class="sql-subtitle">
              Query the full Wordle archive directly in your browser using SQLite, or{' '}
              <a href="/data/wordle.sqlite" download="wordle.sqlite">
                download wordle.sqlite
              </a>
              .
            </p>
          </div>
          <div class="sql-status" data-state={status.state} aria-live="polite">
            <span class="sql-status-dot" />
            <span>{status.text}</span>
          </div>
        </div>

        <details class="sql-schema">
          <summary class="sql-schema-toggle">
            Database Schema (<code>games</code>, <code>guesses</code>)
          </summary>
          <div class="sql-schema-grid">
            <div class="sql-schema-table">
              <div class="sql-schema-name">games</div>
              <code>youtube_id TEXT PRIMARY KEY</code>
              <code>date TEXT</code>
              <code>correct_word TEXT</code>
              <code>attempts INTEGER</code>
              <code>solved INTEGER (1 or 0)</code>
              <code>solve_time_seconds REAL</code>
            </div>
            <div class="sql-schema-table">
              <div class="sql-schema-name">guesses</div>
              <code>youtube_id TEXT</code>
              <code>row_num INTEGER (1-based)</code>
              <code>word TEXT</code>
            </div>
          </div>
        </details>

        <div class="sql-presets" role="group" aria-label="Preset SQL queries">
          {SQL_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              class={`sql-preset-btn${activePreset === preset.id ? ' active' : ''}`}
              onClick={() => {
                setActivePreset(preset.id);
                setSql(preset.sql);
                void execute(preset.sql);
              }}
            >
              {preset.label}
            </button>
          ))}
        </div>

        <div class="sql-editor-wrap">
          <label class="sr-only" for="sql-input">
            SQL Query
          </label>
          <textarea
            id="sql-input"
            class="sql-textarea"
            rows={6}
            spellcheck={false}
            placeholder="SELECT * FROM games LIMIT 20;"
            value={sql}
            onInput={(e) => setSql(e.currentTarget.value)}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                e.preventDefault();
                void execute(sql);
              }
            }}
          />

          <div class="sql-actions">
            <div class="sql-actions-left">
              <button
                type="button"
                class="sql-run-btn"
                disabled={running}
                onClick={() => void execute(sql)}
              >
                {running ? 'Running…' : 'Run Query'}
              </button>
              <span class="sql-shortcut-hint">Cmd/Ctrl + Enter</span>
            </div>
            <button
              type="button"
              class="sql-clear-btn"
              onClick={() => {
                requestIdRef.current += 1;
                setRunning(false);
                setSql('');
                setActivePreset('');
                setError('');
                setOutput(null);
              }}
            >
              Clear
            </button>
          </div>
        </div>

        {error && (
          <div class="sql-error" role="alert">
            {error}
          </div>
        )}

        {output && (
          <>
            <div class="sql-results-meta">
              <span>
                {rows.length > MAX_DISPLAY_ROWS
                  ? `Showing first ${MAX_DISPLAY_ROWS} of ${rows.length} rows`
                  : `${rows.length} row${rows.length === 1 ? '' : 's'}`}
              </span>
              <span>{output.durationMs.toFixed(1)} ms</span>
            </div>

            <div class="sql-results-wrap">
              <table class="sql-table">
                {columns.length > 0 && (
                  <thead>
                    <tr>
                      {columns.map((col, idx) => (
                        <th key={idx} scope="col">
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                )}
                <tbody>
                  {columns.length === 0 ? (
                    <tr>
                      <td class="sql-empty">Query executed successfully (no rows returned).</td>
                    </tr>
                  ) : displayedRows.length === 0 ? (
                    <tr>
                      <td class="sql-empty" colSpan={columns.length}>
                        0 rows returned.
                      </td>
                    </tr>
                  ) : (
                    displayedRows.map((row, rIdx) => (
                      <tr key={rIdx}>
                        {row.map((cell, cIdx) => {
                          const isYt =
                            cIdx === ytColIdx && typeof cell === 'string' && cell.length > 0;
                          return (
                            <td key={cIdx}>
                              {isYt ? (
                                <a
                                  class="video-link"
                                  href={`https://youtu.be/${encodeURIComponent(cell)}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                >
                                  {cell}
                                </a>
                              ) : cell === null ? (
                                'NULL'
                              ) : (
                                String(cell)
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </section>
  );
}

import type { RefObject } from 'preact';
import { useMemo } from 'preact/hooks';
import type { Game, PreparedGame } from '#lib/wordle.ts';

interface GamesTableViewProps {
  pageGames: PreparedGame[];
  loadError: string;
  safePage: number;
  totalPages: number;
  tableTopRef: RefObject<HTMLDivElement | null>;
  onPageChange: (nextPage: number) => void;
  onWatchVideo: (game: Game) => void;
}

/**
 * Renders the paginated Wordle archive table with colored guess tiles and video links.
 */
export default function GamesTableView({
  pageGames,
  loadError,
  safePage,
  totalPages,
  tableTopRef,
  onPageChange,
  onWatchVideo,
}: GamesTableViewProps) {
  const tableRows = useMemo(
    () =>
      pageGames.map((g) => (
        <tr key={g.youtubeId || g.date}>
          <td class="col-date">{g.date || '—'}</td>
          <td class="col-solution">{g.correctWord}</td>
          <td class="col-guesses">
            <div class="guesses-list">
              {g.scoredGuesses.map((sg, idx) => (
                <span key={idx} class="guess-word" title={sg.word}>
                  {Array.from(sg.word).map((ch, k) => (
                    <span key={k} class={`mini-tile ${sg.colors[k]}`}>
                      {ch}
                    </span>
                  ))}
                </span>
              ))}
            </div>
          </td>
          <td>
            <span class={`score-badge ${g.solved ? 'win' : 'fail'}`}>
              {g.solved ? `${g.guesses.length}/6` : 'X/6'}
            </span>
          </td>
          <td class="col-time">
            {typeof g.solveTimeSeconds === 'number' && Number.isFinite(g.solveTimeSeconds)
              ? `${g.solveTimeSeconds.toFixed(1)}s`
              : '—'}
          </td>
          <td>
            {g.youtubeId ? (
              <a
                class="video-link"
                href={`https://youtu.be/${encodeURIComponent(g.youtubeId)}`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => {
                  if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
                  e.preventDefault();
                  onWatchVideo(g);
                }}
              >
                ▶ Watch
              </a>
            ) : (
              '—'
            )}
          </td>
        </tr>
      )),
    [pageGames, onWatchVideo]
  );

  return (
    <div class="table-card" ref={tableTopRef}>
      <div class="table-scroll">
        <table class="games-table">
          <thead>
            <tr>
              <th scope="col">Date</th>
              <th scope="col">Solution</th>
              <th scope="col">Mark's Guesses</th>
              <th scope="col">Score</th>
              <th scope="col">Time</th>
              <th scope="col">Video</th>
            </tr>
          </thead>
          <tbody>
            {loadError ? (
              <tr>
                <td colSpan={6} class="empty-state">
                  Error loading /data/solves.json: {loadError}
                </td>
              </tr>
            ) : pageGames.length === 0 ? (
              <tr>
                <td colSpan={6} class="empty-state">
                  No games match the current filters.
                </td>
              </tr>
            ) : (
              tableRows
            )}
          </tbody>
        </table>
      </div>

      <div class="pagination-bar">
        <div class="page-info">
          Page {safePage} of {totalPages}
        </div>
        <div class="pagination-controls">
          <button
            type="button"
            class="btn-secondary"
            disabled={safePage <= 1}
            onClick={() => onPageChange(safePage - 1)}
          >
            ← Prev
          </button>
          <button
            type="button"
            class="btn-secondary"
            disabled={safePage >= totalPages}
            onClick={() => onPageChange(safePage + 1)}
          >
            Next →
          </button>
        </div>
      </div>
    </div>
  );
}

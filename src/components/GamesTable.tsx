import { useEffect, useMemo, useRef, useState } from 'preact/hooks';

export interface Game {
  youtubeId: string;
  date: string;
  correctWord: string;
  guesses: string[];
  solveTimeSeconds: number | null;
}

interface GamesTableProps {
  initialGames?: Game[];
  initialTotal?: number;
  initialMonths?: string[];
}

type TileState = 'correct' | 'present' | 'absent';
type SortKey = 'newest' | 'oldest' | 'fastest' | 'slowest';

const PAGE_SIZE = 50;

function isSolved(game: Game): boolean {
  if (!Array.isArray(game.guesses) || game.guesses.length === 0 || game.guesses.length > 6) {
    return false;
  }
  const last = game.guesses[game.guesses.length - 1] ?? '';
  return last.toUpperCase() === (game.correctWord ?? '').toUpperCase();
}

function scoreGuess(guess: string, target: string): TileState[] {
  const g = (guess || '').toUpperCase();
  const t = (target || '').toUpperCase();
  const result = new Array<TileState>(g.length).fill('absent');
  const remaining: Record<string, number> = Object.create(null);

  for (let i = 0; i < t.length; i++) {
    const tc = t[i] ?? '';
    if (g[i] === tc) {
      result[i] = 'correct';
    } else if (tc) {
      remaining[tc] = (remaining[tc] ?? 0) + 1;
    }
  }

  for (let i = 0; i < g.length; i++) {
    if (result[i] === 'correct') continue;
    const ch = g[i] ?? '';
    const count = remaining[ch] ?? 0;
    if (ch && count > 0) {
      result[i] = 'present';
      remaining[ch] = count - 1;
    }
  }

  return result;
}

const VALID_ATTEMPTS = new Set(['all', '1', '2', '3', '4', '5', '6', 'X']);
const VALID_SORTS = new Set<SortKey>(['newest', 'oldest', 'fastest', 'slowest']);

function readFiltersFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const q = params.get('q') ?? '';
  const rawAtt = params.get('attempts') ?? 'all';
  const attempts = VALID_ATTEMPTS.has(rawAtt) ? rawAtt : 'all';
  const month = params.get('month') ?? 'all';
  const exactDate = params.get('date') ?? '';
  const fromDate = params.get('from') ?? '';
  const toDate = params.get('to') ?? '';
  const rawSort = (params.get('sort') ?? 'newest') as SortKey;
  const sortBy: SortKey = VALID_SORTS.has(rawSort) ? rawSort : 'newest';
  const rawPage = Number.parseInt(params.get('page') ?? '1', 10);
  const page = Number.isFinite(rawPage) && rawPage > 0 ? rawPage : 1;
  return { q, attempts, month, exactDate, fromDate, toDate, sortBy, page };
}

let ytApiPromise: Promise<void> | null = null;

function loadYtIframeApi(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  if (window.YT?.Player) return Promise.resolve();
  if (!ytApiPromise) {
    ytApiPromise = new Promise<void>((resolve) => {
      const prev = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        prev?.();
        resolve();
      };
      const script = document.createElement('script');
      script.src = 'https://www.youtube.com/iframe_api';
      script.async = true;
      document.head.appendChild(script);
    });
  }
  return ytApiPromise;
}

interface ScoredGuess {
  word: string;
  colors: TileState[];
}

interface PreparedGame extends Game {
  solved: boolean;
  upperWord: string;
  scoredGuesses: ScoredGuess[];
}

function prepareGames(games: Game[]): PreparedGame[] {
  return games.map((g) => {
    const upperWord = (g.correctWord || '').toUpperCase();
    const rawGuesses = Array.isArray(g.guesses) ? g.guesses : [];
    const scoredGuesses: ScoredGuess[] = rawGuesses.map((raw) => {
      const word = (raw || '').toUpperCase();
      return { word, colors: scoreGuess(word, upperWord) };
    });
    return {
      ...g,
      solved: isSolved(g),
      upperWord,
      scoredGuesses,
    };
  });
}

export default function GamesTable({
  initialGames = [],
  initialTotal = 0,
  initialMonths = [],
}: GamesTableProps) {
  const [allGames, setAllGames] = useState<PreparedGame[]>(() => prepareGames(initialGames));
  const [hasFullData, setHasFullData] = useState(false);
  const [loadError, setLoadError] = useState('');

  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [attempts, setAttempts] = useState('all');
  const [month, setMonth] = useState('all');
  const [exactDate, setExactDate] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [sortBy, setSortBy] = useState<SortKey>('newest');
  const [page, setPage] = useState(1);
  const [activeVideo, setActiveVideo] = useState<Game | null>(null);

  const urlReadyRef = useRef(false);
  const tableTopRef = useRef<HTMLDivElement | null>(null);
  const playerMountRef = useRef<HTMLDivElement | null>(null);
  const ytPlayerRef = useRef<{
    playVideo(): void;
    pauseVideo(): void;
    getPlayerState(): number;
    getCurrentTime(): number;
    seekTo(seconds: number, allowSeekAhead: boolean): void;
    destroy(): void;
  } | null>(null);

  useEffect(() => {
    if (!activeVideo) return;
    let cancelled = false;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    void loadYtIframeApi().then(() => {
      if (cancelled || !playerMountRef.current || !window.YT?.Player) return;
      playerMountRef.current.textContent = '';
      const target = document.createElement('div');
      playerMountRef.current.appendChild(target);
      ytPlayerRef.current = new window.YT.Player(target, {
        videoId: activeVideo.youtubeId,
        host: 'https://www.youtube-nocookie.com',
        playerVars: { autoplay: 1, rel: 0, enablejsapi: 1 },
      });
    });

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setActiveVideo(null);
        return;
      }
      const player = ytPlayerRef.current;
      if (!player) return;

      if (e.code === 'Space') {
        e.preventDefault();
        const playingState = window.YT?.PlayerState?.PLAYING ?? 1;
        if (player.getPlayerState() === playingState) {
          player.pauseVideo();
        } else {
          player.playVideo();
        }
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        player.seekTo(Math.max(0, player.getCurrentTime() - 10), true);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        player.seekTo(player.getCurrentTime() + 10, true);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => {
      cancelled = true;
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKeyDown);
      ytPlayerRef.current?.destroy();
      ytPlayerRef.current = null;
    };
  }, [activeVideo]);

  // Sync from URL on mount & browser Back/Forward
  useEffect(() => {
    function applyFromUrl() {
      const f = readFiltersFromUrl();
      setSearch(f.q);
      setDebouncedSearch(f.q);
      setAttempts(f.attempts);
      setMonth(f.month);
      setExactDate(f.exactDate);
      setFromDate(f.fromDate);
      setToDate(f.toDate);
      setSortBy(f.sortBy);
      setPage(f.page);
    }

    applyFromUrl();
    urlReadyRef.current = true;
    window.addEventListener('popstate', applyFromUrl);
    return () => window.removeEventListener('popstate', applyFromUrl);
  }, []);

  // 100ms debounce for word search
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(search);
    }, 100);
    return () => window.clearTimeout(timer);
  }, [search]);

  // Sync active filters back to URL
  useEffect(() => {
    if (!urlReadyRef.current) return;
    const params = new URLSearchParams();
    const q = debouncedSearch.trim();
    if (q) params.set('q', q);
    if (attempts !== 'all') params.set('attempts', attempts);
    if (month !== 'all') params.set('month', month);
    if (exactDate) params.set('date', exactDate);
    if (fromDate) params.set('from', fromDate);
    if (toDate) params.set('to', toDate);
    if (sortBy !== 'newest') params.set('sort', sortBy);
    if (page > 1) params.set('page', String(page));

    const qs = params.toString();
    const nextUrl = `${window.location.pathname}${qs ? `?${qs}` : ''}${window.location.hash}`;
    const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    if (nextUrl !== currentUrl) {
      window.history.replaceState(null, '', nextUrl);
    }
  }, [debouncedSearch, attempts, month, exactDate, fromDate, toDate, sortBy, page]);

  useEffect(() => {
    let active = true;
    fetch(`/data/solves.json?v=${__BUILD_ID__}`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data: unknown) => {
        if (!active) return;
        setAllGames(prepareGames(Array.isArray(data) ? (data as Game[]) : []));
        setHasFullData(true);
      })
      .catch((err: unknown) => {
        if (!active) return;
        setLoadError(err instanceof Error ? err.message : String(err));
      });
    return () => {
      active = false;
    };
  }, []);

  const months = useMemo(() => {
    if (!hasFullData && initialMonths.length > 0) return initialMonths;
    const set = new Set<string>();
    for (const g of allGames) {
      if (g.date && g.date.length >= 7) set.add(g.date.slice(0, 7));
    }
    return Array.from(set).sort((a, b) => b.localeCompare(a));
  }, [allGames, hasFullData, initialMonths]);

  const { filtered, filterMs } = useMemo(() => {
    const t0 = performance.now();
    const q = debouncedSearch.trim().toUpperCase();
    const out: PreparedGame[] = [];

    for (const g of allGames) {
      if (month !== 'all' && (!g.date || !g.date.startsWith(month))) continue;
      if (exactDate && g.date !== exactDate) continue;
      if (fromDate && g.date < fromDate) continue;
      if (toDate && g.date > toDate) continue;

      if (attempts !== 'all') {
        if (attempts === 'X') {
          if (g.solved) continue;
        } else if (!g.solved || String(g.guesses.length) !== attempts) {
          continue;
        }
      }

      if (q) {
        const solMatch = g.upperWord.includes(q);
        const guessMatch = g.scoredGuesses.some((sg) => sg.word.includes(q));
        if (!solMatch && !guessMatch) continue;
      }

      out.push(g);
    }

    if (sortBy === 'newest') {
      out.sort((a, b) => b.date.localeCompare(a.date));
    } else if (sortBy === 'oldest') {
      out.sort((a, b) => a.date.localeCompare(b.date));
    } else if (sortBy === 'fastest') {
      out.sort((a, b) => {
        const ta = typeof a.solveTimeSeconds === 'number' ? a.solveTimeSeconds : Infinity;
        const tb = typeof b.solveTimeSeconds === 'number' ? b.solveTimeSeconds : Infinity;
        return ta - tb || b.date.localeCompare(a.date);
      });
    } else if (sortBy === 'slowest') {
      out.sort((a, b) => {
        const ta = typeof a.solveTimeSeconds === 'number' ? a.solveTimeSeconds : -Infinity;
        const tb = typeof b.solveTimeSeconds === 'number' ? b.solveTimeSeconds : -Infinity;
        return tb - ta || b.date.localeCompare(a.date);
      });
    }

    return { filtered: out, filterMs: (performance.now() - t0).toFixed(2) };
  }, [allGames, debouncedSearch, attempts, month, exactDate, fromDate, toDate, sortBy]);

  const displayTotal = hasFullData ? filtered.length : Math.max(filtered.length, initialTotal);
  const totalPages = Math.max(1, Math.ceil(displayTotal / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const startIdx = (safePage - 1) * PAGE_SIZE;
  const endIdx = Math.min(startIdx + PAGE_SIZE, filtered.length);
  const pageGames = useMemo(() => filtered.slice(startIdx, endIdx), [filtered, startIdx, endIdx]);

  const tableRows = useMemo(
    () =>
      pageGames.map((g) => (
        <tr key={g.youtubeId || g.date}>
          <td class="col-date">{g.date || '—'}</td>
          <td class="col-solution">{g.upperWord}</td>
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
                  setActiveVideo(g);
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
    [pageGames]
  );

  function resetFilters() {
    setSearch('');
    setDebouncedSearch('');
    setAttempts('all');
    setMonth('all');
    setExactDate('');
    setFromDate('');
    setToDate('');
    setSortBy('newest');
    setPage(1);
  }

  function changePage(next: number) {
    setPage(next);
    tableTopRef.current?.scrollIntoView({ behavior: 'auto', block: 'start' });
  }

  const summaryText = loadError
    ? 'Failed to load games'
    : filtered.length === 0
      ? '0 matching games'
      : `Showing ${(startIdx + 1).toLocaleString('en-US')}–${endIdx.toLocaleString('en-US')} of ${displayTotal.toLocaleString('en-US')} games`;

  return (
    <section aria-label="Wordle games archive" class="archive-section">
      <div class="section-heading-row">
        <h2 class="section-heading">
          Solves{' '}
          <a href="/data/solves.json" target="_blank" rel="noopener noreferrer" class="section-json-link">
            .json
          </a>
        </h2>
      </div>

      <fieldset class="options-fieldset">
        <legend class="options-legend">Options</legend>
        <div class="filters-grid">
          <div class="filter-field">
            <label for="filter-search">Word Search</label>
            <input
              id="filter-search"
              class="filter-input"
              type="search"
              placeholder="Solution or guess (e.g. SLATE)"
              autocomplete="off"
              value={search}
              onInput={(e) => {
                setSearch(e.currentTarget.value);
                setPage(1);
              }}
            />
          </div>

          <div class="filter-field">
            <label for="filter-attempts">Attempts</label>
            <select
              id="filter-attempts"
              class="filter-select"
              value={attempts}
              onChange={(e) => {
                setAttempts(e.currentTarget.value);
                setPage(1);
              }}
            >
              <option value="all">All</option>
              <option value="1">1</option>
              <option value="2">2</option>
              <option value="3">3</option>
              <option value="4">4</option>
              <option value="5">5</option>
              <option value="6">6</option>
              <option value="X">Failed (X)</option>
            </select>
          </div>

          <div class="filter-field">
            <label for="filter-month">Month</label>
            <select
              id="filter-month"
              class="filter-select"
              value={month}
              onChange={(e) => {
                setMonth(e.currentTarget.value);
                setPage(1);
              }}
            >
              <option value="all">All Months</option>
              {months.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>

          <div class="filter-field">
            <label for="filter-date">Date</label>
            <input
              id="filter-date"
              class="filter-input"
              type="date"
              value={exactDate}
              onChange={(e) => {
                setExactDate(e.currentTarget.value);
                setPage(1);
              }}
            />
          </div>

          <div class="filter-field">
            <label for="filter-from">From Date</label>
            <input
              id="filter-from"
              class="filter-input"
              type="date"
              value={fromDate}
              onChange={(e) => {
                setFromDate(e.currentTarget.value);
                setPage(1);
              }}
            />
          </div>

          <div class="filter-field">
            <label for="filter-to">To Date</label>
            <input
              id="filter-to"
              class="filter-input"
              type="date"
              value={toDate}
              onChange={(e) => {
                setToDate(e.currentTarget.value);
                setPage(1);
              }}
            />
          </div>

          <div class="filter-field">
            <label for="filter-sort">Sort</label>
            <select
              id="filter-sort"
              class="filter-select"
              value={sortBy}
              onChange={(e) => {
                setSortBy(e.currentTarget.value as SortKey);
                setPage(1);
              }}
            >
              <option value="newest">Newest</option>
              <option value="oldest">Oldest</option>
              <option value="fastest">Fastest</option>
              <option value="slowest">Slowest</option>
            </select>
          </div>

          <button type="button" id="filter-reset" class="btn-secondary" onClick={resetFilters}>
            Reset
          </button>
        </div>

        <div class="results-meta" aria-live="polite">
          <span>{summaryText}</span>
          <span>{hasFullData && !loadError ? `${filterMs} ms` : ''}</span>
        </div>
      </fieldset>

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
              onClick={() => changePage(safePage - 1)}
            >
              ← Prev
            </button>
            <button
              type="button"
              class="btn-secondary"
              disabled={safePage >= totalPages}
              onClick={() => changePage(safePage + 1)}
            >
              Next →
            </button>
          </div>
        </div>
      </div>

      {activeVideo && (
        <div
          class="video-modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-label={`Wordle ${activeVideo.date} — ${activeVideo.correctWord}`}
          onClick={(e) => {
            if (e.target === e.currentTarget) setActiveVideo(null);
          }}
        >
          <div class="video-modal">
            <div class="video-modal-header">
              <div class="video-modal-title">
                <span class="video-modal-date">{activeVideo.date}</span>
                <span class="video-modal-word">{activeVideo.correctWord.toUpperCase()}</span>
                <span class={`score-badge ${isSolved(activeVideo) ? 'win' : 'fail'}`}>
                  {isSolved(activeVideo) ? `${activeVideo.guesses.length}/6` : 'X/6'}
                </span>
                {typeof activeVideo.solveTimeSeconds === 'number' && (
                  <span class="video-modal-time">{activeVideo.solveTimeSeconds.toFixed(1)}s</span>
                )}
              </div>
              <div class="video-modal-actions">
                <a
                  class="video-modal-ext"
                  href={`https://youtu.be/${encodeURIComponent(activeVideo.youtubeId)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  YouTube ↗
                </a>
                <button
                  type="button"
                  class="video-modal-close"
                  aria-label="Close video"
                  onClick={() => setActiveVideo(null)}
                >
                  ✕
                </button>
              </div>
            </div>
            <div class="video-modal-player" ref={playerMountRef} />
            <div class="video-modal-footer">
              <span>Space: play/pause · ←/→: ±10s · Esc: close</span>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

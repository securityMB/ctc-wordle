import { useCallback, useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { prepareGames, type Game, type PreparedGame, type SortKey } from '../lib/wordle.ts';
import GamesFilters from './GamesFilters.tsx';
import GamesTableView from './GamesTableView.tsx';
import VideoModal from './VideoModal.tsx';

export { isSolved, scoreGuess, type Game } from '../lib/wordle.ts';

interface GamesTableProps {
  initialGames?: Game[];
  initialTotal?: number;
  initialMonths?: string[];
}

const PAGE_SIZE = 50;
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

/**
 * Interactive, filterable, and paginated archive of all Wordle solves.
 * Hydrates with SSG-provided initial rows and fetches `/data/solves.json` for full client-side search.
 */
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
        const solMatch = g.correctWord.includes(q);
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

  const changePage = useCallback((next: number) => {
    setPage(next);
    tableTopRef.current?.scrollIntoView({ behavior: 'auto', block: 'start' });
  }, []);

  const closeVideo = useCallback(() => setActiveVideo(null), []);

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
          <a
            href="/data/solves.json"
            target="_blank"
            rel="noopener noreferrer"
            class="section-json-link"
          >
            .json
          </a>
        </h2>
      </div>

      <GamesFilters
        search={search}
        attempts={attempts}
        month={month}
        months={months}
        exactDate={exactDate}
        fromDate={fromDate}
        toDate={toDate}
        sortBy={sortBy}
        summaryText={summaryText}
        filterMs={filterMs}
        showTiming={hasFullData && !loadError}
        onSearchChange={(value) => {
          setSearch(value);
          setPage(1);
        }}
        onAttemptsChange={(value) => {
          setAttempts(value);
          setPage(1);
        }}
        onMonthChange={(value) => {
          setMonth(value);
          setPage(1);
        }}
        onExactDateChange={(value) => {
          setExactDate(value);
          setPage(1);
        }}
        onFromDateChange={(value) => {
          setFromDate(value);
          setPage(1);
        }}
        onToDateChange={(value) => {
          setToDate(value);
          setPage(1);
        }}
        onSortChange={(value) => {
          setSortBy(value);
          setPage(1);
        }}
        onReset={resetFilters}
      />

      <GamesTableView
        pageGames={pageGames}
        loadError={loadError}
        safePage={safePage}
        totalPages={totalPages}
        tableTopRef={tableTopRef}
        onPageChange={changePage}
        onWatchVideo={setActiveVideo}
      />

      {activeVideo && <VideoModal game={activeVideo} onClose={closeVideo} />}
    </section>
  );
}

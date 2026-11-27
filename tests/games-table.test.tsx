// @vitest-environment happy-dom
import { render } from 'preact';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import GamesTable, { isSolved, scoreGuess, type Game } from '../src/components/GamesTable.tsx';

const MOCK_GAMES: Game[] = [
  {
    youtubeId: 'abc123',
    date: '2026-05-02',
    correctWord: 'CRANE',
    guesses: ['SLATE', 'CRANE'],
    solveTimeSeconds: 18.5,
  },
  {
    youtubeId: 'def456',
    date: '2026-05-01',
    correctWord: 'JAZZY',
    guesses: ['SLATE', 'CRANE', 'MOUND', 'GIPSY', 'BUMPY', 'FUZZY'],
    solveTimeSeconds: null,
  },
];

describe('Wordle scoring helpers', () => {
  it('scores duplicate letters accurately', () => {
    // Target: CRANE, Guess: EERIE -> first E is absent (wait: E is at pos 4 in CRANE),
    // E(0) present? No, pos 4 is exact match ('correct'), so remaining E count is 0 -> E(0) absent!
    expect(scoreGuess('EERIE', 'CRANE')).toEqual([
      'absent',
      'absent',
      'present',
      'absent',
      'correct',
    ]);
    expect(scoreGuess('crane', 'CRANE')).toEqual([
      'correct',
      'correct',
      'correct',
      'correct',
      'correct',
    ]);
  });

  it('checks solved state with 6-guess limit and case-insensitivity', () => {
    expect(isSolved(MOCK_GAMES[0]!)).toEqual(true);
    expect(isSolved(MOCK_GAMES[1]!)).toEqual(false);
    expect(
      isSolved({
        youtubeId: 'x',
        date: '2026-01-01',
        correctWord: 'CRANE',
        guesses: ['A', 'B', 'C', 'D', 'E', 'F', 'CRANE'],
        solveTimeSeconds: 10,
      })
    ).toEqual(false);
  });
});

describe('GamesTable rendering and filtering', () => {
  let host: HTMLDivElement;

  beforeEach(() => {
    host = document.createElement('div');
    document.body.appendChild(host);
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve(
          new Response(JSON.stringify(MOCK_GAMES), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })
        )
      )
    );
  });

  afterEach(() => {
    render(null, host);
    host.remove();
    vi.unstubAllGlobals();
  });

  it('renders rows with semantic table headers, live region, and colored tiles', () => {
    render(
      <GamesTable initialGames={MOCK_GAMES} initialTotal={2} initialMonths={['2026-05']} />,
      host
    );

    const headers = Array.from(host.querySelectorAll('th'));
    expect(headers).toHaveLength(6);
    expect(headers.every((th) => th.getAttribute('scope') === 'col')).toEqual(true);

    const meta = host.querySelector('.results-meta');
    expect(meta?.getAttribute('aria-live')).toEqual('polite');

    const rows = Array.from(host.querySelectorAll('tbody tr'));
    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r.querySelector('.col-date')?.textContent)).toEqual([
      '2026-05-02',
      '2026-05-01',
    ]);
    expect(rows.map((r) => r.querySelector('.col-solution')?.textContent)).toEqual([
      'CRANE',
      'JAZZY',
    ]);
    expect(rows.map((r) => r.querySelector('.score-badge')?.textContent)).toEqual(['2/6', 'X/6']);
    expect(rows.map((r) => r.querySelector('.col-time')?.textContent)).toEqual(['18.5s', '—']);
    expect(
      Array.from(rows[0]!.querySelectorAll('.guess-word')).map((el) => el.getAttribute('title'))
    ).toEqual(['SLATE', 'CRANE']);
  });

  it('filters by attempts and resets cleanly', async () => {
    render(
      <GamesTable initialGames={MOCK_GAMES} initialTotal={2} initialMonths={['2026-05']} />,
      host
    );

    // Allow mount effects (URL sync & initial fetch) to settle before interacting
    await new Promise((r) => setTimeout(r, 20));

    const attemptsSelect = host.querySelector('#filter-attempts') as HTMLSelectElement;
    attemptsSelect.value = 'X';
    attemptsSelect.dispatchEvent(new Event('change', { bubbles: true }));

    await vi.waitFor(() => {
      const rowsAfterFilter = host.querySelectorAll('tbody tr');
      expect(rowsAfterFilter).toHaveLength(1);
    });
    expect(host.querySelector('tbody .col-solution')?.textContent).toEqual('JAZZY');

    const resetBtn = host.querySelector('#filter-reset') as HTMLButtonElement;
    resetBtn.click();
    await vi.waitFor(() => {
      expect(host.querySelectorAll('tbody tr')).toHaveLength(2);
    });
  });
});

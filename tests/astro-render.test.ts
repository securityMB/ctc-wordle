import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { Window } from 'happy-dom';
import { describe, expect, it } from 'vitest';
import Layout from '../src/layouts/Layout.astro';
import StatsBar from '../src/components/StatsBar.astro';
import type { RawGame } from '../src/lib/games.ts';

const SAMPLE_GAMES: RawGame[] = [
  {
    youtubeId: 'vid-1',
    date: '2026-01-01',
    correctWord: 'CRANE',
    guesses: ['SLATE', 'CRANE'],
    solveTimeSeconds: 12.4,
  },
  {
    youtubeId: 'vid-2',
    date: '2026-01-02',
    correctWord: 'AUDIO',
    guesses: ['STARE', 'AUDIO'],
    solveTimeSeconds: 20.0,
  },
  {
    youtubeId: 'vid-3',
    date: '2026-01-03',
    correctWord: 'JAZZY',
    guesses: ['SLATE', 'BRICK', 'MOUND', 'GIPSY', 'HAIRY', 'FUZZY'],
    solveTimeSeconds: null,
  },
  {
    youtubeId: 'vid-4',
    date: '2026-01-04',
    correctWord: 'HOUSE',
    guesses: ['STARE', 'LOUSE', 'MOUSE', 'HOUSE'],
    solveTimeSeconds: 30.6,
  },
];

function parseHtml(html: string) {
  const win = new Window();
  win.document.write(html);
  return win.document;
}

describe('Astro components rendering', () => {
  it('renders StatsBar with accurate totals, win rate, streaks, and times', async () => {
    const container = await AstroContainer.create();
    const html = await container.renderToString(StatsBar, {
      props: { games: SAMPLE_GAMES },
    });
    const doc = parseHtml(html);

    const cards = Array.from(doc.querySelectorAll('.stat-card')).map((card) => ({
      label: card.querySelector('.stat-label')?.textContent,
      value: card.querySelector('.stat-value')?.textContent,
      sub: card.querySelector('.stat-sub')?.textContent,
    }));

    expect(cards).toEqual([
      { label: 'Total Games', value: '4', sub: '3 solved' },
      { label: 'Win Rate', value: '75.0%', sub: '1 failed' },
      { label: 'Avg Guesses', value: '2.67', sub: 'On solved games' },
      { label: 'Median Time', value: '20.0s', sub: 'Fastest: 12.4s' },
      { label: 'Current Streak', value: '1', sub: 'Max: 2' },
    ]);
  });

  it('renders Layout with SEO/OG meta and accessible header', async () => {
    const container = await AstroContainer.create();
    const html = await container.renderToString(Layout, {
      props: {
        title: 'Custom Test Title',
        description: 'Custom test description',
      },
    });
    const doc = parseHtml(html);

    expect(doc.title).toEqual('Custom Test Title');
    expect(doc.querySelector('meta[name="description"]')?.getAttribute('content')).toEqual(
      'Custom test description'
    );
    expect(doc.querySelector('link[rel="canonical"]')?.getAttribute('href')).toEqual(
      'https://example.com/'
    );
    expect(doc.querySelector('meta[property="og:title"]')?.getAttribute('content')).toEqual(
      'Custom Test Title'
    );
    expect(doc.querySelector('meta[name="twitter:card"]')?.getAttribute('content')).toEqual('summary');
    expect(doc.querySelector('.brand-link')?.getAttribute('tabindex')).toBeNull();
    expect(doc.querySelector('#theme-toggle')?.getAttribute('aria-pressed')).toEqual('false');
  });
});

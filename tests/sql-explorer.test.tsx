// @vitest-environment happy-dom
import fs from 'node:fs';
import path from 'node:path';
import { render } from 'preact';
import initSqlJs from 'sql.js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import SqlExplorer from '../src/components/SqlExplorer.tsx';
import { SQL_PRESETS } from '../src/scripts/sqlExplorer.ts';

vi.mock('../src/scripts/sqlExplorer.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/scripts/sqlExplorer.ts')>();
  return {
    ...actual,
    getDatabase: vi.fn(() => Promise.resolve()),
    runSqlQuery: vi.fn(() =>
      Promise.resolve({
        results: [
          {
            columns: ['date', 'correct_word'],
            values: [['2026-05-02', 'CRANE']],
          },
        ],
        durationMs: 1.5,
      })
    ),
  };
});

describe('SqlExplorer rendering', () => {
  let host: HTMLDivElement;

  beforeEach(() => {
    host = document.createElement('div');
    document.body.appendChild(host);
  });

  afterEach(() => {
    render(null, host);
    host.remove();
  });

  it('renders subtitle, wordle.sqlite download link, presets, and semantic table headers', async () => {
    render(<SqlExplorer />, host);

    const subtitle = host.querySelector('.sql-subtitle');
    expect(subtitle?.textContent).toBe(
      'Query the full Wordle archive directly in your browser using SQLite, or download wordle.sqlite.'
    );

    const downloadLink = host.querySelector('a[download="wordle.sqlite"]') as HTMLAnchorElement | null;
    expect(downloadLink?.getAttribute('href')).toBe('/data/wordle.sqlite');
    expect(downloadLink?.textContent).toBe('download wordle.sqlite');

    const presetButtons = host.querySelectorAll('.sql-preset-btn');
    expect(presetButtons).toHaveLength(SQL_PRESETS.length);

    // Wait for initial async query execution
    await vi.waitFor(() => {
      expect(host.querySelectorAll('.sql-table th')).toHaveLength(2);
    });
    const ths = Array.from(host.querySelectorAll('.sql-table th'));
    expect(ths.map((th) => th.textContent)).toEqual(['date', 'correct_word']);
    expect(ths.every((th) => th.getAttribute('scope') === 'col')).toBe(true);
    expect(
      Array.from(host.querySelectorAll('.sql-table tbody td')).map((td) => td.textContent)
    ).toEqual(['2026-05-02', 'CRANE']);
  });
});

describe('Generated wordle.sqlite database', () => {
  it('executes all SQL_PRESETS against public/data/wordle.sqlite without error', async () => {
    const dbPath = path.resolve(process.cwd(), 'public/data/wordle.sqlite');
    expect(fs.existsSync(dbPath)).toBe(true);

    const SQL = await initSqlJs();
    const db = new SQL.Database(fs.readFileSync(dbPath));
    try {
      for (const preset of SQL_PRESETS) {
        const res = db.exec(preset.sql);
        expect(res.length, `Preset "${preset.id}" returned no result set`).toBeGreaterThan(0);
        expect(res[0]!.values.length, `Preset "${preset.id}" returned 0 rows`).toBeGreaterThan(0);
      }
    } finally {
      db.close();
    }
  });
});

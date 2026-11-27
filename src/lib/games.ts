import fs from 'node:fs';
import path from 'node:path';

export interface RawGame {
  youtubeId: string;
  date: string;
  correctWord: string;
  guesses: string[];
  solveTimeSeconds: number | null;
}

/**
 * Loads, validates, and deduplicates all monthly Wordle JSON files (`data/20*.json`),
 * returning games sorted newest-first.
 *
 * Throws if any file does not contain a JSON array or if two games share the same date.
 */
export function loadAllGames(dataDir = path.join(process.cwd(), 'data')): RawGame[] {
  const allGames: RawGame[] = [];

  if (fs.existsSync(dataDir)) {
    const files = fs
      .readdirSync(dataDir)
      .filter((f) => /^20.*\.json$/.test(f))
      .sort();

    for (const file of files) {
      const raw = fs.readFileSync(path.join(dataDir, file), 'utf-8');
      const parsed: unknown = JSON.parse(raw);
      if (!Array.isArray(parsed)) {
        throw new Error(`Invalid format in ${file}: expected a JSON array`);
      }

      for (const item of parsed) {
        const g = item as Partial<RawGame>;
        allGames.push({
          youtubeId: String(g.youtubeId ?? ''),
          date: String(g.date ?? ''),
          correctWord: String(g.correctWord ?? ''),
          guesses: Array.isArray(g.guesses) ? g.guesses.map(String) : [],
          solveTimeSeconds:
            typeof g.solveTimeSeconds === 'number' && Number.isFinite(g.solveTimeSeconds)
              ? g.solveTimeSeconds
              : null,
        });
      }
    }
  }

  const seenDates = new Map<string, string>();
  for (const game of allGames) {
    const existingId = seenDates.get(game.date);
    if (existingId !== undefined) {
      throw new Error(
        `Duplicate date "${game.date}" found for youtubeId "${existingId}" and "${game.youtubeId}"`
      );
    }
    seenDates.set(game.date, game.youtubeId);
  }

  allGames.sort((a, b) => b.date.localeCompare(a.date));
  return allGames;
}

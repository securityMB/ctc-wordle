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
 * Loads all monthly Wordle JSON files from `data/20*.json` sorted newest-first.
 */
export function loadAllGames(): RawGame[] {
  const dataDir = path.join(process.cwd(), 'data');
  const allGames: RawGame[] = [];

  if (fs.existsSync(dataDir)) {
    const files = fs
      .readdirSync(dataDir)
      .filter((f) => /^20.*\.json$/.test(f))
      .sort();

    for (const file of files) {
      const raw = fs.readFileSync(path.join(dataDir, file), 'utf-8');
      const parsed: unknown = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        allGames.push(...(parsed as RawGame[]));
      }
    }
  }

  allGames.sort((a, b) => b.date.localeCompare(a.date) || b.youtubeId.localeCompare(a.youtubeId));
  return allGames;
}

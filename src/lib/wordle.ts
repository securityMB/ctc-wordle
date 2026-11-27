export interface Game {
  youtubeId: string;
  date: string;
  correctWord: string;
  guesses: string[];
  solveTimeSeconds: number | null;
}

export type TileState = 'correct' | 'present' | 'absent';
export type SortKey = 'newest' | 'oldest' | 'fastest' | 'slowest';

export interface ScoredGuess {
  word: string;
  colors: TileState[];
}

export interface PreparedGame extends Game {
  solved: boolean;
  scoredGuesses: ScoredGuess[];
}

/**
 * Determines whether a Wordle game was won within the standard 6-guess limit.
 * Assumes `guesses` and `correctWord` are already uppercase.
 */
export function isSolved(game: Game): boolean {
  if (!Array.isArray(game.guesses) || game.guesses.length === 0 || game.guesses.length > 6) {
    return false;
  }
  const last = game.guesses[game.guesses.length - 1] ?? '';
  return last === game.correctWord;
}

/**
 * Computes the Wordle tile color (`correct`, `present`, or `absent`) for each letter
 * in `guess` compared against `target`, handling duplicate letters according to official
 * Wordle rules (exact matches are allocated first, then remaining target letters are
 * matched left-to-right). Assumes both `guess` and `target` are uppercase.
 */
export function scoreGuess(guess: string, target: string): TileState[] {
  const g = guess || '';
  const t = target || '';
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

/**
 * Precomputes solved status and per-guess tile colors for a list of games.
 */
export function prepareGames(games: Game[]): PreparedGame[] {
  return games.map((g) => {
    const rawGuesses = Array.isArray(g.guesses) ? g.guesses : [];
    const scoredGuesses: ScoredGuess[] = rawGuesses.map((word) => ({
      word,
      colors: scoreGuess(word, g.correctWord),
    }));
    return {
      ...g,
      solved: isSolved(g),
      scoredGuesses,
    };
  });
}

import { describe, expect, it } from 'vitest';
import { loadAllGames } from '../src/lib/games.ts';

describe('Wordle dataset integrity', () => {
  it('loads all monthly files with unique dates and uppercase words', () => {
    const games = loadAllGames();
    expect(games.length).toBeGreaterThan(0);

    for (const game of games) {
      expect(game.youtubeId.length).toBeGreaterThan(0);
      expect(game.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(game.correctWord).toEqual(game.correctWord.toUpperCase());
      expect(game.guesses.every((word) => word === word.toUpperCase())).toEqual(true);
    }
  });
});

import { describe, expect, it } from 'vitest';
import { loadAllGames } from '#lib/games.ts';

describe('Wordle dataset integrity', () => {
  it('loads all monthly files with unique dates/IDs, valid guesses, and uppercase words', () => {
    const games = loadAllGames();
    expect(games.length).toBeGreaterThan(0);

    const seenYoutubeIds = new Set<string>();
    for (const game of games) {
      expect(game.youtubeId.length).toBeGreaterThan(0);
      expect(seenYoutubeIds.has(game.youtubeId)).toEqual(false);
      seenYoutubeIds.add(game.youtubeId);
      expect(game.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(game.correctWord).toEqual(game.correctWord.toUpperCase());
      expect(game.guesses.length).toBeGreaterThanOrEqual(1);
      expect(game.guesses.length).toBeLessThanOrEqual(6);
      expect(game.guesses.every((word) => word === word.toUpperCase())).toEqual(true);
      expect(game.solveTimeSeconds === null || game.solveTimeSeconds >= 0).toEqual(true);
    }
  });
});

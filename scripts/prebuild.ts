import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import initSqlJs from 'sql.js';
import { loadAllGames } from '../lib/games.ts';
import { isSolved } from '../lib/wordle.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const dataDir = path.join(rootDir, 'data');
const outDir = path.join(rootDir, 'public', 'data');

fs.mkdirSync(outDir, { recursive: true });

// 1. Read and validate all data/20*.json files
const games = loadAllGames(dataDir);

// 2. Write compact public/data/solves.json
const solvesJsonPath = path.join(outDir, 'solves.json');
fs.writeFileSync(solvesJsonPath, JSON.stringify(games));

// 3. Build public/data/wordle.sqlite via sql.js
const wasmSrc = path.join(rootDir, 'node_modules', 'sql.js', 'dist', 'sql-wasm.wasm');
const wasmDst = path.join(outDir, 'sql-wasm.wasm');
fs.copyFileSync(wasmSrc, wasmDst);

const SQL = await initSqlJs({
  locateFile: () => wasmSrc,
});
const db = new SQL.Database();

db.run(`
  CREATE TABLE games (
    youtube_id TEXT PRIMARY KEY,
    date TEXT,
    correct_word TEXT,
    attempts INTEGER,
    solved INTEGER,
    solve_time_seconds REAL
  );

  CREATE TABLE guesses (
    youtube_id TEXT,
    row_num INTEGER,
    word TEXT
  );
`);

db.run('BEGIN TRANSACTION;');
const insertGame = db.prepare(
  'INSERT INTO games (youtube_id, date, correct_word, attempts, solved, solve_time_seconds) VALUES (?, ?, ?, ?, ?, ?)'
);
const insertGuess = db.prepare('INSERT INTO guesses (youtube_id, row_num, word) VALUES (?, ?, ?)');

for (const g of games) {
  const solved = isSolved(g) ? 1 : 0;
  const attempts = g.guesses.length;
  insertGame.run([g.youtubeId, g.date, g.correctWord, attempts, solved, g.solveTimeSeconds]);
  for (let i = 0; i < g.guesses.length; i++) {
    insertGuess.run([g.youtubeId, i + 1, g.guesses[i] ?? '']);
  }
}

insertGame.free();
insertGuess.free();
db.run('COMMIT;');

db.run(`
  CREATE INDEX idx_games_date ON games(date);
  CREATE INDEX idx_games_attempts ON games(attempts);
  CREATE INDEX idx_games_solve_time ON games(solve_time_seconds);
  CREATE INDEX idx_guesses_word ON guesses(word);
  CREATE INDEX idx_guesses_youtube_id ON guesses(youtube_id);
`);

const dbBytes = db.export();
const dbPath = path.join(outDir, 'wordle.sqlite');
fs.writeFileSync(dbPath, Buffer.from(dbBytes));
db.close();

console.log(
  `prebuild complete: ${games.length} games -> solves.json (${(
    fs.statSync(solvesJsonPath).size / 1024
  ).toFixed(1)} KB), wordle.sqlite (${(fs.statSync(dbPath).size / 1024).toFixed(
    1
  )} KB), sql-wasm.wasm`
);

import { createHash } from 'node:crypto';
import fs from 'node:fs';
import { defineConfig } from 'astro/config';
import preact from '@astrojs/preact';

const wasmBytes = fs.readFileSync(
  new URL('./node_modules/sql.js/dist/sql-wasm.wasm', import.meta.url)
);
const sqlWasmHash = createHash('sha256').update(wasmBytes).digest('hex');
const buildId = Date.now().toString(36);

export default defineConfig({
  site: 'https://ctc-wordle.netlify.app',
  output: 'static',
  integrations: [preact()],
  vite: {
    define: {
      __BUILD_ID__: JSON.stringify(buildId),
      __SQL_WASM_HASH__: JSON.stringify(sqlWasmHash),
    },
  },
});

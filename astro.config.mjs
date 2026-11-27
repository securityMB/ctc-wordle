import fs from 'node:fs';
import { defineConfig } from 'astro/config';
import preact from '@astrojs/preact';

const { version: sqlJsVersion } = JSON.parse(
  fs.readFileSync(new URL('./node_modules/sql.js/package.json', import.meta.url), 'utf8')
);
const buildId = Date.now().toString(36);

export default defineConfig({
  site: 'https://ctc-wordle.netlify.app',
  output: 'static',
  integrations: [preact()],
  vite: {
    define: {
      __BUILD_ID__: JSON.stringify(buildId),
      __SQL_JS_VERSION__: JSON.stringify(sqlJsVersion),
    },
  },
});

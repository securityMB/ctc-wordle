import { defineConfig } from 'astro/config';
import preact from '@astrojs/preact';

const buildId = Date.now().toString(36);

export default defineConfig({
  site: 'https://ctc-wordle.netlify.app',
  output: 'static',
  integrations: [preact()],
  vite: {
    define: {
      __BUILD_ID__: JSON.stringify(buildId),
    },
  },
});

import { defineConfig } from 'astro/config';
import preact from '@astrojs/preact';

const buildId = Date.now().toString(36);

export default defineConfig({
  output: 'static',
  integrations: [preact()],
  vite: {
    define: {
      __BUILD_ID__: JSON.stringify(buildId),
    },
  },
});

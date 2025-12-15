// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

import tailwindcss from '@tailwindcss/vite';

// https://astro.build/config
export default defineConfig({
  site: 'https://www.kalyanai.io',
  integrations: [sitemap()],
  vite: {
    server: {
      allowedHosts: ['dev.kalyanai.io'],
    },

    plugins: [tailwindcss()],
  },
});

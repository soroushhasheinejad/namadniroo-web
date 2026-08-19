// @ts-check
import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://namadniroo.ir',
  build: { format: 'file' },   // /projects.html style URLs — portable to any host
  compressHTML: true,
});

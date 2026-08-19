// @ts-check
import { defineConfig } from 'astro/config';

import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://namadniroo.ir',

  // /projects.html style URLs — portable to any host
  build: { format: 'file' },

  compressHTML: true,

  integrations: [
    sitemap({
      // صفحهٔ ۴۰۴ نباید در نقشهٔ سایت بیاید
      filter: (page) => !page.includes('/404'),
      changefreq: 'weekly',
      lastmod: new Date(),

      // این افزونه از build.format:'file' خبر ندارد و آدرس‌ها را بدون پسوند
      // می‌سازد. اگر اصلاح نشود، نقشهٔ سایت به آدرس‌هایی اشاره می‌کند که
      // خودشان ۳۰۱ می‌خورند — و گوگل باید برای هر صفحه یک ریدایرکت را دنبال کند.
      // اینجا آدرس‌ها را دقیقاً هم‌شکل تگ canonical می‌کنیم.
      serialize(item) {
        const url = new URL(item.url);
        if (url.pathname === '/' || url.pathname === '') {
          url.pathname = '/';
        } else if (!url.pathname.endsWith('.html')) {
          url.pathname = url.pathname.replace(/\/+$/, '') + '.html';
        }
        item.url = url.href;
        return item;
      },
    }),
  ],
});
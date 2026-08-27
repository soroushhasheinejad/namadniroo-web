// @ts-check
import { defineConfig } from 'astro/config';

import sitemap from '@astrojs/sitemap';
import node from '@astrojs/node';

export default defineConfig({
  site: 'https://namadniroo.ir',

  // /projects.html style URLs — portable to any host
  build: { format: 'file' },

  compressHTML: true,

  /* همهٔ صفحات همچنان در زمان بیلد ساخته و به‌صورت استاتیک سرو می‌شوند.
     فقط مسیرهایی که صریحاً `prerender = false` دارند (یعنی API فرم و پنل
     لیدها) روی سرور اجرا می‌شوند. */
  adapter: node({ mode: 'standalone' }),

  /* ریدایرکت آدرس‌های قدیمی وردپرس.
     قبلاً این‌ها در .htaccess بودند؛ چون میزبان جدید آپاچی نیست و آن فایل
     خوانده نمی‌شود، به تنظیمات خود Astro منتقل شدند تا با هر میزبانی کار کنند. */
  redirects: {
    '/contact-us': '/contact.html',
    '/about-us': '/about.html',
    '/cart': '/shop.html',
    '/checkout': '/shop.html',
    '/my-account': '/contact.html',
    '/wishlist': '/shop.html',
    // ریدایرکت‌های الگودار (مثل /product/هرچیزی) در src/pages/ تعریف شده‌اند،
    // چون این تنظیمات فقط آدرس‌های ثابت را می‌پذیرد.
  },

  integrations: [
    sitemap({
      // صفحهٔ ۴۰۴ نباید در نقشهٔ سایت بیاید
      filter: (page) => !page.includes('/404') && !page.includes('/leads'),
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

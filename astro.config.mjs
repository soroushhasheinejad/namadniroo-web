// @ts-check
import { defineConfig } from 'astro/config';

import sitemap from '@astrojs/sitemap';
import node from '@astrojs/node';
import pruneUnusedAssets from './src/integrations/prune-unused-assets';

export default defineConfig({
  site: 'https://namadniroo.ir',

  /* آدرس‌های تمیز و بدون پسوند: /projects به‌جای /projects.html
     این همان شکلی است که سایت وردپرسی فعلی دارد، پس لینک‌های ایندکس‌شده
     در گوگل بعد از انتقال بدون ریدایرکت هم درست کار می‌کنند. */
  build: { format: 'directory' },
  trailingSlash: 'never',

  compressHTML: true,

  /* همهٔ صفحات همچنان در زمان بیلد ساخته و به‌صورت استاتیک سرو می‌شوند.
     فقط مسیرهایی که صریحاً `prerender = false` دارند (یعنی API فرم و پنل
     لیدها) روی سرور اجرا می‌شوند. */
  adapter: node({ mode: 'standalone' }),

  /* ریدایرکت آدرس‌های قدیمی وردپرس.
     قبلاً این‌ها در .htaccess بودند؛ چون میزبان جدید آپاچی نیست و آن فایل
     خوانده نمی‌شود، به تنظیمات خود Astro منتقل شدند تا با هر میزبانی کار کنند. */
  redirects: {
    '/contact-us': '/contact',
    '/about-us': '/about',
    '/cart': '/shop',
    '/checkout': '/shop',
    '/my-account': '/contact',
    '/wishlist': '/shop',
    // ریدایرکت‌های الگودار (مثل /product/هرچیزی) در src/pages/ تعریف شده‌اند،
    // چون این تنظیمات فقط آدرس‌های ثابت را می‌پذیرد.
  },

  integrations: [
    sitemap({
      // صفحهٔ ۴۰۴ و مسیرهای غیرمحتوایی نباید در نقشهٔ سایت بیایند
      filter: (page) =>
        !page.includes('/404') && !page.includes('/leads') && !page.includes('/health'),
      changefreq: 'weekly',
      lastmod: new Date(),

      // افزونه آدرس‌ها را با اسلش انتهایی می‌سازد؛ اینجا حذفش می‌کنیم تا
      // دقیقاً هم‌شکل تگ canonical باشند و گوگل مجبور به دنبال‌کردن ریدایرکت نشود.
      serialize(item) {
        const url = new URL(item.url);
        if (url.pathname !== '/') {
          url.pathname = url.pathname.replace(/\/+$/, '');
        }
        item.url = url.href;
        return item;
      },
    }),

    /* نسخهٔ اصلی تصاویری که فقط شکل بهینه‌شدهٔ آن‌ها استفاده می‌شود از خروجی
       پاک می‌شود — بدون این کار حدود ۳٫۵ مگابایت JPG بی‌مصرف دیپلوی می‌شد. */
    pruneUnusedAssets(),
  ],
});

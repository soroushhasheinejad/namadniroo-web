// @ts-check
import { defineConfig } from 'astro/config';

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

    /* نسخهٔ اصلی تصاویری که فقط شکل بهینه‌شدهٔ آن‌ها استفاده می‌شود از خروجی
       پاک می‌شود — بدون این کار حدود ۳٫۵ مگابایت JPG بی‌مصرف دیپلوی می‌شد. */
    pruneUnusedAssets(),
  ],
});

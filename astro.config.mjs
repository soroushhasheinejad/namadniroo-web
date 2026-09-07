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

  /* Astro برای جلوگیری از CSRF، فرم‌های POST را فقط از دامنهٔ خودِ سایت
     می‌پذیرد و برای این کار نشانی درخواست را از هدرها می‌سازد.
     اپ پشت پراکسی میزبان اجرا می‌شود، پس دامنهٔ واقعی فقط در
     `X-Forwarded-Host` می‌آید — و Astro این هدر را تا وقتی صراحتاً مجاز
     نشده باشد نادیده می‌گیرد (که درست است: وگرنه هر کسی می‌توانست با جعل
     همین هدر نشانی سایت را عوض کند).
     بدون این فهرست، همهٔ فرم‌های پنل روی سرور خطای ۴۰۳ می‌گرفتند. */
  security: {
    allowedDomains: [
      { hostname: 'namadniroo.ir', protocol: 'https' },
      { hostname: '**.namadniroo.ir', protocol: 'https' },
      // زیردامنهٔ رایگان لیارا، برای تست پیش از اتصال دامنهٔ اصلی
      { hostname: '**.liara.run', protocol: 'https' },
      // توسعهٔ محلی
      { hostname: 'localhost' },
      { hostname: '127.0.0.1' },
    ],
  },

  integrations: [

    /* نسخهٔ اصلی تصاویری که فقط شکل بهینه‌شدهٔ آن‌ها استفاده می‌شود از خروجی
       پاک می‌شود — بدون این کار حدود ۳٫۵ مگابایت JPG بی‌مصرف دیپلوی می‌شد. */
    pruneUnusedAssets(),
  ],
});

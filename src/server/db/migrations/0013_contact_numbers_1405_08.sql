/* شمارهٔ تماس تازهٔ شرکت (آبان ۱۴۰۵): تلفن ثابت ۰۳۴ ۳۲۵۲۱۴۱۶ کنار گذاشته
   شد و شمارهٔ دفتر مرکزی کرمان ۰۹۱۹ ۰۳۶ ۰۹۹۹ است.

   ردیف `site` را یک ویراستار از پنل ذخیره کرده بود و بر پیش‌فرض کد غلبه
   می‌کند، پس تغییر `siteContent.ts` به سرصفحه، فرم‌ها و نوار موبایل
   نمی‌رسید. فقط وقتی عوض می‌شود که هنوز همان شمارهٔ قدیمی باشد — اگر کسی
   در پنل شمارهٔ دیگری گذاشته، دست‌نخورده می‌ماند. ردیف `business` (دادهٔ
   ساختاریافتهٔ گوگل) هم اگر ذخیره شده باشد، با همین قاعده. */
UPDATE `settings`
SET `value` = json_set(`value`, '$.phone', '۰۹۱۹ ۰۳۶ ۰۹۹۹', '$.phoneHref', 'tel:09190360999')
WHERE `key` = 'site'
  AND json_extract(`value`, '$.phoneHref') = 'tel:03432521416';
--> statement-breakpoint
UPDATE `settings`
SET `value` = json_set(`value`, '$.telephone', '+989190360999')
WHERE `key` = 'business'
  AND json_extract(`value`, '$.telephone') = '+983432521416';

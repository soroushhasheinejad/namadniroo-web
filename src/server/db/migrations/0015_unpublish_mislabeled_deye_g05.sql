-- محصول قدیمی «اینورتر هایبرید SUN‑G05» از انتشار خارج می‌شود.
-- دیتاشیت رسمی Deye سری G05 را «Three Phase String Inverter» بدون ورودی باتری معرفی می‌کند
-- (Datasheets-SUN-(3-12)K-G05-AU، deyeinverter.com)، و مدل‌های هیبرید Deye کد SG دارند.
-- این کالا در فهرست موجودی ۱۳ آبان ۱۴۰۵ هم نیست. مقالهٔ «اینورتر هیبرید دای» (۴ آذر ۱۴۰۵)
-- همین را می‌گوید و صفحهٔ محصول نباید خلافش را بگوید.
-- اگر بازرگانی مدل واقعی را مشخص کرد، از پنل با نام درست دوباره منتشر شود و ریدایرکت پاک شود.
UPDATE `products` SET `published` = 0 WHERE `slug` = 'deye-sun-g05';--> statement-breakpoint
INSERT INTO `redirects` (`from_path`, `to_path`, `status_code`, `auto`)
  VALUES ('/shop/deye-sun-g05', '/shop/inverter/deye', 301, 0)
  ON CONFLICT(`from_path`) DO NOTHING;

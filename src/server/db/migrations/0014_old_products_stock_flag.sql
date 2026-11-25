-- وضعیت موجودی ۱۶ محصول قدیمی فروشگاه، از فهرست موجودی ۱۳ آبان ۱۴۰۵.
-- صفحهٔ محصول حالا «موجود در انبار» یا «استعلام موجودی» نشان می‌دهد و این ستون تا امروز برای این ۱۶ ردیف خالی بود.
-- فقط ردیف‌هایی که هنوز خالی‌اند پر می‌شوند؛ چیزی که در پنل تیک خورده دست نمی‌خورد.
-- پنج خانوادهٔ موجود: Primo، Symo، Tauro، Deye 70–110K (SUN-100K-G03) و AI-W5.1.
-- بقیه در فهرست ۱۳ آبان نیستند. صفحه‌شان می‌ماند تا رتبه‌اش از دست نرود، ولی «استعلام موجودی» می‌گیرد.
UPDATE `products` SET `in_stock` = 1
  WHERE `in_stock` IS NULL AND `slug` IN ('fronius-primo', 'fronius-symo', 'fronius-tauro', 'deye-sun-70-110k', 'deye-ai-w51');--> statement-breakpoint
UPDATE `products` SET `in_stock` = 0
  WHERE `in_stock` IS NULL AND `slug` IN ('deye-sun-g05', 'deye-rw-f', 'ae-md-panel', 'sungrow-rs', 'deye-logger', 'sungrow-sg110cx', 'sunways-stt', 'goodwe-ht', 'sineng-sp350k', 'ae-cme-bifacial', 'trina-vertex');

-- ابعاد دسته‌بندی برای ۱۶ محصول موجود، از مشخصات خود هر محصول.
-- فقط ستون‌های تازه پر می‌شوند؛ چیزی که ویراستار قبلاً عوض کرده دست نمی‌خورد.
-- «نمایندگی رسمی» فقط برای AE Solar است، چون فقط همان را با اطمینان می‌دانیم.
-- زیرنوع پنل ترینا خالی می‌ماند: معلوم نیست مدل موجود دوطرفه است یا نه.
UPDATE `products` SET `subkind` = 'monitoring' WHERE `slug` = 'deye-logger';--> statement-breakpoint
UPDATE `products` SET `subkind` = 'hybrid', `phase` = 'single', `power_min` = 3.6, `power_max` = 6 WHERE `slug` = 'deye-sun-g05';--> statement-breakpoint
UPDATE `products` SET `subkind` = 'string', `phase` = 'three', `power_min` = 70, `power_max` = 110 WHERE `slug` = 'deye-sun-70-110k';--> statement-breakpoint
UPDATE `products` SET `subkind` = 'string', `phase` = 'single', `power_min` = 3, `power_max` = 8.2 WHERE `slug` = 'fronius-primo';--> statement-breakpoint
UPDATE `products` SET `subkind` = 'string', `phase` = 'three', `power_min` = 3, `power_max` = 20 WHERE `slug` = 'fronius-symo';--> statement-breakpoint
UPDATE `products` SET `subkind` = 'string', `phase` = 'three', `power_min` = 50, `power_max` = 100 WHERE `slug` = 'fronius-tauro';--> statement-breakpoint
UPDATE `products` SET `subkind` = 'string', `phase` = 'three', `power_min` = 73, `power_max` = 136 WHERE `slug` = 'goodwe-ht';--> statement-breakpoint
UPDATE `products` SET `subkind` = 'string', `phase` = 'three', `power_min` = 350, `power_max` = 350 WHERE `slug` = 'sineng-sp350k';--> statement-breakpoint
UPDATE `products` SET `subkind` = 'string', `phase` = 'single', `power_min` = 3, `power_max` = 10 WHERE `slug` = 'sungrow-rs';--> statement-breakpoint
UPDATE `products` SET `subkind` = 'string', `phase` = 'three', `power_min` = 110, `power_max` = 110 WHERE `slug` = 'sungrow-sg110cx';--> statement-breakpoint
UPDATE `products` SET `subkind` = 'string', `phase` = 'three', `power_min` = 30, `power_max` = 125 WHERE `slug` = 'sunways-stt';--> statement-breakpoint
UPDATE `products` SET `subkind` = 'monofacial', `power_min` = 530, `power_max` = 550, `official` = 1 WHERE `slug` = 'ae-md-panel';--> statement-breakpoint
UPDATE `products` SET `subkind` = 'bifacial', `power_min` = 710, `power_max` = 730, `official` = 1 WHERE `slug` = 'ae-cme-bifacial';--> statement-breakpoint
UPDATE `products` SET `power_max` = 700 WHERE `slug` = 'trina-vertex';--> statement-breakpoint
UPDATE `products` SET `subkind` = 'all-in-one', `power_min` = 5, `power_max` = 12 WHERE `slug` = 'deye-ai-w51';--> statement-breakpoint
UPDATE `products` SET `subkind` = 'battery', `power_max` = 10.2 WHERE `slug` = 'deye-rw-f';

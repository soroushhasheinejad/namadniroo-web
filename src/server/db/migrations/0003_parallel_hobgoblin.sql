CREATE TABLE `not_found` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`path` text NOT NULL,
	`hits` integer DEFAULT 1 NOT NULL,
	`referrer` text,
	`first_seen` integer DEFAULT (unixepoch()) NOT NULL,
	`last_seen` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `not_found_path_idx` ON `not_found` (`path`);--> statement-breakpoint
CREATE INDEX `not_found_hits_idx` ON `not_found` (`hits`);--> statement-breakpoint
/* مقالهٔ «اقتصاد طراحی» به solar-plant-profit تغییر نام داد و نشانی قبلی
   روی سایت منتشر و احتمالاً ایندکس شده بود. بدون این ریدایرکت، هر پیوند
   به نشانی قدیم پس از انتشار به ۴۰۴ می‌رسید. */
INSERT OR IGNORE INTO `redirects` (`from_path`, `to_path`, `status_code`, `auto`, `hits`)
VALUES ('/magazine/eghtesadi-tasmim', '/magazine/solar-plant-profit', 301, 1, 0);

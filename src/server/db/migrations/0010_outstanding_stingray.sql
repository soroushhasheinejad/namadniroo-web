ALTER TABLE `products` ADD `subkind` text;--> statement-breakpoint
ALTER TABLE `products` ADD `phase` text;--> statement-breakpoint
ALTER TABLE `products` ADD `power_min` real;--> statement-breakpoint
ALTER TABLE `products` ADD `power_max` real;--> statement-breakpoint
ALTER TABLE `products` ADD `official` integer DEFAULT false NOT NULL;
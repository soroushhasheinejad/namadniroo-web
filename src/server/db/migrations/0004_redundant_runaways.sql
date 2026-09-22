CREATE TABLE `daily_stats` (
	`day` text NOT NULL,
	`metric` text NOT NULL,
	`key` text DEFAULT '_' NOT NULL,
	`value` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `daily_stats_idx` ON `daily_stats` (`day`,`metric`,`key`);--> statement-breakpoint
CREATE INDEX `daily_stats_day_idx` ON `daily_stats` (`day`);--> statement-breakpoint
CREATE TABLE `events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`visitor_id` text NOT NULL,
	`session_id` text NOT NULL,
	`type` text NOT NULL,
	`path` text,
	`referrer` text,
	`channel` text,
	`utm_source` text,
	`utm_medium` text,
	`utm_campaign` text,
	`device` text,
	`props` text
);
--> statement-breakpoint
CREATE INDEX `events_created_idx` ON `events` (`created_at`);--> statement-breakpoint
CREATE INDEX `events_visitor_idx` ON `events` (`visitor_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `events_type_idx` ON `events` (`type`,`created_at`);--> statement-breakpoint
CREATE TABLE `lead_activity` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`lead_id` integer NOT NULL,
	`user_id` integer,
	`kind` text DEFAULT 'note' NOT NULL,
	`body` text,
	`status_from` text,
	`status_to` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`lead_id`) REFERENCES `leads`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `lead_activity_lead_idx` ON `lead_activity` (`lead_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `visitors` (
	`id` text PRIMARY KEY NOT NULL,
	`first_seen` integer DEFAULT (unixepoch()) NOT NULL,
	`last_seen` integer DEFAULT (unixepoch()) NOT NULL,
	`first_channel` text,
	`first_utm_source` text,
	`first_utm_medium` text,
	`first_utm_campaign` text,
	`first_referrer` text,
	`first_landing` text,
	`last_channel` text,
	`pageviews` integer DEFAULT 0 NOT NULL,
	`sessions` integer DEFAULT 0 NOT NULL,
	`device` text,
	`lead_id` integer
);
--> statement-breakpoint
CREATE INDEX `visitors_last_seen_idx` ON `visitors` (`last_seen`);--> statement-breakpoint
CREATE INDEX `visitors_lead_idx` ON `visitors` (`lead_id`);--> statement-breakpoint
ALTER TABLE `leads` ADD `visitor_id` text;--> statement-breakpoint
ALTER TABLE `leads` ADD `channel` text;--> statement-breakpoint
ALTER TABLE `leads` ADD `first_channel` text;--> statement-breakpoint
ALTER TABLE `leads` ADD `first_utm_source` text;--> statement-breakpoint
ALTER TABLE `leads` ADD `first_utm_medium` text;--> statement-breakpoint
ALTER TABLE `leads` ADD `first_utm_campaign` text;--> statement-breakpoint
ALTER TABLE `leads` ADD `first_referrer` text;--> statement-breakpoint
ALTER TABLE `leads` ADD `landing_page` text;--> statement-breakpoint
ALTER TABLE `leads` ADD `first_contact_at` integer;--> statement-breakpoint
ALTER TABLE `leads` ADD `next_follow_up_at` integer;--> statement-breakpoint
ALTER TABLE `leads` ADD `closed_at` integer;--> statement-breakpoint
ALTER TABLE `leads` ADD `deal_value` integer;--> statement-breakpoint
ALTER TABLE `leads` ADD `capacity_kw` integer;--> statement-breakpoint
ALTER TABLE `leads` ADD `lost_reason` text;--> statement-breakpoint
CREATE INDEX `leads_visitor_idx` ON `leads` (`visitor_id`);--> statement-breakpoint
CREATE INDEX `leads_followup_idx` ON `leads` (`next_follow_up_at`);
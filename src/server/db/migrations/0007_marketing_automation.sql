CREATE TABLE `campaigns` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`audience_rule` text,
	`channel` text DEFAULT 'sms' NOT NULL,
	`body` text NOT NULL,
	`variants` text,
	`control_percent` integer DEFAULT 0 NOT NULL,
	`scheduled_at` integer,
	`status` text DEFAULT 'draft' NOT NULL,
	`goal_event` text,
	`goal_days` integer DEFAULT 7 NOT NULL,
	`created_by` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`sent_at` integer,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `campaigns_status_idx` ON `campaigns` (`status`,`scheduled_at`);--> statement-breakpoint
CREATE TABLE `contacts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`phone_normalized` text NOT NULL,
	`phone` text NOT NULL,
	`name` text,
	`origin` text DEFAULT 'lead' NOT NULL,
	`lead_id` integer,
	`visitor_id` text,
	`city` text,
	`marketing_consent` integer DEFAULT false NOT NULL,
	`opted_out_at` integer,
	`tags` text,
	`extra` text,
	`last_messaged_at` integer,
	`messages_7d` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`lead_id`) REFERENCES `leads`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `contacts_phone_normalized_unique` ON `contacts` (`phone_normalized`);--> statement-breakpoint
CREATE INDEX `contacts_lead_idx` ON `contacts` (`lead_id`);--> statement-breakpoint
CREATE INDEX `contacts_consent_idx` ON `contacts` (`marketing_consent`);--> statement-breakpoint
CREATE INDEX `contacts_last_msg_idx` ON `contacts` (`last_messaged_at`);--> statement-breakpoint
CREATE TABLE `flow_runs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`flow_id` integer NOT NULL,
	`contact_id` integer NOT NULL,
	`step_index` integer DEFAULT 0 NOT NULL,
	`next_run_at` integer,
	`status` text DEFAULT 'running' NOT NULL,
	`is_control` integer DEFAULT false NOT NULL,
	`converted` integer DEFAULT false NOT NULL,
	`started_at` integer DEFAULT (unixepoch()) NOT NULL,
	`ended_at` integer,
	FOREIGN KEY (`flow_id`) REFERENCES `flows`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`contact_id`) REFERENCES `contacts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `flow_runs_due_idx` ON `flow_runs` (`status`,`next_run_at`);--> statement-breakpoint
CREATE INDEX `flow_runs_contact_idx` ON `flow_runs` (`contact_id`);--> statement-breakpoint
CREATE TABLE `flows` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`code` text NOT NULL,
	`name` text NOT NULL,
	`trigger` text NOT NULL,
	`entry_rule` text,
	`steps` text NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`control_percent` integer DEFAULT 10 NOT NULL,
	`channel` text DEFAULT 'sms' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `flows_code_unique` ON `flows` (`code`);--> statement-breakpoint
CREATE INDEX `flows_status_idx` ON `flows` (`status`);--> statement-breakpoint
CREATE TABLE `messages` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`contact_id` integer NOT NULL,
	`flow_id` integer,
	`campaign_id` integer,
	`channel` text DEFAULT 'sms' NOT NULL,
	`body` text NOT NULL,
	`variant` text,
	`status` text DEFAULT 'queued' NOT NULL,
	`reason` text,
	`provider_id` text,
	`attempts` integer DEFAULT 0 NOT NULL,
	`sent_at` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`contact_id`) REFERENCES `contacts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`flow_id`) REFERENCES `flows`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`campaign_id`) REFERENCES `campaigns`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `messages_contact_idx` ON `messages` (`contact_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `messages_status_idx` ON `messages` (`status`,`created_at`);--> statement-breakpoint
CREATE INDEX `messages_campaign_idx` ON `messages` (`campaign_id`);--> statement-breakpoint
CREATE INDEX `messages_flow_idx` ON `messages` (`flow_id`);
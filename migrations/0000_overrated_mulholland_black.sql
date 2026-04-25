CREATE TABLE `dns_records` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`domain_id` text NOT NULL,
	`type` text NOT NULL,
	`name` text NOT NULL,
	`content` text NOT NULL,
	`ttl` integer DEFAULT 1 NOT NULL,
	`priority` integer,
	`proxied` integer DEFAULT false NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`cf_record_id` text,
	`last_error` text,
	`created_at` integer DEFAULT '"2026-04-25T07:24:47.122Z"' NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`domain_id`) REFERENCES `domains`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `domain_batches` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`template_id` text,
	`name` text NOT NULL,
	`created_at` integer DEFAULT '"2026-04-25T07:24:47.122Z"' NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`template_id`) REFERENCES `job_templates`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `domain_plans` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`domain_id` text NOT NULL,
	`total_inboxes` integer NOT NULL,
	`subdomain_count` integer NOT NULL,
	`status` text DEFAULT 'planned' NOT NULL,
	`prefixes_snapshot` text,
	`names_snapshot` text,
	`created_at` integer DEFAULT '"2026-04-25T07:24:47.123Z"' NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`domain_id`) REFERENCES `domains`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `domains` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`batch_id` text,
	`server_id` text,
	`name` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`cf_zone_id` text,
	`cf_account_id` text,
	`mailcow_hostname` text,
	`mailcow_api_key` text,
	`planned_inbox_count` integer,
	`created_at` integer DEFAULT '"2026-04-25T07:24:47.122Z"' NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`batch_id`) REFERENCES `domain_batches`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`server_id`) REFERENCES `servers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `job_templates` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`subdomain_prefixes` text,
	`person_names` text,
	`created_at` integer DEFAULT '"2026-04-25T07:24:47.122Z"' NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `planned_inboxes` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`domain_id` text NOT NULL,
	`plan_id` text NOT NULL,
	`subdomain_prefix` text NOT NULL,
	`subdomain_fqdn` text NOT NULL,
	`local_part` text NOT NULL,
	`email` text NOT NULL,
	`person_name` text,
	`format` text,
	`status` text DEFAULT 'planned' NOT NULL,
	`created_at` integer DEFAULT '"2026-04-25T07:24:47.123Z"' NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`domain_id`) REFERENCES `domains`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`plan_id`) REFERENCES `domain_plans`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `servers` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`label` text NOT NULL,
	`hostname` text NOT NULL,
	`ip_address` text NOT NULL,
	`ssh_user` text DEFAULT 'root' NOT NULL,
	`status` text DEFAULT 'configuring' NOT NULL,
	`setup_steps` text,
	`created_at` integer DEFAULT '"2026-04-25T07:24:47.122Z"' NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `user_secrets` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`cf_api_token` text,
	`cf_account_id` text,
	`created_at` integer DEFAULT '"2026-04-25T07:24:47.121Z"' NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`created_at` integer DEFAULT '"2026-04-25T07:24:47.120Z"' NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);
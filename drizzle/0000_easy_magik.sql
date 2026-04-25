CREATE TABLE `dns_records` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`domain_id` text NOT NULL,
	`type` text NOT NULL,
	`name` text NOT NULL,
	`content` text,
	`ttl` integer DEFAULT 1,
	`priority` integer,
	`proxied` integer DEFAULT false,
	`status` text DEFAULT 'pending',
	`cf_record_id` text,
	`last_error` text,
	`created_at` integer DEFAULT CURRENT_TIMESTAMP,
	FOREIGN KEY (`domain_id`) REFERENCES `domains`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `domain_batches` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text,
	`template_id` text,
	`created_at` integer DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE TABLE `domain_plans` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`domain_id` text NOT NULL,
	`total_inboxes` integer,
	`subdomain_count` integer,
	`status` text DEFAULT 'pending',
	`prefixes_snapshot` text,
	`names_snapshot` text,
	`created_at` integer DEFAULT CURRENT_TIMESTAMP,
	FOREIGN KEY (`domain_id`) REFERENCES `domains`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `domains` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`server_id` text,
	`status` text DEFAULT 'pending',
	`cf_zone_id` text,
	`cf_account_id` text,
	`mailcow_hostname` text,
	`mailcow_api_key` text,
	`planned_inbox_count` integer,
	`batch_id` text,
	`created_at` integer DEFAULT CURRENT_TIMESTAMP,
	FOREIGN KEY (`server_id`) REFERENCES `servers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `domains_name_unique` ON `domains` (`name`);--> statement-breakpoint
CREATE TABLE `job_templates` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`subdomain_prefixes` text,
	`person_names` text,
	`created_at` integer DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE TABLE `planned_inboxes` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`domain_id` text NOT NULL,
	`plan_id` text,
	`subdomain_prefix` text,
	`subdomain_fqdn` text,
	`local_part` text,
	`email` text,
	`person_name` text,
	`format` text,
	`status` text DEFAULT 'pending',
	`created_at` integer DEFAULT CURRENT_TIMESTAMP,
	FOREIGN KEY (`domain_id`) REFERENCES `domains`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`plan_id`) REFERENCES `domain_plans`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `rate_limits` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`provider` text NOT NULL,
	`count` integer DEFAULT 0,
	`window_start` integer DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_user_provider` ON `rate_limits` (`user_id`,`provider`);--> statement-breakpoint
CREATE TABLE `servers` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`label` text,
	`hostname` text,
	`ip_address` text,
	`ssh_user` text,
	`ssh_key` text,
	`status` text DEFAULT 'pending',
	`setup_steps` text,
	`created_at` integer DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE TABLE `user_secrets` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`cf_api_token` text,
	`cf_account_id` text,
	`subdomain_prefixes` text,
	`person_names` text,
	`created_at` integer DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_secrets_user_id_unique` ON `user_secrets` (`user_id`);
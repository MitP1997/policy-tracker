CREATE TABLE `agencies` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`owner_user_id` text,
	`phone` text,
	`email` text,
	`timezone` text DEFAULT 'Asia/Kolkata' NOT NULL,
	`plan` text DEFAULT 'free' NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_agencies_status` ON `agencies` (`status`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`agency_id` text NOT NULL,
	`name` text NOT NULL,
	`phone` text NOT NULL,
	`role` text DEFAULT 'owner' NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`last_login_at` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`agency_id`) REFERENCES `agencies`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_users_agency` ON `users` (`agency_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `uq_users_agency_phone` ON `users` (`agency_id`,`phone`);--> statement-breakpoint
CREATE TABLE `households` (
	`id` text PRIMARY KEY NOT NULL,
	`agency_id` text NOT NULL,
	`name` text NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`agency_id`) REFERENCES `agencies`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_households_agency` ON `households` (`agency_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `uq_households_agency_name` ON `households` (`agency_id`,`name`);--> statement-breakpoint
CREATE TABLE `clients` (
	`id` text PRIMARY KEY NOT NULL,
	`agency_id` text NOT NULL,
	`full_name` text NOT NULL,
	`phone` text,
	`email` text,
	`address` text,
	`notes` text,
	`household_id` text,
	`created_by` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`agency_id`) REFERENCES `agencies`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`household_id`) REFERENCES `households`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `idx_clients_agency` ON `clients` (`agency_id`);--> statement-breakpoint
CREATE INDEX `idx_clients_household` ON `clients` (`agency_id`,`household_id`);--> statement-breakpoint
CREATE TABLE `policies` (
	`id` text PRIMARY KEY NOT NULL,
	`agency_id` text NOT NULL,
	`client_id` text NOT NULL,
	`insurance_type` text NOT NULL,
	`insurer_name` text NOT NULL,
	`policy_number` text,
	`start_date` text,
	`end_date` text NOT NULL,
	`premium_paise` integer,
	`status` text DEFAULT 'active' NOT NULL,
	`assigned_to` text,
	`notes` text,
	`status_updated_at` text,
	`status_updated_by` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`agency_id`) REFERENCES `agencies`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`assigned_to`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`status_updated_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `idx_policies_expiry` ON `policies` (`agency_id`,`end_date`,`status`);--> statement-breakpoint
CREATE INDEX `idx_policies_client` ON `policies` (`agency_id`,`client_id`);--> statement-breakpoint
CREATE INDEX `idx_policies_assignee` ON `policies` (`agency_id`,`assigned_to`,`end_date`);--> statement-breakpoint
CREATE UNIQUE INDEX `uq_policies_agency_policy_number` ON `policies` (`agency_id`,`policy_number`) WHERE "policies"."policy_number" is not null;--> statement-breakpoint
CREATE TABLE `documents` (
	`id` text PRIMARY KEY NOT NULL,
	`agency_id` text NOT NULL,
	`client_id` text,
	`policy_id` text,
	`doc_type` text NOT NULL,
	`file_name` text NOT NULL,
	`mime_type` text,
	`file_size` integer,
	`storage_key` text NOT NULL,
	`uploaded_by` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`agency_id`) REFERENCES `agencies`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`policy_id`) REFERENCES `policies`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`uploaded_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `idx_documents_lookup` ON `documents` (`agency_id`,`policy_id`,`client_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `reminder_rules` (
	`id` text PRIMARY KEY NOT NULL,
	`agency_id` text NOT NULL,
	`days_before` integer NOT NULL,
	`enabled` integer DEFAULT 1 NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`agency_id`) REFERENCES `agencies`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_reminder_rules_agency_days_before` ON `reminder_rules` (`agency_id`,`days_before`);--> statement-breakpoint
CREATE TABLE `reminders` (
	`id` text PRIMARY KEY NOT NULL,
	`agency_id` text NOT NULL,
	`policy_id` text NOT NULL,
	`client_id` text NOT NULL,
	`due_on` text NOT NULL,
	`assigned_to` text NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`rule_days_before` integer NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`agency_id`) REFERENCES `agencies`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`policy_id`) REFERENCES `policies`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`assigned_to`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_reminders_daily_view` ON `reminders` (`agency_id`,`assigned_to`,`status`,`due_on`);--> statement-breakpoint
CREATE UNIQUE INDEX `uq_reminders_idempotency` ON `reminders` (`agency_id`,`policy_id`,`assigned_to`,`due_on`,`rule_days_before`);--> statement-breakpoint
CREATE TABLE `imports` (
	`id` text PRIMARY KEY NOT NULL,
	`agency_id` text NOT NULL,
	`created_by` text,
	`source` text NOT NULL,
	`file_name` text NOT NULL,
	`storage_key` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`total_rows` integer,
	`success_rows` integer,
	`failed_rows` integer,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`completed_at` text,
	FOREIGN KEY (`agency_id`) REFERENCES `agencies`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `idx_imports_agency` ON `imports` (`agency_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `import_rows` (
	`id` text PRIMARY KEY NOT NULL,
	`agency_id` text NOT NULL,
	`import_id` text NOT NULL,
	`row_number` integer NOT NULL,
	`raw_json_text` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`error_message` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`agency_id`) REFERENCES `agencies`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`import_id`) REFERENCES `imports`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_import_rows_row` ON `import_rows` (`agency_id`,`import_id`,`row_number`);--> statement-breakpoint
CREATE INDEX `idx_import_rows_status` ON `import_rows` (`agency_id`,`import_id`,`status`);--> statement-breakpoint
CREATE TABLE `audit_log` (
	`id` text PRIMARY KEY NOT NULL,
	`agency_id` text NOT NULL,
	`actor_user_id` text,
	`entity_type` text NOT NULL,
	`entity_id` text NOT NULL,
	`action` text NOT NULL,
	`metadata_json` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`agency_id`) REFERENCES `agencies`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`actor_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `idx_audit_agency_time` ON `audit_log` (`agency_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `otp_codes` (
	`phone` text NOT NULL,
	`code` text NOT NULL,
	`expires_at` text NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_otp_codes_phone` ON `otp_codes` (`phone`);--> statement-breakpoint
CREATE INDEX `idx_otp_codes_expires_at` ON `otp_codes` (`expires_at`);
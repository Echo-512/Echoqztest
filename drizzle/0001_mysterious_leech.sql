CREATE TABLE `exam_drafts` (
	`user_email` text PRIMARY KEY NOT NULL,
	`payload_json` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `practice_states` (
	`user_email` text PRIMARY KEY NOT NULL,
	`payload_json` text NOT NULL,
	`updated_at` text NOT NULL
);

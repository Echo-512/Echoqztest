CREATE TABLE `exam_attempts` (
	`id` text PRIMARY KEY NOT NULL,
	`user_email` text NOT NULL,
	`started_at` text NOT NULL,
	`completed_at` text NOT NULL,
	`total_correct` integer NOT NULL,
	`total_questions` integer NOT NULL,
	`duration_seconds` integer NOT NULL,
	`question_ids_json` text NOT NULL,
	`payload_json` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `exam_attempts_user_completed_idx` ON `exam_attempts` (`user_email`,`completed_at`);
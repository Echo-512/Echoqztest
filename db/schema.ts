import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const examAttempts = sqliteTable(
  "exam_attempts",
  {
    id: text("id").primaryKey(),
    userEmail: text("user_email").notNull(),
    startedAt: text("started_at").notNull(),
    completedAt: text("completed_at").notNull(),
    totalCorrect: integer("total_correct").notNull(),
    totalQuestions: integer("total_questions").notNull(),
    durationSeconds: integer("duration_seconds").notNull(),
    questionIdsJson: text("question_ids_json").notNull(),
    payloadJson: text("payload_json").notNull(),
  },
  (table) => [
    index("exam_attempts_user_completed_idx").on(
      table.userEmail,
      table.completedAt,
    ),
  ],
);

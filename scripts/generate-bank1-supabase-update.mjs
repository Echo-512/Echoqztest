import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const questionsPath = fileURLToPath(new URL("../app/questions.json", import.meta.url));
const outputPath = fileURLToPath(
  new URL("../supabase/update_graphic_bank1_from_word.sql", import.meta.url),
);

const questions = JSON.parse(await readFile(questionsPath, "utf8")).filter(
  (question) => question.source === "题库1",
);

const quote = (value) => `'${String(value ?? "").replaceAll("'", "''")}'`;
const json = (value) => `${quote(JSON.stringify(value))}::jsonb`;
const nullableText = (value) => (value ? quote(value) : "null");

const values = questions
  .map((question) => {
    const optionImages = Object.fromEntries(
      question.optionImages.map((path, index) => [String.fromCharCode(65 + index), path]),
    );
    return `  (${[
      quote(question.sourceId),
      quote(question.displayId),
      nullableText(question.prompt),
      nullableText(question.image),
      json(question.stemImages),
      json(optionImages),
      Number(question.optionCount),
      quote(question.answer),
      Number(question.originalNumber),
    ].join(", ")})`;
  })
  .join(",\n");

const sql = `-- Generated from 图形推理题库1.docx on 2026-08-02.
-- Stable ids are intentionally preserved so user_progress, favorites and exam history remain linked.
begin;

with incoming(
  id,
  question_number,
  question_text,
  image,
  stem_images,
  option_images,
  option_count,
  correct_answer,
  original_number
) as (
values
${values}
)
update public.questions as question
set
  question_number = incoming.question_number,
  question_text = incoming.question_text,
  image = incoming.image,
  option_images = incoming.option_images,
  option_count = incoming.option_count,
  correct_answer = incoming.correct_answer,
  original_number = incoming.original_number,
  metadata = coalesce(question.metadata, '{}'::jsonb) || jsonb_build_object(
    'stem_images', incoming.stem_images,
    'word_revision', '2026-08-02'
  )
from incoming
where question.id = incoming.id
  and question.source = '题库1';

do $$
declare
  updated_count integer;
begin
  select count(*)
  into updated_count
  from public.questions
  where source = '题库1'
    and metadata ->> 'word_revision' = '2026-08-02';

  if updated_count <> 52 then
    raise exception 'Expected 52 updated bank-1 questions, found %', updated_count;
  end if;
end $$;

commit;
`;

await writeFile(outputPath, sql, "utf8");
console.log(`Supabase update SQL generated for ${questions.length} questions.`);

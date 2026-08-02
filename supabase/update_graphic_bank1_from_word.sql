-- Generated from 图形推理题库1.docx on 2026-08-02.
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
  ('1-1', '1-1', '问号处的图形应该是：', '/questions/beisen-1-clean/1-1/prompt-1.png', '["/questions/beisen-1-clean/1-1/prompt-1.png"]'::jsonb, '{"A":"/questions/beisen-1-clean/1-1/option-a-1.png","B":"/questions/beisen-1-clean/1-1/option-b-1.png","C":"/questions/beisen-1-clean/1-1/option-c-1.png","D":"/questions/beisen-1-clean/1-1/option-d-1.png"}'::jsonb, 4, 'D', 1),
  ('1-3', '1-3', '下列哪一个图形是特殊的？', null, '[]'::jsonb, '{"A":"/questions/beisen-1-clean/1-3/option-a-1.jpeg","B":"/questions/beisen-1-clean/1-3/option-b-1.png","C":"/questions/beisen-1-clean/1-3/option-c-1.png","D":"/questions/beisen-1-clean/1-3/option-d-1.png"}'::jsonb, 4, 'A', 3),
  ('1-13', '1-5', '从所给的四个选项中，选择最适合的一个填入问号中，使之呈现一定的规律性', '/questions/beisen-1-clean/1-5/prompt-1.jpeg', '["/questions/beisen-1-clean/1-5/prompt-1.jpeg"]'::jsonb, '{"A":"/questions/beisen-1-clean/1-5/option-a-1.png","B":"/questions/beisen-1-clean/1-5/option-b-1.png","C":"/questions/beisen-1-clean/1-5/option-c-1.png","D":"/questions/beisen-1-clean/1-5/option-d-1.png"}'::jsonb, 4, 'A', 5),
  ('1-14', '1-6', null, '/questions/beisen-1-clean/1-6/prompt-1.png', '["/questions/beisen-1-clean/1-6/prompt-1.png"]'::jsonb, '{"A":"/questions/beisen-1-clean/1-6/option-a-1.png","B":"/questions/beisen-1-clean/1-6/option-b-1.png","C":"/questions/beisen-1-clean/1-6/option-c-1.png","D":"/questions/beisen-1-clean/1-6/option-d-1.png","E":"/questions/beisen-1-clean/1-6/option-e-1.png"}'::jsonb, 5, 'D', 6),
  ('1-18', '1-10', '如果，那么 ，问号处应当是：', '/questions/beisen-1-clean/1-10/prompt-1.png', '["/questions/beisen-1-clean/1-10/prompt-1.png","/questions/beisen-1-clean/1-10/prompt-2.png"]'::jsonb, '{"A":"/questions/beisen-1-clean/1-10/option-a-1.png","B":"/questions/beisen-1-clean/1-10/option-b-1.png","C":"/questions/beisen-1-clean/1-10/option-c-1.png","D":"/questions/beisen-1-clean/1-10/option-d-1.png"}'::jsonb, 4, 'D', 10),
  ('1-19', '1-19', '从给出的四个选项中，选择最合适的一个填入问号处，使之呈现一定的规律性', '/questions/beisen-1-clean/1-19/prompt-1.png', '["/questions/beisen-1-clean/1-19/prompt-1.png"]'::jsonb, '{"A":"/questions/beisen-1-clean/1-19/option-a-1.png","B":"/questions/beisen-1-clean/1-19/option-b-1.png","C":"/questions/beisen-1-clean/1-19/option-c-1.png","D":"/questions/beisen-1-clean/1-19/option-d-1.png"}'::jsonb, 4, 'B', 19),
  ('1-20', '1-20', '找出下列图形中不同于其他图形的一项：', null, '[]'::jsonb, '{"A":"/questions/beisen-1-clean/1-20/option-a-1.png","B":"/questions/beisen-1-clean/1-20/option-b-1.png","C":"/questions/beisen-1-clean/1-20/option-c-1.png","D":"/questions/beisen-1-clean/1-20/option-d-1.png"}'::jsonb, 4, 'C', 20),
  ('1-24', '1-24', '根据以下图形的规律，下一个图形应该是：', '/questions/beisen-1-clean/1-24/prompt-1.png', '["/questions/beisen-1-clean/1-24/prompt-1.png"]'::jsonb, '{"A":"/questions/beisen-1-clean/1-24/option-a-1.png","B":"/questions/beisen-1-clean/1-24/option-b-1.png","C":"/questions/beisen-1-clean/1-24/option-c-1.png","D":"/questions/beisen-1-clean/1-24/option-d-1.png"}'::jsonb, 4, 'C', 24),
  ('1-25', '1-25', '从给出的四个选项中，选最合适的一个填入问号处，使之呈现一定的规律性', '/questions/beisen-1-clean/1-25/prompt-1.jpeg', '["/questions/beisen-1-clean/1-25/prompt-1.jpeg"]'::jsonb, '{"A":"/questions/beisen-1-clean/1-25/option-a-1.png","B":"/questions/beisen-1-clean/1-25/option-b-1.png","C":"/questions/beisen-1-clean/1-25/option-c-1.png","D":"/questions/beisen-1-clean/1-25/option-d-1.png"}'::jsonb, 4, 'B', 25),
  ('1-26', '1-26', '找出下列图形中不同于其他图形的一项：', null, '[]'::jsonb, '{"A":"/questions/beisen-1-clean/1-26/option-a-1.jpeg","B":"/questions/beisen-1-clean/1-26/option-b-1.png","C":"/questions/beisen-1-clean/1-26/option-c-1.png","D":"/questions/beisen-1-clean/1-26/option-d-1.png"}'::jsonb, 4, 'C', 26),
  ('1-27', '1-27', '从给出的四个选项中，选择最合适的一个填入问号处，使之呈现一定的规律性', '/questions/beisen-1-clean/1-27/prompt-1.png', '["/questions/beisen-1-clean/1-27/prompt-1.png"]'::jsonb, '{"A":"/questions/beisen-1-clean/1-27/option-a-1.png","B":"/questions/beisen-1-clean/1-27/option-b-1.png","C":"/questions/beisen-1-clean/1-27/option-c-1.png","D":"/questions/beisen-1-clean/1-27/option-d-1.png"}'::jsonb, 4, 'B', 27),
  ('1-30', '1-30', '如果 ，那么，问号处的图形应该是：', '/questions/beisen-1-clean/1-30/prompt-1.png', '["/questions/beisen-1-clean/1-30/prompt-1.png","/questions/beisen-1-clean/1-30/prompt-2.png"]'::jsonb, '{"A":"/questions/beisen-1-clean/1-30/option-a-1.png","B":"/questions/beisen-1-clean/1-30/option-b-1.png","C":"/questions/beisen-1-clean/1-30/option-c-1.png","D":"/questions/beisen-1-clean/1-30/option-d-1.png"}'::jsonb, 4, 'C', 30),
  ('1-32', '1-32', '根据以上图形规律，下一图形应该是：', '/questions/beisen-1-clean/1-32/prompt-1.png', '["/questions/beisen-1-clean/1-32/prompt-1.png"]'::jsonb, '{"A":"/questions/beisen-1-clean/1-32/option-a-1.png","B":"/questions/beisen-1-clean/1-32/option-b-1.png","C":"/questions/beisen-1-clean/1-32/option-c-1.png","D":"/questions/beisen-1-clean/1-32/option-d-1.png"}'::jsonb, 4, 'D', 32),
  ('1-39', '1-39', '找出下列图形中不同于其他图形的一项：', null, '[]'::jsonb, '{"A":"/questions/beisen-1-clean/1-39/option-a-1.png","B":"/questions/beisen-1-clean/1-39/option-b-1.png","C":"/questions/beisen-1-clean/1-39/option-c-1.png","D":"/questions/beisen-1-clean/1-39/option-d-1.png"}'::jsonb, 4, 'D', 39),
  ('1-40', '1-40', '如果，那么，问号处的图形应该是：', '/questions/beisen-1-clean/1-40/prompt-1.png', '["/questions/beisen-1-clean/1-40/prompt-1.png","/questions/beisen-1-clean/1-40/prompt-2.png"]'::jsonb, '{"A":"/questions/beisen-1-clean/1-40/option-a-1.png","B":"/questions/beisen-1-clean/1-40/option-b-1.png","C":"/questions/beisen-1-clean/1-40/option-c-1.png","D":"/questions/beisen-1-clean/1-40/option-d-1.png"}'::jsonb, 4, 'C', 40),
  ('1-41', '1-41', '从所给出的四个选项中，选择一个最合适的填入问号处，使之呈现一定的规律性', '/questions/beisen-1-clean/1-41/prompt-1.png', '["/questions/beisen-1-clean/1-41/prompt-1.png"]'::jsonb, '{"A":"/questions/beisen-1-clean/1-41/option-a-1.png","B":"/questions/beisen-1-clean/1-41/option-b-1.png","C":"/questions/beisen-1-clean/1-41/option-c-1.png","D":"/questions/beisen-1-clean/1-41/option-d-1.png"}'::jsonb, 4, 'A', 41),
  ('1-43', '1-43', '接下来的图形应该是：', '/questions/beisen-1-clean/1-43/prompt-1.png', '["/questions/beisen-1-clean/1-43/prompt-1.png"]'::jsonb, '{"A":"/questions/beisen-1-clean/1-43/option-a-1.png","B":"/questions/beisen-1-clean/1-43/option-b-1.png","C":"/questions/beisen-1-clean/1-43/option-c-1.png","D":"/questions/beisen-1-clean/1-43/option-d-1.png","E":"/questions/beisen-1-clean/1-43/option-e-1.png"}'::jsonb, 5, 'B', 43),
  ('1-44', '1-44', '找出下列图形中不同于其他图形的一项：', null, '[]'::jsonb, '{"A":"/questions/beisen-1-clean/1-44/option-a-1.png","B":"/questions/beisen-1-clean/1-44/option-b-1.png","C":"/questions/beisen-1-clean/1-44/option-c-1.png","D":"/questions/beisen-1-clean/1-44/option-d-1.png"}'::jsonb, 4, 'B', 44),
  ('1-49', '1-49', '接下来的图形应该是：', '/questions/beisen-1-clean/1-49/prompt-1.png', '["/questions/beisen-1-clean/1-49/prompt-1.png"]'::jsonb, '{"A":"/questions/beisen-1-clean/1-49/option-a-1.png","B":"/questions/beisen-1-clean/1-49/option-b-1.png","C":"/questions/beisen-1-clean/1-49/option-c-1.png","D":"/questions/beisen-1-clean/1-49/option-d-1.png","E":"/questions/beisen-1-clean/1-49/option-e-1.png"}'::jsonb, 5, 'B', 49),
  ('1-50', '1-50', '从所给的四个选项中，选择最合适的一个填入问号处，始终呈现一定的规律性', '/questions/beisen-1-clean/1-50/prompt-1.png', '["/questions/beisen-1-clean/1-50/prompt-1.png"]'::jsonb, '{"A":"/questions/beisen-1-clean/1-50/option-a-1.png","B":"/questions/beisen-1-clean/1-50/option-b-1.png","C":"/questions/beisen-1-clean/1-50/option-c-1.png","D":"/questions/beisen-1-clean/1-50/option-d-1.png"}'::jsonb, 4, 'D', 50),
  ('1-51', '1-51', '如果，那么，问号处的图形应该是：', '/questions/beisen-1-clean/1-51/prompt-1.png', '["/questions/beisen-1-clean/1-51/prompt-1.png","/questions/beisen-1-clean/1-51/prompt-2.png"]'::jsonb, '{"A":"/questions/beisen-1-clean/1-51/option-a-1.png","B":"/questions/beisen-1-clean/1-51/option-b-1.png","C":"/questions/beisen-1-clean/1-51/option-c-1.png","D":"/questions/beisen-1-clean/1-51/option-d-1.png"}'::jsonb, 4, 'A', 51),
  ('1-53', '1-53', '根据以上图形的规律。下一个图形应该是：', '/questions/beisen-1-clean/1-53/prompt-1.png', '["/questions/beisen-1-clean/1-53/prompt-1.png"]'::jsonb, '{"A":"/questions/beisen-1-clean/1-53/option-a-1.png","B":"/questions/beisen-1-clean/1-53/option-b-1.png","C":"/questions/beisen-1-clean/1-53/option-c-1.png","D":"/questions/beisen-1-clean/1-53/option-d-1.png"}'::jsonb, 4, 'D', 53),
  ('1-56', '1-56', '如果，那么，问号处的图形应该是：', '/questions/beisen-1-clean/1-56/prompt-1.png', '["/questions/beisen-1-clean/1-56/prompt-1.png","/questions/beisen-1-clean/1-56/prompt-2.png"]'::jsonb, '{"A":"/questions/beisen-1-clean/1-56/option-a-1.png","B":"/questions/beisen-1-clean/1-56/option-b-1.png","C":"/questions/beisen-1-clean/1-56/option-c-1.png","D":"/questions/beisen-1-clean/1-56/option-d-1.png"}'::jsonb, 4, 'A', 56),
  ('1-57', '1-57', '根据以上图形的规律，问号处图形应该是：', '/questions/beisen-1-clean/1-57/prompt-1.png', '["/questions/beisen-1-clean/1-57/prompt-1.png"]'::jsonb, '{"A":"/questions/beisen-1-clean/1-57/option-a-1.png","B":"/questions/beisen-1-clean/1-57/option-b-1.png","C":"/questions/beisen-1-clean/1-57/option-c-1.png","D":"/questions/beisen-1-clean/1-57/option-d-1.png"}'::jsonb, 4, 'A', 57),
  ('1-59', '1-59', '找出不同的一项：', null, '[]'::jsonb, '{"A":"/questions/beisen-1-clean/1-59/option-a-1.png","B":"/questions/beisen-1-clean/1-59/option-b-1.png","C":"/questions/beisen-1-clean/1-59/option-c-1.png","D":"/questions/beisen-1-clean/1-59/option-d-1.png","E":"/questions/beisen-1-clean/1-59/option-e-1.png"}'::jsonb, 5, 'B', 59),
  ('1-60', '1-60', '问号处的图形应该是：', '/questions/beisen-1-clean/1-60/prompt-1.png', '["/questions/beisen-1-clean/1-60/prompt-1.png"]'::jsonb, '{"A":"/questions/beisen-1-clean/1-60/option-a-1.png","B":"/questions/beisen-1-clean/1-60/option-b-1.png","C":"/questions/beisen-1-clean/1-60/option-c-1.png","D":"/questions/beisen-1-clean/1-60/option-d-1.png","E":"/questions/beisen-1-clean/1-60/option-e-1.png"}'::jsonb, 5, 'C', 60),
  ('1-61', '1-61', '找出不同的一项：', null, '[]'::jsonb, '{"A":"/questions/beisen-1-clean/1-61/option-a-1.png","B":"/questions/beisen-1-clean/1-61/option-b-1.png","C":"/questions/beisen-1-clean/1-61/option-c-1.png","D":"/questions/beisen-1-clean/1-61/option-d-1.png","E":"/questions/beisen-1-clean/1-61/option-e-1.png"}'::jsonb, 5, 'C', 61),
  ('1-62', '1-62', '根据以上图形的规律，下一图形应该是：', '/questions/beisen-1-clean/1-62/prompt-1.png', '["/questions/beisen-1-clean/1-62/prompt-1.png"]'::jsonb, '{"A":"/questions/beisen-1-clean/1-62/option-a-1.png","B":"/questions/beisen-1-clean/1-62/option-b-1.png","C":"/questions/beisen-1-clean/1-62/option-c-1.png","D":"/questions/beisen-1-clean/1-62/option-d-1.png"}'::jsonb, 4, 'A', 62),
  ('1-64', '1-64', '根据以上图形的规律，下一个图形应该是：', '/questions/beisen-1-clean/1-64/prompt-1.png', '["/questions/beisen-1-clean/1-64/prompt-1.png"]'::jsonb, '{"A":"/questions/beisen-1-clean/1-64/option-a-1.png","B":"/questions/beisen-1-clean/1-64/option-b-1.png","C":"/questions/beisen-1-clean/1-64/option-c-1.png"}'::jsonb, 3, 'A', 64),
  ('1-66', '1-66', '根据以上图形的推理，下一图形应该是：', '/questions/beisen-1-clean/1-66/prompt-1.png', '["/questions/beisen-1-clean/1-66/prompt-1.png"]'::jsonb, '{"A":"/questions/beisen-1-clean/1-66/option-a-1.png","B":"/questions/beisen-1-clean/1-66/option-b-1.png","C":"/questions/beisen-1-clean/1-66/option-c-1.png","D":"/questions/beisen-1-clean/1-66/option-d-1.png"}'::jsonb, 4, 'D', 66),
  ('1-67', '1-67', '从所给出的四个选项中，选出最合适的一个填入问号处，使之呈现一定的规律性', '/questions/beisen-1-clean/1-67/prompt-1.png', '["/questions/beisen-1-clean/1-67/prompt-1.png"]'::jsonb, '{"A":"/questions/beisen-1-clean/1-67/option-a-1.png","B":"/questions/beisen-1-clean/1-67/option-b-1.png","C":"/questions/beisen-1-clean/1-67/option-c-1.png"}'::jsonb, 3, 'A', 67),
  ('1-68', '1-68', '从给出的四个选项中，选择最合适的一个填入问号处，使之呈现一定的规律性', '/questions/beisen-1-clean/1-68/prompt-1.png', '["/questions/beisen-1-clean/1-68/prompt-1.png"]'::jsonb, '{"A":"/questions/beisen-1-clean/1-68/option-a-1.png","B":"/questions/beisen-1-clean/1-68/option-b-1.png","C":"/questions/beisen-1-clean/1-68/option-c-1.png","D":"/questions/beisen-1-clean/1-68/option-d-1.png"}'::jsonb, 4, 'C', 68),
  ('1-69', '1-69', '下列哪一个图形是特殊的？', null, '[]'::jsonb, '{"A":"/questions/beisen-1-clean/1-69/option-a-1.png","B":"/questions/beisen-1-clean/1-69/option-b-1.png","C":"/questions/beisen-1-clean/1-69/option-c-1.png","D":"/questions/beisen-1-clean/1-69/option-d-1.png","E":"/questions/beisen-1-clean/1-69/option-e-1.png"}'::jsonb, 5, 'A', 69),
  ('1-73', '1-73', '从所给的四个选项中，选择最适合的一个填入问号处，使之呈现一定的规律性。', '/questions/beisen-1-clean/1-73/prompt-1.png', '["/questions/beisen-1-clean/1-73/prompt-1.png"]'::jsonb, '{"A":"/questions/beisen-1-clean/1-73/option-a-1.png","B":"/questions/beisen-1-clean/1-73/option-b-1.png","C":"/questions/beisen-1-clean/1-73/option-c-1.png","D":"/questions/beisen-1-clean/1-73/option-d-1.png"}'::jsonb, 4, 'D', 73),
  ('1-75', '1-75', '找出下列图形中不同于其他图形的一项：', null, '[]'::jsonb, '{"A":"/questions/beisen-1-clean/1-75/option-a-1.png","B":"/questions/beisen-1-clean/1-75/option-b-1.png","C":"/questions/beisen-1-clean/1-75/option-c-1.png","D":"/questions/beisen-1-clean/1-75/option-d-1.png"}'::jsonb, 4, 'A', 75),
  ('1-76', '1-76', '问号处的图形应该是：', '/questions/beisen-1-clean/1-76/prompt-1.png', '["/questions/beisen-1-clean/1-76/prompt-1.png"]'::jsonb, '{"A":"/questions/beisen-1-clean/1-76/option-a-1.png","B":"/questions/beisen-1-clean/1-76/option-b-1.png","C":"/questions/beisen-1-clean/1-76/option-c-1.png","D":"/questions/beisen-1-clean/1-76/option-d-1.png","E":"/questions/beisen-1-clean/1-76/option-e-1.png"}'::jsonb, 5, 'E', 76),
  ('1-77', '1-77', '问号处的图形应该是：', '/questions/beisen-1-clean/1-77/prompt-1.png', '["/questions/beisen-1-clean/1-77/prompt-1.png"]'::jsonb, '{"A":"/questions/beisen-1-clean/1-77/option-a-1.png","B":"/questions/beisen-1-clean/1-77/option-b-1.png","C":"/questions/beisen-1-clean/1-77/option-c-1.png","D":"/questions/beisen-1-clean/1-77/option-d-1.png","E":"/questions/beisen-1-clean/1-77/option-e-1.png"}'::jsonb, 5, 'C', 77),
  ('1-79', '1-79', '找出下列图形中不同于其他图形的一项：', null, '[]'::jsonb, '{"A":"/questions/beisen-1-clean/1-79/option-a-1.png","B":"/questions/beisen-1-clean/1-79/option-b-1.png","C":"/questions/beisen-1-clean/1-79/option-c-1.png","D":"/questions/beisen-1-clean/1-79/option-d-1.png"}'::jsonb, 4, 'A', 79),
  ('1-80', '1-80', '如果，那么，问号处的图形应当是：', '/questions/beisen-1-clean/1-80/prompt-1.png', '["/questions/beisen-1-clean/1-80/prompt-1.png","/questions/beisen-1-clean/1-80/prompt-2.png"]'::jsonb, '{"A":"/questions/beisen-1-clean/1-80/option-a-1.png","B":"/questions/beisen-1-clean/1-80/option-b-1.png","C":"/questions/beisen-1-clean/1-80/option-c-1.png","D":"/questions/beisen-1-clean/1-80/option-d-1.png"}'::jsonb, 4, 'B', 80),
  ('1-81', '1-81', '找出下列图形中不同于其他图形的一项：', null, '[]'::jsonb, '{"A":"/questions/beisen-1-clean/1-81/option-a-1.png","B":"/questions/beisen-1-clean/1-81/option-b-1.png","C":"/questions/beisen-1-clean/1-81/option-c-1.png","D":"/questions/beisen-1-clean/1-81/option-d-1.png"}'::jsonb, 4, 'C', 81),
  ('1-82', '1-82', '如果，那么，问号处的图形应该是：', '/questions/beisen-1-clean/1-82/prompt-1.png', '["/questions/beisen-1-clean/1-82/prompt-1.png","/questions/beisen-1-clean/1-82/prompt-2.png"]'::jsonb, '{"A":"/questions/beisen-1-clean/1-82/option-a-1.png","B":"/questions/beisen-1-clean/1-82/option-b-1.png","C":"/questions/beisen-1-clean/1-82/option-c-1.png","D":"/questions/beisen-1-clean/1-82/option-d-1.png"}'::jsonb, 4, 'B', 82),
  ('1-83', '1-83', '下列哪一图形是最特殊的？', null, '[]'::jsonb, '{"A":"/questions/beisen-1-clean/1-83/option-a-1.png","B":"/questions/beisen-1-clean/1-83/option-b-1.png","C":"/questions/beisen-1-clean/1-83/option-c-1.png","D":"/questions/beisen-1-clean/1-83/option-d-1.png","E":"/questions/beisen-1-clean/1-83/option-e-1.png"}'::jsonb, 5, 'D', 83),
  ('1-84', '1-84', '找出下列图形中不同于其他图形的一项：', null, '[]'::jsonb, '{"A":"/questions/beisen-1-clean/1-84/option-a-1.png","B":"/questions/beisen-1-clean/1-84/option-b-1.png","C":"/questions/beisen-1-clean/1-84/option-c-1.png","D":"/questions/beisen-1-clean/1-84/option-d-1.png"}'::jsonb, 4, 'B', 84),
  ('1-86', '1-86', '如果，那么，问号处的图形应该是：', '/questions/beisen-1-clean/1-86/prompt-1.png', '["/questions/beisen-1-clean/1-86/prompt-1.png","/questions/beisen-1-clean/1-86/prompt-2.png"]'::jsonb, '{"A":"/questions/beisen-1-clean/1-86/option-a-1.png","B":"/questions/beisen-1-clean/1-86/option-b-1.png","C":"/questions/beisen-1-clean/1-86/option-c-1.png","D":"/questions/beisen-1-clean/1-86/option-d-1.png"}'::jsonb, 4, 'A', 86),
  ('1-88', '1-88', '找出不同的一项：', null, '[]'::jsonb, '{"A":"/questions/beisen-1-clean/1-88/option-a-1.png","B":"/questions/beisen-1-clean/1-88/option-b-1.png","C":"/questions/beisen-1-clean/1-88/option-c-1.png","D":"/questions/beisen-1-clean/1-88/option-d-1.png"}'::jsonb, 4, 'C', 88),
  ('1-90', '1-90', '找出下列图形中不同于其他图形的一项：', null, '[]'::jsonb, '{"A":"/questions/beisen-1-clean/1-90/option-a-1.png","B":"/questions/beisen-1-clean/1-90/option-b-1.png","C":"/questions/beisen-1-clean/1-90/option-c-1.png","D":"/questions/beisen-1-clean/1-90/option-d-1.png"}'::jsonb, 4, 'A', 90),
  ('1-91', '1-91', '根据以上图形的规律，下一个图形应该是：', '/questions/beisen-1-clean/1-91/prompt-1.png', '["/questions/beisen-1-clean/1-91/prompt-1.png"]'::jsonb, '{"A":"/questions/beisen-1-clean/1-91/option-a-1.png","B":"/questions/beisen-1-clean/1-91/option-b-1.png","C":"/questions/beisen-1-clean/1-91/option-c-1.png","D":"/questions/beisen-1-clean/1-91/option-d-1.png"}'::jsonb, 4, 'D', 91),
  ('1-92', '1-92', '空白处的图形应该是：', '/questions/beisen-1-clean/1-92/prompt-1.png', '["/questions/beisen-1-clean/1-92/prompt-1.png"]'::jsonb, '{"A":"/questions/beisen-1-clean/1-92/option-a-1.png","B":"/questions/beisen-1-clean/1-92/option-b-1.png","C":"/questions/beisen-1-clean/1-92/option-c-1.jpeg","D":"/questions/beisen-1-clean/1-92/option-d-1.png"}'::jsonb, 4, 'D', 92),
  ('1-95', '1-95', '根据以上图形的规律，下一个图形应该是：', '/questions/beisen-1-clean/1-95/prompt-1.png', '["/questions/beisen-1-clean/1-95/prompt-1.png"]'::jsonb, '{"A":"/questions/beisen-1-clean/1-95/option-a-1.png","B":"/questions/beisen-1-clean/1-95/option-b-1.png","C":"/questions/beisen-1-clean/1-95/option-c-1.png","D":"/questions/beisen-1-clean/1-95/option-d-1.png"}'::jsonb, 4, 'A', 95),
  ('1-96', '1-96', '从所给的四个选项中，选择最合适的一个填入问号处，使之呈现一定的规律性', '/questions/beisen-1-clean/1-96/prompt-1.png', '["/questions/beisen-1-clean/1-96/prompt-1.png"]'::jsonb, '{"A":"/questions/beisen-1-clean/1-96/option-a-1.png","B":"/questions/beisen-1-clean/1-96/option-b-1.png","C":"/questions/beisen-1-clean/1-96/option-c-1.png","D":"/questions/beisen-1-clean/1-96/option-d-1.png"}'::jsonb, 4, 'B', 96),
  ('1-97', '1-97', '找出下列图形中不同于哦其他图形的一项：', null, '[]'::jsonb, '{"A":"/questions/beisen-1-clean/1-97/option-a-1.png","B":"/questions/beisen-1-clean/1-97/option-b-1.png","C":"/questions/beisen-1-clean/1-97/option-c-1.png","D":"/questions/beisen-1-clean/1-97/option-d-1.png"}'::jsonb, 4, 'A', 97),
  ('1-98', '1-98', '从所给的四个选项中，选择最合适的一个填入问号处，使之呈现一定的规律', '/questions/beisen-1-clean/1-98/prompt-1.png', '["/questions/beisen-1-clean/1-98/prompt-1.png"]'::jsonb, '{"A":"/questions/beisen-1-clean/1-98/option-a-1.png","B":"/questions/beisen-1-clean/1-98/option-b-1.png","C":"/questions/beisen-1-clean/1-98/option-c-1.png","D":"/questions/beisen-1-clean/1-98/option-d-1.png"}'::jsonb, 4, 'A', 98)
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

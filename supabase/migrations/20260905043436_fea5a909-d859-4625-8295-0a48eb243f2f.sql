ALTER TABLE public.relationship_message_library
  ADD COLUMN IF NOT EXISTS display_position integer;

WITH ordered AS (
  SELECT step_key, row_number() OVER (ORDER BY step_key ASC) * 10 AS pos
  FROM (SELECT DISTINCT step_key FROM public.relationship_message_library WHERE step_key IS NOT NULL) s
)
UPDATE public.relationship_message_library l
   SET display_position = o.pos
  FROM ordered o
 WHERE l.step_key = o.step_key
   AND l.display_position IS NULL;

CREATE INDEX IF NOT EXISTS idx_rml_display_position
  ON public.relationship_message_library (display_position);
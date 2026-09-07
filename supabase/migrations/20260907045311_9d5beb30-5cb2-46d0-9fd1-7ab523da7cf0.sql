ALTER TABLE public.name_central
  ADD COLUMN name_length integer GENERATED ALWAYS AS (char_length(name)) STORED;

CREATE INDEX name_central_name_length_idx ON public.name_central (name_length, name);
DROP INDEX IF EXISTS public.name_central_length_idx;
ALTER TABLE public.portal_meetings DROP CONSTRAINT IF EXISTS portal_meetings_origin_valid;
ALTER TABLE public.portal_meetings ADD CONSTRAINT portal_meetings_origin_valid
  CHECK (origin = ANY (ARRAY['portal'::text, 'executivo'::text, 'greensales'::text]));
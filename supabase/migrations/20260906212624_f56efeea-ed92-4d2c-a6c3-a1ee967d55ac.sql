CREATE TABLE public.environment_presentations_history (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  environment text NOT NULL CHECK (environment = ANY (ARRAY['financeira'::text,'solar'::text,'seguradora'::text])),
  intro_text text,
  video_url text,
  is_published boolean NOT NULL DEFAULT false,
  published_at timestamp with time zone,
  updated_by uuid,
  updated_by_name text,
  archived_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT ON public.environment_presentations_history TO authenticated;
GRANT ALL ON public.environment_presentations_history TO service_role;

ALTER TABLE public.environment_presentations_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read presentation history"
ON public.environment_presentations_history
FOR SELECT
TO authenticated
USING (true);

CREATE INDEX environment_presentations_history_env_idx
ON public.environment_presentations_history (environment, archived_at DESC);
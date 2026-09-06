ALTER TABLE public.crm_meta_templates ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

CREATE TABLE IF NOT EXISTS public.environment_presentations (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  environment text NOT NULL UNIQUE CHECK (environment IN ('financeira','solar','seguradora')),
  intro_text text NOT NULL DEFAULT '',
  video_url text,
  is_published boolean NOT NULL DEFAULT false,
  updated_by uuid,
  updated_by_name text NOT NULL DEFAULT '',
  published_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT ON public.environment_presentations TO anon;
GRANT SELECT ON public.environment_presentations TO authenticated;
GRANT ALL ON public.environment_presentations TO service_role;

ALTER TABLE public.environment_presentations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Apresentacoes publicadas sao publicas"
ON public.environment_presentations FOR SELECT TO anon, authenticated
USING (is_published = true);

CREATE TRIGGER update_environment_presentations_updated_at
BEFORE UPDATE ON public.environment_presentations
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
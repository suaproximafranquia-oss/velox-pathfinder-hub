CREATE TABLE IF NOT EXISTS public.portal_engagement (
  investor_id text PRIMARY KEY,
  sessions integer NOT NULL DEFAULT 0,
  returns integer NOT NULL DEFAULT 0,
  active_ms bigint NOT NULL DEFAULT 0,
  modules jsonb NOT NULL DEFAULT '{}'::jsonb,
  first_access_at timestamp with time zone NOT NULL DEFAULT now(),
  last_access_at timestamp with time zone NOT NULL DEFAULT now(),
  session_started_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT ON public.portal_engagement TO authenticated;
GRANT ALL ON public.portal_engagement TO service_role;

ALTER TABLE public.portal_engagement ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Equipe autenticada consulta o engajamento"
ON public.portal_engagement FOR SELECT TO authenticated USING (true);

CREATE TRIGGER update_portal_engagement_updated_at
BEFORE UPDATE ON public.portal_engagement
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TABLE IF NOT EXISTS private_automation_credentials_placeholder(); DROP TABLE IF EXISTS private_automation_credentials_placeholder;

CREATE TABLE IF NOT EXISTS public.automation_credentials (
  name text PRIMARY KEY,
  secret text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  rotated_at timestamptz NOT NULL DEFAULT now()
);

REVOKE ALL ON public.automation_credentials FROM PUBLIC;
REVOKE ALL ON public.automation_credentials FROM anon;
REVOKE ALL ON public.automation_credentials FROM authenticated;
GRANT ALL ON public.automation_credentials TO service_role;

ALTER TABLE public.automation_credentials ENABLE ROW LEVEL SECURITY;

INSERT INTO public.automation_credentials (name, secret)
VALUES ('PORTAL_AUTOMATION_SECRET', encode(gen_random_bytes(32), 'hex'))
ON CONFLICT (name) DO NOTHING;

CREATE OR REPLACE FUNCTION public.automation_request_headers(_name text DEFAULT 'PORTAL_AUTOMATION_SECRET')
RETURNS jsonb
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT jsonb_build_object(
    'Content-Type', 'application/json',
    'x-portal-automation', c.secret
  )
  FROM public.automation_credentials c
  WHERE c.name = _name;
$$;

REVOKE ALL ON FUNCTION public.automation_request_headers(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.automation_request_headers(text) FROM anon;
REVOKE ALL ON FUNCTION public.automation_request_headers(text) FROM authenticated;

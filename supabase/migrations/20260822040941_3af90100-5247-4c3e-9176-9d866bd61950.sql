CREATE TABLE IF NOT EXISTS public.executive_user_status (
  executive_id text PRIMARY KEY,
  status text NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo','inativo')),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by_name text
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.executive_user_status TO authenticated;
GRANT ALL ON public.executive_user_status TO service_role;

ALTER TABLE public.executive_user_status ENABLE ROW LEVEL SECURITY;

CREATE POLICY "portal members read executive status"
  ON public.executive_user_status FOR SELECT TO authenticated
  USING (public.is_portal_member());

CREATE POLICY "admins write executive status"
  ON public.executive_user_status FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
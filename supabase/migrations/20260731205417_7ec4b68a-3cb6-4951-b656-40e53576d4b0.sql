
-- Papéis em tabela separada
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('admin','manager','user');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Usuarios leem os proprios papeis" ON public.user_roles;
CREATE POLICY "Usuarios leem os proprios papeis" ON public.user_roles
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE OR REPLACE FUNCTION public.current_executive_id()
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT executive_id FROM public.executive_profiles WHERE user_id = auth.uid() LIMIT 1;
$$;

-- Administrador oficial do workspace
INSERT INTO public.user_roles (user_id, role)
SELECT user_id, 'admin'::public.app_role FROM public.executive_profiles WHERE executive_id = 'usr_thiago'
ON CONFLICT (user_id, role) DO NOTHING;

CREATE OR REPLACE FUNCTION public.grant_admin_for_official_executive()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.executive_id = 'usr_thiago' THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.user_id, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS executive_profiles_grant_admin ON public.executive_profiles;
CREATE TRIGGER executive_profiles_grant_admin
AFTER INSERT OR UPDATE ON public.executive_profiles
FOR EACH ROW EXECUTE FUNCTION public.grant_admin_for_official_executive();

-- portal_leads: leitura e escrita restritas
DROP POLICY IF EXISTS "Executives can read all portal leads" ON public.portal_leads;

CREATE POLICY "Leads visiveis ao responsavel ou admin" ON public.portal_leads
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR (responsible_executive_id IS NOT NULL AND responsible_executive_id = public.current_executive_id())
  );

CREATE POLICY "Responsavel ou admin atualiza leads" ON public.portal_leads
  FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR (responsible_executive_id IS NOT NULL AND responsible_executive_id = public.current_executive_id())
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR (responsible_executive_id IS NOT NULL AND responsible_executive_id = public.current_executive_id())
  );

CREATE POLICY "Responsavel ou admin exclui leads" ON public.portal_leads
  FOR DELETE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR (responsible_executive_id IS NOT NULL AND responsible_executive_id = public.current_executive_id())
  );

REVOKE INSERT ON public.portal_leads FROM authenticated, anon;
GRANT SELECT, UPDATE, DELETE ON public.portal_leads TO authenticated;
GRANT ALL ON public.portal_leads TO service_role;

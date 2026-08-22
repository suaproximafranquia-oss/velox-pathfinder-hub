CREATE TABLE public.workspace_module_permissions (
  user_id text NOT NULL,
  module_key text NOT NULL,
  enabled boolean NOT NULL,
  updated_by uuid,
  updated_by_name text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, module_key)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.workspace_module_permissions TO authenticated;
GRANT ALL ON public.workspace_module_permissions TO service_role;

ALTER TABLE public.workspace_module_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "portal members read module permissions"
  ON public.workspace_module_permissions FOR SELECT TO authenticated
  USING (public.is_portal_member());

CREATE POLICY "admins write module permissions"
  ON public.workspace_module_permissions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
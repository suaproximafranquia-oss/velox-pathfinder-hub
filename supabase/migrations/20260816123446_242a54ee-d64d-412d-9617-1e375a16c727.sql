CREATE TABLE public.crm_meta_templates (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  meta_name text NOT NULL,
  meta_id text,
  language text,
  category text,
  status text,
  header text,
  body text,
  footer text,
  variables jsonb NOT NULL DEFAULT '[]'::jsonb,
  buttons jsonb NOT NULL DEFAULT '[]'::jsonb,
  purpose text NOT NULL DEFAULT 'outro',
  meta_updated_at text,
  notes text,
  created_by uuid,
  created_by_name text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX crm_meta_templates_name_lang_key
  ON public.crm_meta_templates (lower(meta_name), coalesce(lower(language), ''));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_meta_templates TO authenticated;
GRANT ALL ON public.crm_meta_templates TO service_role;

ALTER TABLE public.crm_meta_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Autenticados leem templates Meta"
  ON public.crm_meta_templates FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admin e gestor gerenciam templates Meta"
  ON public.crm_meta_templates FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));

CREATE TRIGGER update_crm_meta_templates_updated_at
  BEFORE UPDATE ON public.crm_meta_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
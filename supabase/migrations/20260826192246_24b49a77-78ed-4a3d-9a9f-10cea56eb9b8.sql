CREATE TABLE public.relationship_step_content_bindings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  scope text NOT NULL DEFAULT 'production',
  step_key text NOT NULL,
  content_id uuid NOT NULL REFERENCES public.relationship_contents(id) ON DELETE CASCADE,
  active boolean NOT NULL DEFAULT true,
  notes text,
  created_by uuid,
  created_by_name text NOT NULL DEFAULT 'sistema',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.relationship_step_content_bindings TO authenticated;
GRANT ALL ON public.relationship_step_content_bindings TO service_role;

ALTER TABLE public.relationship_step_content_bindings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Portal members can read step content bindings"
ON public.relationship_step_content_bindings
FOR SELECT TO authenticated
USING (public.is_portal_member());

CREATE POLICY "Admins and managers manage step content bindings"
ON public.relationship_step_content_bindings
FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'))
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));

CREATE UNIQUE INDEX relationship_step_content_bindings_active_step
  ON public.relationship_step_content_bindings (scope, step_key)
  WHERE active;

CREATE INDEX relationship_step_content_bindings_content
  ON public.relationship_step_content_bindings (content_id);

CREATE TRIGGER relationship_step_content_bindings_updated
BEFORE UPDATE ON public.relationship_step_content_bindings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.remarketing_campaigns
  ADD COLUMN IF NOT EXISTS template_version integer NOT NULL DEFAULT 1;

ALTER TABLE public.remarketing_messages
  ADD COLUMN IF NOT EXISTS campaign_version integer,
  ADD COLUMN IF NOT EXISTS template_label text,
  ADD COLUMN IF NOT EXISTS template_language text;
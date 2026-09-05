CREATE TABLE public.relationship_flow_versions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  flow_key text NOT NULL,
  version integer NOT NULL,
  status text NOT NULL DEFAULT 'rascunho',
  published_at timestamp with time zone,
  published_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT relationship_flow_versions_status_check
    CHECK (status IN ('rascunho', 'publicada', 'arquivada')),
  CONSTRAINT relationship_flow_versions_unique UNIQUE (flow_key, version)
);

CREATE UNIQUE INDEX relationship_flow_versions_one_published
  ON public.relationship_flow_versions (flow_key)
  WHERE status = 'publicada';

GRANT SELECT, INSERT, UPDATE, DELETE ON public.relationship_flow_versions TO authenticated;
GRANT ALL ON public.relationship_flow_versions TO service_role;
ALTER TABLE public.relationship_flow_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Gestao ve versoes de fluxo"
  ON public.relationship_flow_versions FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));

CREATE POLICY "Gestao administra versoes de fluxo"
  ON public.relationship_flow_versions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));

CREATE TABLE public.relationship_flow_steps (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  flow_version_id uuid NOT NULL REFERENCES public.relationship_flow_versions(id) ON DELETE CASCADE,
  step_key text NOT NULL,
  position integer NOT NULL,
  business_days_after_reference integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT relationship_flow_steps_step_unique UNIQUE (flow_version_id, step_key),
  CONSTRAINT relationship_flow_steps_position_unique UNIQUE (flow_version_id, position)
);

CREATE INDEX relationship_flow_steps_version_position
  ON public.relationship_flow_steps (flow_version_id, position);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.relationship_flow_steps TO authenticated;
GRANT ALL ON public.relationship_flow_steps TO service_role;
ALTER TABLE public.relationship_flow_steps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Gestao ve etapas de fluxo"
  ON public.relationship_flow_steps FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));

CREATE POLICY "Gestao administra etapas de fluxo"
  ON public.relationship_flow_steps FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));

CREATE TRIGGER update_relationship_flow_versions_updated_at
  BEFORE UPDATE ON public.relationship_flow_versions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_relationship_flow_steps_updated_at
  BEFORE UPDATE ON public.relationship_flow_steps
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.relationship_cadences
  ADD COLUMN IF NOT EXISTS flow_version_id uuid REFERENCES public.relationship_flow_versions(id),
  ADD COLUMN IF NOT EXISTS flow_version integer;

ALTER TABLE public.relationship_queue
  ADD COLUMN IF NOT EXISTS flow_version_id uuid REFERENCES public.relationship_flow_versions(id);
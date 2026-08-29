CREATE TABLE IF NOT EXISTS public.relationship_non_business_days (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  day date NOT NULL UNIQUE,
  reason text NOT NULL DEFAULT '',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.relationship_non_business_days TO authenticated;
GRANT ALL ON public.relationship_non_business_days TO service_role;

ALTER TABLE public.relationship_non_business_days ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Portal lê dias sem envio"
ON public.relationship_non_business_days FOR SELECT TO authenticated
USING (public.is_portal_member());

CREATE POLICY "Gestão administra dias sem envio"
ON public.relationship_non_business_days FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'))
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));

CREATE OR REPLACE FUNCTION public.increment_content_usage(_content_id uuid, _at timestamptz DEFAULT now())
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.relationship_contents
     SET usage_count = COALESCE(usage_count, 0) + 1,
         last_used_at = _at
   WHERE id = _content_id;
$$;

REVOKE ALL ON FUNCTION public.increment_content_usage(uuid, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.increment_content_usage(uuid, timestamptz) TO service_role;

CREATE UNIQUE INDEX IF NOT EXISTS relationship_e20_lead_active_once
  ON public.relationship_e20_occurrences (lead_id)
  WHERE status = 'vigente';
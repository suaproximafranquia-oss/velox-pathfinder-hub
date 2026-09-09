CREATE TABLE public.portal_asset_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unit text NOT NULL,
  asset_key text NOT NULL,
  reference text NOT NULL,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (unit, asset_key)
);

GRANT ALL ON public.portal_asset_overrides TO service_role;

ALTER TABLE public.portal_asset_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "portal_asset_overrides_service_only"
  ON public.portal_asset_overrides FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE TRIGGER update_portal_asset_overrides_updated_at
  BEFORE UPDATE ON public.portal_asset_overrides
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
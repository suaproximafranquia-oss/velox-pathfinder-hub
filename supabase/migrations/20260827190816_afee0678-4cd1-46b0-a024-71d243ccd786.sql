CREATE OR REPLACE FUNCTION public.set_lead_operational(
  _id text,
  _viewed_at timestamptz DEFAULT NULL,
  _closed_at timestamptz DEFAULT NULL,
  _notes text DEFAULT NULL,
  _set_viewed boolean DEFAULT false,
  _set_closed boolean DEFAULT false,
  _set_notes boolean DEFAULT false
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lead record;
  v_allowed boolean := false;
  v_count integer := 0;
BEGIN
  SELECT id, responsible_executive_id INTO v_lead
  FROM public.portal_leads WHERE id = _id;
  IF NOT FOUND THEN
    RETURN 0;
  END IF;

  -- Mesma condição de visibilidade da política SELECT vigente.
  v_allowed :=
    public.has_role(auth.uid(), 'admin')
    OR (v_lead.responsible_executive_id IS NOT NULL
        AND v_lead.responsible_executive_id = public.current_executive_id())
    OR (public.has_role(auth.uid(), 'manager')
        AND v_lead.responsible_executive_id IS NOT NULL);

  IF NOT v_allowed THEN
    RAISE EXCEPTION 'Sem permissão para operar este lead.';
  END IF;

  UPDATE public.portal_leads SET
    viewed_at = CASE WHEN _set_viewed THEN _viewed_at ELSE viewed_at END,
    closed_at = CASE WHEN _set_closed THEN _closed_at ELSE closed_at END,
    notes     = CASE WHEN _set_notes  THEN _notes     ELSE notes     END
  WHERE id = _id;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.set_lead_operational(text, timestamptz, timestamptz, text, boolean, boolean, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_lead_operational(text, timestamptz, timestamptz, text, boolean, boolean, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_lead_operational(text, timestamptz, timestamptz, text, boolean, boolean, boolean) TO service_role;
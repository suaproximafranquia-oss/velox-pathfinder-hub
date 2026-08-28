CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE public.workspace_agenda_events
  ADD CONSTRAINT workspace_agenda_events_no_overlap
  EXCLUDE USING gist (
    executive_id WITH =,
    tstzrange(starts_at, ends_at, '[)') WITH &&
  ) WHERE (priority = 'maxima');

CREATE INDEX IF NOT EXISTS crm_cadence_tasks_status_due_idx
  ON public.crm_cadence_tasks (status, due_date);

CREATE OR REPLACE FUNCTION public.agenda_cadence_tasks(
  _from date,
  _to date,
  _executive_id text DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  lead_id text,
  lead_name text,
  due_date date,
  step_day integer,
  channel text,
  status text,
  note text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_self text := public.current_executive_id();
  v_admin boolean := public.has_role(auth.uid(), 'admin');
  v_target text;
BEGIN
  IF v_admin AND _executive_id IS NOT NULL THEN
    v_target := _executive_id;
  ELSE
    v_target := v_self;
  END IF;

  IF v_target IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT t.id, t.lead_id, l.name, t.due_date, t.step_day, t.channel, t.status, t.note
  FROM public.crm_cadence_tasks t
  JOIN public.portal_leads l ON l.id = t.lead_id
  WHERE l.responsible_executive_id = v_target
    AND t.status = 'pendente'
    AND t.due_date >= _from
    AND t.due_date <= _to
  ORDER BY t.due_date ASC, t.step_day ASC;
END;
$$;

REVOKE ALL ON FUNCTION public.agenda_cadence_tasks(date, date, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.agenda_cadence_tasks(date, date, text) TO authenticated, service_role;
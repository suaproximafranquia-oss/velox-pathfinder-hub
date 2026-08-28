CREATE TABLE public.workspace_agenda_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  executive_id text NOT NULL,
  title text NOT NULL,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  priority text NOT NULL DEFAULT 'maxima',
  source text NOT NULL DEFAULT 'agenda',
  note text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT workspace_agenda_events_priority_check CHECK (priority IN ('maxima','media','minima')),
  CONSTRAINT workspace_agenda_events_range_check CHECK (ends_at > starts_at)
);

CREATE INDEX workspace_agenda_events_exec_start_idx
  ON public.workspace_agenda_events (executive_id, starts_at);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.workspace_agenda_events TO authenticated;
GRANT ALL ON public.workspace_agenda_events TO service_role;

ALTER TABLE public.workspace_agenda_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Agenda: executivo vê a própria agenda"
  ON public.workspace_agenda_events FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR executive_id = public.current_executive_id());

CREATE POLICY "Agenda: executivo cria os próprios compromissos"
  ON public.workspace_agenda_events FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR executive_id = public.current_executive_id());

CREATE POLICY "Agenda: executivo edita os próprios compromissos"
  ON public.workspace_agenda_events FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR executive_id = public.current_executive_id())
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR executive_id = public.current_executive_id());

CREATE POLICY "Agenda: executivo remove os próprios compromissos"
  ON public.workspace_agenda_events FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR executive_id = public.current_executive_id());

CREATE TRIGGER workspace_agenda_events_updated
  BEFORE UPDATE ON public.workspace_agenda_events
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
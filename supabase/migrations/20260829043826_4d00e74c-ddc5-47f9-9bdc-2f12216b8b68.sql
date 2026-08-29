-- 1. Carteira das unidades: responsável, autoria e chaves de deduplicação
ALTER TABLE public.group_unit_leads
  ADD COLUMN IF NOT EXISTS responsible_executive_id text,
  ADD COLUMN IF NOT EXISTS responsible_executive_name text,
  ADD COLUMN IF NOT EXISTS assigned_by uuid,
  ADD COLUMN IF NOT EXISTS assigned_by_name text,
  ADD COLUMN IF NOT EXISTS assigned_at timestamptz,
  ADD COLUMN IF NOT EXISTS first_contact_by uuid,
  ADD COLUMN IF NOT EXISTS first_contact_by_name text,
  ADD COLUMN IF NOT EXISTS contact_note text,
  ADD COLUMN IF NOT EXISTS close_reason text,
  ADD COLUMN IF NOT EXISTS whatsapp_key text,
  ADD COLUMN IF NOT EXISTS email_key text,
  ADD COLUMN IF NOT EXISTS submissions integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS last_submitted_at timestamptz;

UPDATE public.group_unit_leads
   SET whatsapp_key = COALESCE(whatsapp_key, NULLIF(regexp_replace(COALESCE(whatsapp, ''), '\D', '', 'g'), '')),
       email_key = COALESCE(email_key, NULLIF(lower(btrim(COALESCE(email, ''))), '')),
       last_submitted_at = COALESCE(last_submitted_at, created_at);

CREATE UNIQUE INDEX IF NOT EXISTS group_unit_leads_unit_phone_key
  ON public.group_unit_leads (unit, whatsapp_key)
  WHERE whatsapp_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS group_unit_leads_unit_email_idx
  ON public.group_unit_leads (unit, email_key)
  WHERE email_key IS NOT NULL;

-- 2. Histórico dos interessados
CREATE TABLE IF NOT EXISTS public.group_unit_lead_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES public.group_unit_leads(id) ON DELETE CASCADE,
  unit text NOT NULL,
  kind text NOT NULL,
  from_status text,
  to_status text,
  note text,
  reason text,
  actor_id uuid,
  actor_name text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.group_unit_lead_events TO authenticated;
GRANT ALL ON public.group_unit_lead_events TO service_role;

ALTER TABLE public.group_unit_lead_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Administracao le historico das unidades" ON public.group_unit_lead_events;
CREATE POLICY "Administracao le historico das unidades"
  ON public.group_unit_lead_events FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));

CREATE INDEX IF NOT EXISTS group_unit_lead_events_lead_idx
  ON public.group_unit_lead_events (lead_id, at DESC);

-- 3. Apresentação Digital: rascunho x publicado
ALTER TABLE public.presentation_chapters
  ADD COLUMN IF NOT EXISTS is_draft boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS published_at timestamptz,
  ADD COLUMN IF NOT EXISTS published_by uuid,
  ADD COLUMN IF NOT EXISTS published_by_name text;

UPDATE public.presentation_chapters
   SET published_at = COALESCE(published_at, created_at),
       published_by = COALESCE(published_by, created_by),
       published_by_name = COALESCE(published_by_name, created_by_name)
 WHERE is_draft = false;

-- 4. E20: envio confirmado e cancelamento do checkpoint
ALTER TABLE public.relationship_e20_occurrences
  ADD COLUMN IF NOT EXISTS sent_confirmed_at timestamptz,
  ADD COLUMN IF NOT EXISTS sent_by uuid,
  ADD COLUMN IF NOT EXISTS sent_by_name text,
  ADD COLUMN IF NOT EXISTS checkpoint_cancel_reason text,
  ADD COLUMN IF NOT EXISTS script_version integer;

-- 5. Segurança: fim das leituras irrestritas
DROP POLICY IF EXISTS presentation_chapters_read_authenticated ON public.presentation_chapters;
CREATE POLICY presentation_chapters_admin_read
  ON public.presentation_chapters FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS relationship_e20_events_read_authenticated ON public.relationship_e20_events;
CREATE POLICY relationship_e20_events_scoped_read
  ON public.relationship_e20_events FOR SELECT TO authenticated
  USING (public.can_access_investor(lead_id));
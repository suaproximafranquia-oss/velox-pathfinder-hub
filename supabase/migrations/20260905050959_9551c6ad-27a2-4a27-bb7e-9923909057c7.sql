CREATE TABLE public.investor_notes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id text NOT NULL,
  scope text,
  body text NOT NULL,
  author_user_id uuid,
  author_executive_id text,
  author_name text,
  source_key text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.investor_notes TO authenticated;
GRANT ALL ON public.investor_notes TO service_role;

ALTER TABLE public.investor_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Equipe autenticada le notas do investidor"
  ON public.investor_notes FOR SELECT TO authenticated USING (true);

CREATE POLICY "Equipe autenticada cria notas do investidor"
  ON public.investor_notes FOR INSERT TO authenticated WITH CHECK (true);

CREATE UNIQUE INDEX investor_notes_source_key_uidx
  ON public.investor_notes (source_key) WHERE source_key IS NOT NULL;

CREATE INDEX investor_notes_lead_created_idx
  ON public.investor_notes (lead_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$
LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_investor_notes_updated_at
  BEFORE UPDATE ON public.investor_notes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
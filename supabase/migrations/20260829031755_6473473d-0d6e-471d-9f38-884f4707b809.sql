-- 1. Capítulos da Apresentação Digital (versionados, nunca apagados)
CREATE TABLE public.presentation_chapters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chapter_key uuid NOT NULL DEFAULT gen_random_uuid(),
  version integer NOT NULL DEFAULT 1,
  is_current boolean NOT NULL DEFAULT true,
  is_active boolean NOT NULL DEFAULT true,
  title text NOT NULL,
  description text,
  video_url text,
  thumbnail_url text,
  sort_order integer NOT NULL DEFAULT 0,
  created_by uuid,
  created_by_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX presentation_chapters_key_version_idx
  ON public.presentation_chapters (chapter_key, version);
CREATE INDEX presentation_chapters_current_idx
  ON public.presentation_chapters (is_current, is_active, sort_order);

GRANT SELECT ON public.presentation_chapters TO authenticated;
GRANT ALL ON public.presentation_chapters TO service_role;
ALTER TABLE public.presentation_chapters ENABLE ROW LEVEL SECURITY;
CREATE POLICY "presentation_chapters_read_authenticated"
  ON public.presentation_chapters FOR SELECT TO authenticated USING (true);

-- 2. Eventos distintos da Apresentação Digital
CREATE TABLE public.relationship_e20_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  occurrence_id uuid REFERENCES public.relationship_e20_occurrences(id) ON DELETE CASCADE,
  lead_id text NOT NULL,
  event text NOT NULL,
  actor_id uuid,
  actor_name text,
  reason text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX relationship_e20_events_lead_idx ON public.relationship_e20_events (lead_id, at DESC);
CREATE INDEX relationship_e20_events_occurrence_idx ON public.relationship_e20_events (occurrence_id, at DESC);

GRANT SELECT ON public.relationship_e20_events TO authenticated;
GRANT ALL ON public.relationship_e20_events TO service_role;
ALTER TABLE public.relationship_e20_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "relationship_e20_events_read_authenticated"
  ON public.relationship_e20_events FOR SELECT TO authenticated USING (true);

-- 3. Encerramento manual da E20 (autor e observação)
ALTER TABLE public.relationship_e20_occurrences
  ADD COLUMN IF NOT EXISTS closed_by uuid,
  ADD COLUMN IF NOT EXISTS closed_by_name text,
  ADD COLUMN IF NOT EXISTS close_note text;

-- 4. updated_at automático dos capítulos
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_presentation_chapters_updated_at
  BEFORE UPDATE ON public.presentation_chapters
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TABLE public.creative_official_model (
  id text PRIMARY KEY DEFAULT 'official',
  file_name text NOT NULL,
  mime_type text NOT NULL,
  content_base64 text NOT NULL,
  uploaded_by uuid,
  uploaded_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.creative_official_model TO authenticated;
GRANT ALL ON public.creative_official_model TO service_role;
ALTER TABLE public.creative_official_model ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Equipe autenticada le o modelo oficial" ON public.creative_official_model FOR SELECT TO authenticated USING (true);
CREATE POLICY "Equipe autenticada mantem o modelo oficial" ON public.creative_official_model FOR ALL TO authenticated USING (true) WITH CHECK (true);
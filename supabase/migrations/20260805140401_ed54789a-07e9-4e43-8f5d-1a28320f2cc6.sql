CREATE TABLE public.creative_templates (
  model TEXT PRIMARY KEY,
  file_name TEXT NOT NULL,
  content_type TEXT NOT NULL DEFAULT 'image/png',
  data_url TEXT NOT NULL,
  width INTEGER,
  height INTEGER,
  updated_by TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.creative_templates TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.creative_templates TO authenticated;
GRANT ALL ON public.creative_templates TO service_role;
ALTER TABLE public.creative_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "creative_templates_read" ON public.creative_templates FOR SELECT USING (true);
CREATE POLICY "creative_templates_write" ON public.creative_templates FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER update_creative_templates_updated_at BEFORE UPDATE ON public.creative_templates FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TABLE public.news_posts (
  id text PRIMARY KEY,
  title text NOT NULL,
  summary text NOT NULL DEFAULT '',
  body text NOT NULL DEFAULT '',
  image_url text,
  video_url text,
  audience text NOT NULL DEFAULT 'todos',
  status text NOT NULL DEFAULT 'rascunho',
  author_id text NOT NULL DEFAULT '',
  author_name text NOT NULL DEFAULT '',
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.news_posts TO authenticated;
GRANT ALL ON public.news_posts TO service_role;
ALTER TABLE public.news_posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Equipe autenticada le o feed" ON public.news_posts FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin e gestora publicam no feed" ON public.news_posts FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'));
CREATE POLICY "Admin e gestora atualizam o feed" ON public.news_posts FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager')) WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'));
CREATE POLICY "Admin e gestora removem do feed" ON public.news_posts FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'));
CREATE TRIGGER update_news_posts_updated_at BEFORE UPDATE ON public.news_posts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.meta_templates (
  id text PRIMARY KEY,
  name text NOT NULL,
  language text NOT NULL DEFAULT 'pt_BR',
  category text NOT NULL DEFAULT 'MARKETING',
  body text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'pendente',
  created_by text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.meta_templates TO authenticated;
GRANT ALL ON public.meta_templates TO service_role;
ALTER TABLE public.meta_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Equipe autenticada le templates" ON public.meta_templates FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin e gestora criam templates" ON public.meta_templates FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'));
CREATE POLICY "Admin e gestora atualizam templates" ON public.meta_templates FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager')) WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'));
CREATE POLICY "Admin e gestora removem templates" ON public.meta_templates FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'));
CREATE TRIGGER update_meta_templates_updated_at BEFORE UPDATE ON public.meta_templates FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.campaigns (
  id text PRIMARY KEY,
  name text NOT NULL,
  objective text NOT NULL DEFAULT '',
  template_id text,
  audience text NOT NULL DEFAULT 'todos',
  status text NOT NULL DEFAULT 'rascunho',
  scheduled_at timestamptz,
  sent_count integer NOT NULL DEFAULT 0,
  failed_count integer NOT NULL DEFAULT 0,
  replied_count integer NOT NULL DEFAULT 0,
  created_by text NOT NULL DEFAULT '',
  created_by_name text NOT NULL DEFAULT '',
  last_dispatch_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.campaigns TO authenticated;
GRANT ALL ON public.campaigns TO service_role;
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Equipe autenticada le campanhas" ON public.campaigns FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin e gestora criam campanhas" ON public.campaigns FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'));
CREATE POLICY "Admin e gestora atualizam campanhas" ON public.campaigns FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager')) WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'));
CREATE POLICY "Admin e gestora removem campanhas" ON public.campaigns FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'));
CREATE TRIGGER update_campaigns_updated_at BEFORE UPDATE ON public.campaigns FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
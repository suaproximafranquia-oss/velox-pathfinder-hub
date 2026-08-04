CREATE TABLE public.knowledge_documents (
  id text PRIMARY KEY,
  workspace_id text NOT NULL,
  name text NOT NULL,
  type text NOT NULL DEFAULT 'txt',
  visibility text NOT NULL DEFAULT 'publico',
  description text,
  size_bytes bigint NOT NULL DEFAULT 0,
  uploaded_by_user_id text NOT NULL DEFAULT '',
  uploaded_by_name text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'ativo',
  chunks jsonb NOT NULL DEFAULT '[]'::jsonb,
  uploaded_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.knowledge_documents TO authenticated;
GRANT ALL ON public.knowledge_documents TO service_role;

ALTER TABLE public.knowledge_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Equipe autenticada le a base oficial"
ON public.knowledge_documents FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admin e gestora publicam na base oficial"
ON public.knowledge_documents FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));

CREATE POLICY "Admin e gestora atualizam a base oficial"
ON public.knowledge_documents FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'))
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));

CREATE POLICY "Admin e gestora removem da base oficial"
ON public.knowledge_documents FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));

CREATE TRIGGER update_knowledge_documents_updated_at
BEFORE UPDATE ON public.knowledge_documents
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_knowledge_documents_workspace ON public.knowledge_documents (workspace_id);
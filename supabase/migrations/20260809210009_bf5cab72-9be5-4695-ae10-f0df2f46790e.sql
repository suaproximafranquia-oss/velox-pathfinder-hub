CREATE TABLE public.portal_backups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label text NOT NULL,
  kind text NOT NULL DEFAULT 'completo',
  origin text NOT NULL DEFAULT 'automatico',
  status text NOT NULL DEFAULT 'concluido',
  size_bytes bigint NOT NULL DEFAULT 0,
  table_counts jsonb NOT NULL DEFAULT '{}'::jsonb,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid,
  created_by_name text NOT NULL DEFAULT 'Sistema',
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT ON public.portal_backups TO authenticated;
GRANT ALL ON public.portal_backups TO service_role;
ALTER TABLE public.portal_backups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Administradores leem os pontos de restauracao"
  ON public.portal_backups FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX portal_backups_created_at_idx ON public.portal_backups (created_at DESC);

CREATE TABLE public.portal_restores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  backup_id uuid REFERENCES public.portal_backups(id) ON DELETE SET NULL,
  safety_backup_id uuid REFERENCES public.portal_backups(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'concluida',
  details text NOT NULL DEFAULT '',
  performed_by uuid,
  performed_by_name text NOT NULL DEFAULT '',
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT ON public.portal_restores TO authenticated;
GRANT ALL ON public.portal_restores TO service_role;
ALTER TABLE public.portal_restores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Administradores leem o historico de restauracoes"
  ON public.portal_restores FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX portal_restores_created_at_idx ON public.portal_restores (created_at DESC);
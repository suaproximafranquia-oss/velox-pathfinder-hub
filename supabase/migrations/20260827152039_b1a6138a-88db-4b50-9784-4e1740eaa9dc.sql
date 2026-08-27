CREATE TABLE public.portal_backup_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reference_hour timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'pendente',
  attempts integer NOT NULL DEFAULT 0,
  lease_owner text,
  lease_expires_at timestamptz,
  last_error text,
  backup_id uuid,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX portal_backup_requests_reference_hour_key
  ON public.portal_backup_requests (reference_hour);
CREATE INDEX portal_backup_requests_pending_idx
  ON public.portal_backup_requests (status, reference_hour);

GRANT SELECT ON public.portal_backup_requests TO authenticated;
GRANT ALL ON public.portal_backup_requests TO service_role;

ALTER TABLE public.portal_backup_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Gestao consulta a fila de backup"
  ON public.portal_backup_requests
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));

CREATE TRIGGER portal_backup_requests_updated
  BEFORE UPDATE ON public.portal_backup_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.portal_backups
  ADD COLUMN IF NOT EXISTS reference_hour timestamptz,
  ADD COLUMN IF NOT EXISTS last_error text;
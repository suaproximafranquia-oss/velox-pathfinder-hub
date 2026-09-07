-- lovable-cron-fallback-reviewed: 1440 runs/day; scheduled only on enqueue and unscheduled on drain, so it runs only while an import is in flight; a one-minute cadence is required so a 100k-name import keeps digesting with the browser closed and resumes after an interrupted attempt.
CREATE TABLE public.name_central_imports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text NOT NULL DEFAULT 'colagem',
  filename text,
  status text NOT NULL DEFAULT 'pendente',
  total_names integer NOT NULL DEFAULT 0,
  processed_names integer NOT NULL DEFAULT 0,
  added_names integer NOT NULL DEFAULT 0,
  existing_names integer NOT NULL DEFAULT 0,
  invalid_names integer NOT NULL DEFAULT 0,
  chunk_size integer NOT NULL DEFAULT 1000,
  attempts integer NOT NULL DEFAULT 0,
  lease_owner text,
  lease_expires_at timestamptz,
  last_error text,
  created_by text,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.name_central_imports TO authenticated;
GRANT ALL ON public.name_central_imports TO service_role;
ALTER TABLE public.name_central_imports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins acompanham as importacoes da Central dos Nomes"
  ON public.name_central_imports FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER name_central_imports_set_updated_at
  BEFORE UPDATE ON public.name_central_imports
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX name_central_imports_status_idx
  ON public.name_central_imports (status, created_at DESC);

CREATE TABLE public.name_central_import_chunks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  import_id uuid NOT NULL REFERENCES public.name_central_imports(id) ON DELETE CASCADE,
  seq integer NOT NULL,
  payload text NOT NULL,
  item_count integer NOT NULL DEFAULT 0,
  processed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (import_id, seq)
);

GRANT ALL ON public.name_central_import_chunks TO service_role;
ALTER TABLE public.name_central_import_chunks ENABLE ROW LEVEL SECURITY;

CREATE INDEX name_central_import_chunks_pending_idx
  ON public.name_central_import_chunks (import_id, seq)
  WHERE processed_at IS NULL;

CREATE INDEX name_central_length_idx
  ON public.name_central ((char_length(name)), name);

CREATE OR REPLACE FUNCTION public.name_central_import_wake()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'name-central-import') THEN
    PERFORM cron.schedule(
      'name-central-import',
      '* * * * *',
      $job$
      SELECT net.http_post(
        url:='https://project--ce3eb05c-3308-4ff2-9b94-650cb0170e82.lovable.app/api/public/name-central/process',
        headers:=public.automation_request_headers(),
        body:='{}'::jsonb
      );
      $job$
    );
  END IF;
END;
$fn$;

CREATE OR REPLACE FUNCTION public.name_central_import_sleep()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'name-central-import') THEN
    PERFORM cron.unschedule('name-central-import');
  END IF;
END;
$fn$;

REVOKE ALL ON FUNCTION public.name_central_import_wake() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.name_central_import_wake() FROM anon;
REVOKE ALL ON FUNCTION public.name_central_import_wake() FROM authenticated;
REVOKE ALL ON FUNCTION public.name_central_import_sleep() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.name_central_import_sleep() FROM anon;
REVOKE ALL ON FUNCTION public.name_central_import_sleep() FROM authenticated;
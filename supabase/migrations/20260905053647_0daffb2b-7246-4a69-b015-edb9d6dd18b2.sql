ALTER TABLE public.relationship_queue
  ADD COLUMN IF NOT EXISTS responsible_executive_id text;

COMMENT ON COLUMN public.relationship_queue.responsible_executive_id IS
  'SNAPSHOT HISTORICO: executivo responsavel pelo lead no instante em que o item da fila nasceu. Nunca recalculado. NULL = responsavel historico nao registrado (itens anteriores a esta coluna).';

CREATE OR REPLACE FUNCTION public.relationship_queue_stamp_responsible()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    -- imutavel: o responsavel do planejamento nunca e recalculado
    NEW.responsible_executive_id := OLD.responsible_executive_id;
    RETURN NEW;
  END IF;

  IF NEW.responsible_executive_id IS NULL THEN
    SELECT pl.responsible_executive_id
      INTO NEW.responsible_executive_id
      FROM public.portal_leads pl
     WHERE pl.id = NEW.lead_id
     LIMIT 1;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_relationship_queue_stamp_responsible ON public.relationship_queue;
CREATE TRIGGER trg_relationship_queue_stamp_responsible
BEFORE INSERT OR UPDATE ON public.relationship_queue
FOR EACH ROW EXECUTE FUNCTION public.relationship_queue_stamp_responsible();

CREATE INDEX IF NOT EXISTS idx_relationship_queue_responsible
  ON public.relationship_queue (responsible_executive_id, due_at);

CREATE INDEX IF NOT EXISTS idx_relationship_engine_log_action_created
  ON public.relationship_engine_log (action, created_at DESC);
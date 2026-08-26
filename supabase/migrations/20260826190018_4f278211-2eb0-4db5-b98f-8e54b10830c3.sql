-- Uma jornada por instância; a chave antiga (uma linha por lead) sai de
-- cena SEM apagar dado algum. As linhas existentes já são instância 1.
DROP INDEX IF EXISTS public.relationship_cadences_key;

CREATE UNIQUE INDEX IF NOT EXISTS relationship_cadences_instance_key
  ON public.relationship_cadences (scope, run_id, lead_id, instance_seq)
  NULLS NOT DISTINCT;

-- Trava de integridade: no máximo UMA instância ativa por lead/escopo.
CREATE UNIQUE INDEX IF NOT EXISTS relationship_cadences_single_active_key
  ON public.relationship_cadences (scope, run_id, lead_id)
  NULLS NOT DISTINCT
  WHERE active;
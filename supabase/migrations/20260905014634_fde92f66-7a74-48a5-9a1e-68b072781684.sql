ALTER TABLE public.relationship_cadences
  ADD COLUMN IF NOT EXISTS operational_since timestamptz;

COMMENT ON COLUMN public.relationship_cadences.operational_since IS
  'Nascimento operacional do ciclo. Preenchido apenas em ciclos criados a partir do marco (cadence_activation_date). NULL = ciclo legado: a classificação usa started_at/updated_at comparados ao marco. Nunca preenchido retroativamente.';

CREATE INDEX IF NOT EXISTS relationship_cadences_operational_since_idx
  ON public.relationship_cadences (scope, operational_since);
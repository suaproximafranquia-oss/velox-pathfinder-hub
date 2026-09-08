-- Biblioteca do Motor: unicidade por (etapa + contexto). Índices apenas; nenhuma linha é tocada.
DROP INDEX IF EXISTS public.relationship_message_library_active_step;
DROP INDEX IF EXISTS public.relationship_message_library_active_idx;
DROP INDEX IF EXISTS public.relationship_message_library_version_idx;

CREATE UNIQUE INDEX relationship_message_library_active_step
  ON public.relationship_message_library (scope, step_key, COALESCE(step_context, ''))
  WHERE active;

CREATE UNIQUE INDEX relationship_message_library_active_idx
  ON public.relationship_message_library (scope, purpose, COALESCE(step_context, ''))
  WHERE active;

CREATE UNIQUE INDEX relationship_message_library_version_idx
  ON public.relationship_message_library (scope, purpose, COALESCE(step_context, ''), version);
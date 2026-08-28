-- 1) Vínculo etapa ↔ conteúdo passa a ser fonte única e aceita vários conteúdos por etapa.
ALTER TABLE public.relationship_step_content_bindings
  ADD COLUMN IF NOT EXISTS position integer NOT NULL DEFAULT 0;

DROP INDEX IF EXISTS public.relationship_step_content_bindings_active_step;

CREATE UNIQUE INDEX IF NOT EXISTS relationship_step_content_bindings_active_pair
  ON public.relationship_step_content_bindings (scope, step_key, content_id)
  WHERE active;

CREATE INDEX IF NOT EXISTS relationship_step_content_bindings_step_idx
  ON public.relationship_step_content_bindings (scope, step_key)
  WHERE active;

-- Migração dos vínculos históricos (grupos) para a fonte única. Nada é apagado
-- na estrutura antiga: ela apenas deixa de ser lida pelo sistema.
INSERT INTO public.relationship_step_content_bindings
  (scope, step_key, content_id, active, notes, created_by_name, position)
SELECT 'production', g.content_group, g.content_id, true,
       'Migrado de relationship_content_groups (Comando 2A).',
       'Motor de Relacionamento', 0
FROM public.relationship_content_groups g
JOIN public.relationship_contents c ON c.id = g.content_id
WHERE NOT EXISTS (
  SELECT 1 FROM public.relationship_step_content_bindings b
  WHERE b.scope = 'production'
    AND b.step_key = g.content_group
    AND b.content_id = g.content_id
    AND b.active
);

-- 2) Origem estruturada do conteúdo oficial na Biblioteca de Mensagens.
ALTER TABLE public.relationship_message_library
  ADD COLUMN IF NOT EXISTS source_kind text,
  ADD COLUMN IF NOT EXISTS source_reference text,
  ADD COLUMN IF NOT EXISTS imported_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS import_version integer;

COMMENT ON COLUMN public.relationship_message_library.source_kind IS
  'Origem do texto: seed | word_oficial | executivo. Nunca altera versões já publicadas.';

-- 3) Cargo do executivo, usado na personalização das mensagens.
ALTER TABLE public.executive_profiles
  ADD COLUMN IF NOT EXISTS role_title text;
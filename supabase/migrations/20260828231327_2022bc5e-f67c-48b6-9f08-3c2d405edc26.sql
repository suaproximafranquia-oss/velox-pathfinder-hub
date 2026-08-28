ALTER TABLE public.relationship_message_library
  ADD COLUMN IF NOT EXISTS body_without_name text;

COMMENT ON COLUMN public.relationship_message_library.body_without_name IS
  'Versão oficial "sem nome" da mensagem (Word oficial). NULL quando a etapa não possui variante.';
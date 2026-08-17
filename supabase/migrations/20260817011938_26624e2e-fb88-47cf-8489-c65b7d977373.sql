ALTER TABLE public.relationship_contents DROP CONSTRAINT IF EXISTS relationship_contents_kind_check;
ALTER TABLE public.relationship_contents ADD CONSTRAINT relationship_contents_kind_check
  CHECK (kind IN ('imagem','video','pdf','documento','apresentacao','arquivo','link'));

ALTER TABLE public.relationship_contents DROP CONSTRAINT IF EXISTS relationship_contents_scope_check;
ALTER TABLE public.relationship_contents ADD CONSTRAINT relationship_contents_scope_check
  CHECK (scope IN ('library','production','homologation'));

ALTER TABLE public.relationship_contents ALTER COLUMN scope SET DEFAULT 'library';
ALTER TABLE public.relationship_contents ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE public.relationship_contents ADD COLUMN IF NOT EXISTS mime_type TEXT;
ALTER TABLE public.relationship_contents ADD COLUMN IF NOT EXISTS last_used_at TIMESTAMPTZ;

UPDATE public.relationship_contents SET scope = 'library' WHERE scope <> 'library';
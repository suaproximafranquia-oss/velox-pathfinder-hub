CREATE TABLE public.magazine_editions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  number integer NOT NULL UNIQUE,
  title text NOT NULL,
  subtitle text,
  cover_url text,
  starts_on date NOT NULL DEFAULT (now() AT TIME ZONE 'America/Sao_Paulo')::date,
  published boolean NOT NULL DEFAULT false,
  created_by uuid,
  created_by_name text NOT NULL DEFAULT 'Sistema',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.magazine_editions TO service_role;
ALTER TABLE public.magazine_editions ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.magazine_pages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  edition_id uuid NOT NULL REFERENCES public.magazine_editions(id) ON DELETE CASCADE,
  position integer NOT NULL DEFAULT 1,
  eyebrow text,
  title text NOT NULL,
  body text NOT NULL DEFAULT '',
  caption text,
  media_kind text NOT NULL DEFAULT 'none',
  media_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX magazine_pages_edition_idx ON public.magazine_pages(edition_id, position);
GRANT ALL ON public.magazine_pages TO service_role;
ALTER TABLE public.magazine_pages ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.portal_institutional_blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  module text NOT NULL,
  position integer NOT NULL DEFAULT 1,
  eyebrow text,
  title text NOT NULL,
  body text NOT NULL DEFAULT '',
  media_kind text NOT NULL DEFAULT 'none',
  media_url text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX portal_institutional_blocks_module_idx ON public.portal_institutional_blocks(module, position);
GRANT ALL ON public.portal_institutional_blocks TO service_role;
ALTER TABLE public.portal_institutional_blocks ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER magazine_editions_updated BEFORE UPDATE ON public.magazine_editions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER magazine_pages_updated BEFORE UPDATE ON public.magazine_pages FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER portal_institutional_blocks_updated BEFORE UPDATE ON public.portal_institutional_blocks FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TABLE public.creative_art_cache (
  cache_key text PRIMARY KEY,
  city text NOT NULL,
  state text NOT NULL,
  model_version text NOT NULL,
  institucional_base64 text NOT NULL,
  marketing_base64 text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.creative_art_cache TO authenticated;
GRANT ALL ON public.creative_art_cache TO service_role;

ALTER TABLE public.creative_art_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Equipe autenticada le o cache de artes"
ON public.creative_art_cache FOR SELECT TO authenticated USING (true);
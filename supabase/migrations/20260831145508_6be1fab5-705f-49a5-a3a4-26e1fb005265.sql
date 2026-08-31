ALTER TABLE public.executive_profiles
  ADD COLUMN IF NOT EXISTS slug text,
  ADD COLUMN IF NOT EXISTS title text,
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS admission_date date,
  ADD COLUMN IF NOT EXISTS birth_date date,
  ADD COLUMN IF NOT EXISTS photo_url text,
  ADD COLUMN IF NOT EXISTS post_presentation_video_url text,
  ADD COLUMN IF NOT EXISTS gestor_id text;

CREATE UNIQUE INDEX IF NOT EXISTS executive_profiles_slug_unique
  ON public.executive_profiles (lower(slug))
  WHERE slug IS NOT NULL AND slug <> '';

INSERT INTO public.executive_user_status (executive_id, status)
SELECT p.executive_id, 'ativo'
FROM public.executive_profiles p
ON CONFLICT (executive_id) DO NOTHING;

GRANT SELECT, INSERT, UPDATE ON public.executive_profiles TO authenticated;
GRANT ALL ON public.executive_profiles TO service_role;
GRANT SELECT ON public.executive_user_status TO authenticated;
GRANT ALL ON public.executive_user_status TO service_role;

DROP POLICY IF EXISTS "Administrador mantem qualquer ficha de executivo" ON public.executive_profiles;
CREATE POLICY "Administrador mantem qualquer ficha de executivo"
ON public.executive_profiles
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR user_id = auth.uid())
WITH CHECK (public.has_role(auth.uid(), 'admin') OR user_id = auth.uid());
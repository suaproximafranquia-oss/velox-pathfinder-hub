CREATE TABLE public.name_central (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  normalized_key text NOT NULL,
  created_by text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX name_central_normalized_key_uidx ON public.name_central (normalized_key);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.name_central TO authenticated;
GRANT ALL ON public.name_central TO service_role;

ALTER TABLE public.name_central ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins gerenciam a Central dos Nomes"
ON public.name_central
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER name_central_set_updated_at
BEFORE UPDATE ON public.name_central
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
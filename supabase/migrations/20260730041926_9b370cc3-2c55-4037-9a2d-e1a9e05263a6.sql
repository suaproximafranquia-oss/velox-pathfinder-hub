CREATE TABLE public.app_user_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  connector_id text NOT NULL,
  connection_key_ciphertext text NOT NULL,
  account_email text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, connector_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.app_user_connections TO service_role;
ALTER TABLE public.app_user_connections ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.executive_profiles (
  user_id uuid PRIMARY KEY,
  executive_id text NOT NULL,
  email text NOT NULL,
  name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.executive_profiles TO authenticated;
GRANT ALL ON public.executive_profiles TO service_role;
ALTER TABLE public.executive_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Executivos leem o proprio perfil"
ON public.executive_profiles FOR SELECT TO authenticated
USING (auth.uid() = user_id);
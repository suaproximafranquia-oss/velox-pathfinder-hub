UPDATE public.crm_pipeline_stages SET visible = true;
UPDATE public.crm_pipeline_stages SET label = 'FRIOS' WHERE key = 'frio';
UPDATE public.crm_pipeline_stages SET label = '4COF/CONTRATO' WHERE key = 'cof_contrato';

CREATE TABLE public.crm_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  provider text NOT NULL DEFAULT 'greensales',
  account_label text,
  account_email text,
  credentials_ciphertext text,
  status text NOT NULL DEFAULT 'ATIVA',
  last_verified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, provider)
);

GRANT ALL ON public.crm_connections TO service_role;
ALTER TABLE public.crm_connections ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER update_crm_connections_updated_at
BEFORE UPDATE ON public.crm_connections
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
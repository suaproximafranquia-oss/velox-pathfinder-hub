REVOKE ALL ON FUNCTION public.can_read_crm_lead(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_read_crm_lead(text) TO authenticated, service_role;

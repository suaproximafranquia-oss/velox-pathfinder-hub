REVOKE EXECUTE ON FUNCTION public.can_access_e0_action(text, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.can_access_e0_action(text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.can_access_e0_action(text, text) TO authenticated;
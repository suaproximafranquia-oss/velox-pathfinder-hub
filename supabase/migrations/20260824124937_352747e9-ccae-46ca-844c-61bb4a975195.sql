-- As funções da trava são internas: executadas apenas pelo gatilho do banco.
REVOKE EXECUTE ON FUNCTION public.guard_lead_delete() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.guard_lead_truncate() FROM PUBLIC, anon, authenticated;
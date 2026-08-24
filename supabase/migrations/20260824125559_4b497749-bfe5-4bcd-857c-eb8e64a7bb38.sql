CREATE OR REPLACE FUNCTION public.guard_lead_delete()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF OLD.is_test IS TRUE OR OLD.id ILIKE 'TEST-%' THEN
    RETURN OLD;
  END IF;
  INSERT INTO public.portal_lead_guard_log (table_name, lead_id, lead_name, operation, actor_label, reason)
  VALUES (
    TG_TABLE_NAME,
    OLD.id::text,
    CASE WHEN TG_TABLE_NAME = 'portal_leads' THEN OLD.name ELSE NULL END,
    'delete',
    current_user,
    'Tentativa de exclusão bloqueada pela blindagem definitiva dos Leads.'
  );
  -- A exceção desfaria também o registro de auditoria acima. Em vez
  -- disso: aviso + NULL = a exclusão não opera e a auditoria persiste.
  RAISE WARNING 'LeadGuard: %', 'Os Leads do Portal estão protegidos contra reset e exclusão. Esta operação não pode remover Leads já registrados.';
  RETURN NULL;
END;
$$;
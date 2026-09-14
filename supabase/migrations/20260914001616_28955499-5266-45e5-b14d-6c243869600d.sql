BEGIN;
ALTER TABLE public.crm_leads DISABLE TRIGGER guard_crm_leads_delete;
DELETE FROM public.crm_leads AS c
WHERE c.external_source = 'greensales'
  AND NOT EXISTS (
    SELECT 1 FROM public.portal_leads AS p
    WHERE p.external_id = c.external_id
  )
  AND c.external_id <> '56503'
  AND c.external_id <> '57906';
ALTER TABLE public.crm_leads ENABLE TRIGGER guard_crm_leads_delete;
COMMIT;
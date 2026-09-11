ALTER TABLE public.portal_leads DISABLE TRIGGER guard_portal_leads_delete;
ALTER TABLE public.crm_leads DISABLE TRIGGER guard_crm_leads_delete;

DELETE FROM public.portal_leads WHERE id NOT IN ('gs_59034','gs_59037','gs_59081','gs_59279');
DELETE FROM public.crm_leads WHERE external_id NOT IN ('59034','59037','59081','59279');

ALTER TABLE public.portal_leads ENABLE TRIGGER guard_portal_leads_delete;
ALTER TABLE public.crm_leads ENABLE TRIGGER guard_crm_leads_delete;
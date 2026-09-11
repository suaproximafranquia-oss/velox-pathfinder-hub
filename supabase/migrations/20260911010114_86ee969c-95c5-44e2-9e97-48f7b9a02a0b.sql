DELETE FROM public.portal_leads WHERE id NOT IN ('gs_59034','gs_59037','gs_59081','gs_59279');
DELETE FROM public.crm_leads WHERE external_id NOT IN ('59034','59037','59081','59279');
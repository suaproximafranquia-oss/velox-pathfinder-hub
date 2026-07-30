DELETE FROM public.portal_leads
WHERE email IN (
  'auditor.personalizado@teste.com',
  'auditor.institucional@teste.com',
  'tempo.real@teste.com',
  'probe.rt@teste.com'
);
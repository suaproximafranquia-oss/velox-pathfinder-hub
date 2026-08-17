INSERT INTO public.relationship_content_groups (content_id, content_group)
SELECT '5af38cc0-193d-41db-b830-1672e0953bf1'::uuid, 'FINALIZACAO'
WHERE NOT EXISTS (
  SELECT 1 FROM public.relationship_content_groups
  WHERE content_id = '5af38cc0-193d-41db-b830-1672e0953bf1'::uuid
    AND content_group = 'FINALIZACAO'
);

INSERT INTO public.relationship_content_groups (content_id, content_group)
SELECT '5af38cc0-193d-41db-b830-1672e0953bf1'::uuid, 'R2'
WHERE NOT EXISTS (
  SELECT 1 FROM public.relationship_content_groups
  WHERE content_id = '5af38cc0-193d-41db-b830-1672e0953bf1'::uuid
    AND content_group = 'R2'
);
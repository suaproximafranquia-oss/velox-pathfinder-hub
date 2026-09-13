WITH source_e6 AS (
  SELECT *
  FROM public.relationship_message_library
  WHERE scope = 'production'
    AND step_key = 'E6'
    AND step_context = 'SEM_CONTATO'
    AND active = true
  ORDER BY version DESC, created_at DESC
  LIMIT 1
), deactivate_e6 AS (
  UPDATE public.relationship_message_library
  SET active = false
  WHERE scope = 'production'
    AND step_key = 'E6'
    AND active = true
  RETURNING id
), next_version AS (
  SELECT COALESCE(MAX(version), 0) + 1 AS version
  FROM public.relationship_message_library
  WHERE scope = 'production'
    AND step_key = 'E6'
    AND step_context IS NULL
)
INSERT INTO public.relationship_message_library (
  scope,
  step_key,
  step_context,
  code,
  title,
  purpose,
  body,
  body_without_name,
  version,
  active,
  content_group,
  content_url,
  content_label,
  button_kind,
  display_position,
  supersedes_id,
  created_by,
  created_by_name,
  notes,
  source_kind,
  source_reference,
  imported_at,
  import_version
)
SELECT
  'production',
  'E6',
  NULL,
  source_e6.code,
  'E6 — Acompanhamento da apresentação digital',
  source_e6.purpose,
  source_e6.body,
  source_e6.body_without_name,
  next_version.version,
  true,
  source_e6.content_group,
  source_e6.content_url,
  source_e6.content_label,
  source_e6.button_kind,
  source_e6.display_position,
  source_e6.id,
  source_e6.created_by,
  source_e6.created_by_name,
  'E6 consolidada em contexto editorial único; versões contextuais anteriores preservadas como histórico.',
  source_e6.source_kind,
  source_e6.source_reference,
  source_e6.imported_at,
  next_version.version
FROM source_e6
CROSS JOIN next_version
WHERE EXISTS (SELECT 1 FROM deactivate_e6);
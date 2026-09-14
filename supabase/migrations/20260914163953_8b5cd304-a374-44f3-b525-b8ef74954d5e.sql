ALTER TABLE public.relationship_message_library
  DROP CONSTRAINT relationship_message_library_step_context_check;

ALTER TABLE public.relationship_message_library
  ADD CONSTRAINT relationship_message_library_step_context_check
  CHECK (
    step_context IS NULL OR step_context IN (
      'SEM_CONTATO',
      'CONTATO_REALIZADO',
      'MATERIAL_ENVIADO',
      'V2',
      'V3',
      'NAO_CHEGOU_E4',
      'JA_PASSOU_E4'
    )
  );

UPDATE public.relationship_message_library
SET step_context = 'SEM_CONTATO'
WHERE scope = 'production'
  AND step_key = 'E0'
  AND step_context IS NULL;

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
  created_by_name,
  notes,
  source_kind,
  source_reference
)
SELECT
  'production',
  'E0',
  'CONTATO_REALIZADO',
  'LIB-E0',
  'E0 — Contato realizado',
  'e0',
  'Oi, {{nome_investidor}}, tudo bem?\n\nAqui é o Tiago, da Velox.\n\nConforme combinamos em nossa ligação, estou te disponibilizando um material para que você possa conhecer melhor o nosso projeto.\n\nSeparei as principais informações para você conhecer essa oportunidade com calma.\n\nAcesse por aqui:\n\nhttps://portalvelox.com.br',
  'Oi, tudo bem?\n\nAqui é o Tiago, da Velox.\n\nConforme combinamos em nossa ligação, estou te disponibilizando um material para que você possa conhecer melhor o nosso projeto.\n\nSeparei as principais informações para você conhecer essa oportunidade com calma.\n\nAcesse por aqui:\n\nhttps://portalvelox.com.br',
  1,
  true,
  NULL,
  NULL,
  NULL,
  NULL,
  COALESCE((SELECT min(display_position) FROM public.relationship_message_library WHERE scope = 'production' AND step_key = 'E0'), 10),
  'Gestão Velox',
  'Contexto oficial da E0 após contato telefônico realizado.',
  'gestao',
  'Implementação definitiva E0 — 2026-09-14'
WHERE NOT EXISTS (
  SELECT 1
  FROM public.relationship_message_library
  WHERE scope = 'production'
    AND step_key = 'E0'
    AND step_context = 'CONTATO_REALIZADO'
);
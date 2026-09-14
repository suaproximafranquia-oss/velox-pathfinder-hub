INSERT INTO public.relationship_message_library (
  scope,
  purpose,
  version,
  title,
  body,
  body_without_name,
  active,
  notes,
  created_by_name,
  step_key,
  code,
  button_kind,
  display_position,
  step_context
)
SELECT
  'production',
  'envio_material_pos_contato',
  1,
  'Envio de material após contato',
  E'Oi, {{nome_investidor}}, tudo bem?\n\nConforme combinamos por telefone, estou te disponibilizando um material para você conhecer melhor a nossa franquia e entender com calma como funciona essa oportunidade.\n\nVocê pode acessar por aqui:\n\n{{link_manual_investidor}}\n\nQuando der uma olhada, me conta o que achou. A partir disso, seguimos juntos para os próximos passos.',
  E'Oi, tudo bem?\n\nConforme combinamos por telefone, estou te disponibilizando um material para você conhecer melhor a nossa franquia e entender com calma como funciona essa oportunidade.\n\nVocê pode acessar por aqui:\n\n{{link_manual_investidor}}\n\nQuando der uma olhada, me conta o que achou. A partir disso, seguimos juntos para os próximos passos.',
  true,
  'Finalidade manual independente da cadência. Copiar não registra envio nem altera a jornada.',
  'Motor de Relacionamento',
  'ENVIO_MATERIAL_POS_CONTATO',
  'LIB-ENVIO-MATERIAL-POS-CONTATO',
  null,
  COALESCE((SELECT max(display_position) + 10 FROM public.relationship_message_library WHERE scope = 'production'), 10),
  null
WHERE NOT EXISTS (
  SELECT 1
  FROM public.relationship_message_library
  WHERE scope = 'production'
    AND step_key = 'ENVIO_MATERIAL_POS_CONTATO'
);
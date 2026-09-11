ALTER TABLE public.relationship_message_library
  DROP CONSTRAINT relationship_message_library_step_context_check;

ALTER TABLE public.relationship_message_library
  ADD CONSTRAINT relationship_message_library_step_context_check
  CHECK (
    step_context IS NULL
    OR step_context IN (
      'SEM_CONTATO',
      'MATERIAL_ENVIADO',
      'V2',
      'V3',
      'NAO_CHEGOU_E4',
      'JA_PASSOU_E4'
    )
  );
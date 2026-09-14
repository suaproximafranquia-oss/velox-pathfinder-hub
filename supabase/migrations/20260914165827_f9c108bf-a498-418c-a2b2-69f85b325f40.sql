UPDATE public.relationship_queue
SET status = 'CANCELLED',
    cancel_reason = 'cadence_rule_single_call',
    reason = 'Regra vigente: somente E0 pode possuir segunda ligação automática.',
    updated_at = now()
WHERE action_kind = 'call'
  AND (
    (step = 'E1' AND action_order = 2)
    OR (step = 'E2' AND action_order = 3)
  )
  AND status IN ('PENDING', 'PROCESSING');
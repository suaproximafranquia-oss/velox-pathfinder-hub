ALTER TABLE public.workspace_e0_actions
  ADD COLUMN IF NOT EXISTS voided_at timestamptz,
  ADD COLUMN IF NOT EXISTS voided_reason text;
ALTER TABLE public.crm_messages
  ADD COLUMN IF NOT EXISTS voided_at timestamptz,
  ADD COLUMN IF NOT EXISTS voided_reason text;
ALTER TABLE public.relationship_events
  ADD COLUMN IF NOT EXISTS voided_at timestamptz,
  ADD COLUMN IF NOT EXISTS voided_reason text;
ALTER TABLE public.relationship_queue
  ADD COLUMN IF NOT EXISTS claimed_by text,
  ADD COLUMN IF NOT EXISTS claimed_at timestamptz;

CREATE INDEX IF NOT EXISTS workspace_e0_actions_voided_idx ON public.workspace_e0_actions (card_id) WHERE voided_at IS NOT NULL;

-- Restauração do Paulo (gs_59028): anular o teste do fluxo legado sem apagar nada.
UPDATE public.workspace_e0_actions
   SET voided_at = now(),
       voided_reason = 'Anulada: execução de teste do fluxo legado de E0 em 08/09/2026; E0 reaberta pela régua V2 na Ação do Dia.'
 WHERE id = '7f5b4ad9-776a-40bf-a170-283b0e0ba737' AND voided_at IS NULL;

UPDATE public.crm_messages
   SET voided_at = now(),
       voided_reason = 'Anulada: registro interno de teste do E0 legado (nenhum envio real ocorreu — Safety Lock).'
 WHERE id = 'msg_e0_gs_59028' AND voided_at IS NULL;

UPDATE public.relationship_events
   SET voided_at = now(),
       voided_reason = 'Anulado: FIRST_CONTACT_SENT gerado por teste do fluxo legado de E0; E0 reaberta pela régua V2.'
 WHERE lead_id = 'gs_59028' AND event_key = 'e0_gs_59028' AND voided_at IS NULL;

INSERT INTO public.crm_timeline (id, investor_id, event, origin, reason, actor_id, at)
VALUES ('tl_e0_void_gs_59028', 'gs_59028', 'e0_teste_anulado', 'correcao',
        'Teste do E0 legado anulado (histórico preservado). E0 reaberta como primeira ação da régua V2: ligação 1 → 10 min → ligação 2 → mensagem para copiar.',
        'sistema', now())
ON CONFLICT (id) DO NOTHING;
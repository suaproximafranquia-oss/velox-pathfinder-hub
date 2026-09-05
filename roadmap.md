# Roadmap

- [x] Cobrir workspace_e0_actions no backup (capturar + nunca restaurar)
- [x] Modo Demonstração da Ação do Dia (overlay agnóstico + fixture em memória + rota /f/executivo/acao-do-dia-demo)
- [x] Central de Homologação (abas Motor + Ação do Dia Demo) e fotografia temporária das etapas (Word deixa de ser fonte operacional)
- [x] Landing institucional do Grupo Velox na rota / (componentes isolados em src/components/group/landing)
- [ ] FASE 1 — Fundação de identidade canônica (investors + investor_identifiers + vínculos investor_id, aditiva, sem alterar operação)
- [x] Alavanca 1 de homologação — mover `cadence_activation_date` da Financeira para o marco oficial (2026-09-03), medindo a Ação do Dia antes/depois (sem reset destrutivo)
- [ ] Teste controlado pós-corte: 1 lead fictício com responsável definido (Thiago) e E0 Automático — BLOQUEADO: o laboratório atual cria o lote sem responsável (intakeLead sem connectionUserId), o que força E0 Manual

## E0 fora da janela (04/09)
- [x] Card criado antes da trava de janela no intakeLead (responsável + is_test preservados)
- [x] processDeferredFirstContacts reutiliza card, preserva responsável/teste e respeita Automático x Manual
- [x] Corrigir telefone sintético do Laboratório para ser único por `batchId + índice`
- [ ] Segundo lead de teste dentro da janela (a criar manualmente)

## Bloco 1 — Marco operacional + contato real (05/09)
- [x] `operational_since` no ciclo (`relationship_cadences`) e função única `classifyCycle`/`isOperationalCycle` em `src/lib/relationship/cycle.ts`
- [x] Motor deixa de gerar obrigação nova em ciclo histórico (evaluate + scheduleFollowUp)
- [x] Ação do Dia ignora fila de ciclo histórico (`listHistoricalCycleLeadIds`)
- [x] Definição única de CONTATO HUMANO REAL (`human-contact.ts` + `human-contact.server.ts`, somente leitura)
- [ ] Bloco 2 — itens de fila sem ciclo registrado, histórico de titularidade e redistribuição

## Bloco 2 — Identidade canônica + titularidade + redistribuição GreenSales (05/09)
- [x] `executive_profiles.greensales_vendor_id`: responsável vem da ORIGEM (`vendedor_id`), não do dono do cron
- [x] `lead_ownership_history` append-only e idempotente (`change_key`), incluída no backup
- [x] Resolução única de identidade canônica (`src/lib/crm/identity.ts` + `src/server/crm/identity.server.ts`), vínculo sem fusão
- [x] Redistribuição real detectada por responsável origem × responsável do card (`ownership.server.ts`), sem ZERO CONTATO como bloqueador
- [x] Nova entrada operacional por titularidade (`workspace_e0_actions.ownership_seq` + `cycleKey` da E0), decidida pelo NOVO responsável
- [ ] PENDENTE DE CADASTRO: mapear `greensales_vendor_id` de cada executivo — sem isso a redistribuição não é reconhecida
- [ ] Bloco 3 — itens de fila sem ciclo registrado, card principal entre múltiplos cards da mesma identidade

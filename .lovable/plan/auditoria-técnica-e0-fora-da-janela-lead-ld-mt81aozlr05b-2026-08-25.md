# Auditoria técnica — E0 fora da janela (lead ld_mt81aozlr05b)

**Natureza:** relatório de rastreabilidade. Nenhuma alteração de código, regra, calendário, fila ou log. Este documento apenas registra as conclusões verificadas.

## Veredito

O cenário do teste está coberto por um registro explícito e auditável: o adiamento da E0 fora da janela **é gravado** e **é retomado automaticamente** na próxima abertura. O comportamento observado (sem envio às 23:16 BRT) é exatamente o comportamento implementado.

## Fluxo verificado (com evidências do banco)

Lead: Peterson — `ld_mt81aozlr05b` — Link personalizado · Velox Financeira — criado 2026-08-25 02:16:45 UTC (23:16:45 BRT).

1. **Reconhecimento** — upsert em `portal_leads` via `src/lib/portal-leads.functions.ts` (escopo `green_sales`, dono `usr_thiago`). Mesmo instante: `crm_timeline` evento `atividade_portal`.
2. **Avaliação E0** — no mesmo request, `kickoffPortalFirstContact` (`src/server/crm/portal-first-contact.server.ts`) avalia `isE0NightWindow()` (`src/lib/crm/e0-window.ts`, §16). Às 23:17 BRT: `true`.
3. **Registro do bloqueio** — tabela `portal_journey_events`, evento `e0_adiada`, gravado 02:17:16 UTC com o detalhe oficial de adiamento e a previsão "Retomada automática em 25/08 às 07:00". `registerFirstContact` não foi executado.
4. **Estado atual (consultado)** — `crm_messages`: 0 · `crm_leads`: 0 (lead nasceu no Portal) · `relationship_cadences / queue / events / decisions`: 0 (handoff ao motor só ocorre após a E0) · timeline: apenas `atividade_portal`.
5. **Retomada** — `processDeferredFirstContacts` (`src/server/crm/first-contact-queue.server.ts`) roda no `finally` de cada ciclo de `runScheduledLeadSync` (cron a cada minuto, intervalo configurável). Fora da janela retorna sem fazer nada; na abertura (25/08 07:00) varre `portal_journey_events.e0_adiada` dos últimos 3 dias, exclui quem já tem `msg_e0_` e reexecuta o kickoff com `entryOrigin: "PORTAL"` (abertura E0_V1 no motor).

## Tabela de decisões de estado

| Estado | Marcador | Onde |
|---|---|---|
| Ainda não processado | nenhum | transitório no request de criação |
| Avaliado e bloqueado pela janela | evento `e0_adiada` | `portal_journey_events` (Portal) / `crm_lead_events` (GreenSales) |
| Enfileirado | o próprio `e0_adiada` (não há tabela de fila separada) | idem |
| Enviado | `msg_e0_<leadId>` + evento `primeiro_contato` | `crm_messages` + `crm_timeline` |

## Ações

Nenhuma. Documento de auditoria apenas — próximo passo é o teste dentro da janela operacional, quando o lead deve aparecer com `msg_e0_ld_mt81aozlr05b` (simulada, sem chamada à Meta) e o evento `primeiro_contato` na timeline.

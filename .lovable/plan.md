# Auditoria somente leitura — lote TEST-20260904-A (Financeira /f)

Nenhuma alteração foi feita: apenas consultas de leitura ao banco e leitura de código.

## A) Estado do lead

- `crm_leads.id` = `f99b30ef-1b55-4667-8649-e2e80a9d0734`
- `external_id` = `TEST-20260904-A-01`
- `name` = `[TESTE] Ana Teste 01`, `phone` = `+5500900000000`
- `is_test = true`, `test_batch_id = TEST-20260904-A`
- `stage_key = novos`, `entered_entry_stage_at = 2026-09-04 01:57:27Z`
- `canonical_investor_id = null`, `environment = null`
- Lote: `test_batches.TEST-20260904-A`, cenário `sem_acao_humana`, 1 lead, status ATIVO, criado por thiago.rodrigues.

**`portal_leads`: não existe registro.** Nenhum card operacional foi criado para este lead
(consulta por `test_batch_id` e por nome retornou vazio).

## B) E0: executada ou não

**Não executada.** Não há `workspace_e0_actions` para este lead, não há `msg_e0_*`
correspondente em `crm_messages` (as últimas mensagens são `msg_e0_gs_58994`,
`msg_e0_gs_58992`, `msg_e0_gs_58983`, todas de leads reais GreenSales).

## C) Motivo exato

Evento registrado em `crm_lead_events`:

```text
lead_criado  01:57:28Z  Lead recebido da origem externa (stage: novos)
e0_adiada    01:57:29Z  E0 adiada — fora da janela operacional (§16: Seg–Sex 07:00–22:30,
                        Sáb 07:00–12:00, Dom sem envio). Retomada automática em 04/09 às 07:00.
```

O lote foi criado às `01:57 UTC` = **22:57 de Brasília**, ou seja 27 minutos após o
fechamento da janela (22:30). Em `intakeLead`, a checagem `isE0NightWindow()` ocorre
**antes** da criação do card e antes de resolver o modo E0 — por isso o fluxo retornou
`e0 = "adiada"` imediatamente e nada mais foi criado.

Respondendo às três hipóteses:

- Deveria ter acontecido imediatamente pelo `intakeLead`? Não — a trava de janela §16 é anterior.
- Está aguardando tick/cron? Sim — a retomada é feita por `processDeferredFirstContacts()`,
  chamada pelo agendador de sincronização (`sync-scheduler.server.ts`) e por `lead-sync.server.ts`,
  a partir das 07:00.
- O cenário `sem_acao_humana` impede a execução automática? Não. O cenário só descreve
  a ausência de resposta humana posterior; não bloqueia a E0.

## D) Biblioteca / mensagem

Nenhuma mensagem foi gerada, portanto a Biblioteca oficial não foi acionada. O caminho
oficial (`registerFirstContact` → `e0.server` → template/Biblioteca) não chegou a ser chamado.

## E) Cadência

`relationship_cadences`: nenhum registro para este lead (as duas cadências recentes são
`gs_58994` e `gs_58992`, leads reais). `relationship_queue`: nenhum item para este lead.
Coerente — a cadência só nasce após a E0 (`FIRST_CONTACT_SENT`).

## F) Próxima ação

Retomada automática da E0 pela fila de adiamento na abertura da janela (04/09, 07:00 BRT),
condicionada à execução do agendador de sincronização.

## G) Divergência entre tela e estado real

`Mensagens = 0` corresponde ao estado real — não é atraso de consulta.
`Próxima ação: —` também é real (não existe fila).
O único ponto de leitura otimista é `Responsável: Thiago Rodrigues`: a tela mostra o
responsável **escolhido no lote**, mas ele não está persistido em nenhum card
(`portal_leads` inexistente); em `crm_leads` não há coluna de responsável. Ou seja, o
responsável hoje existe apenas como parâmetro de entrada, não como estado.

## H) Conclusão e risco observado (sem correção)

O teste parou corretamente na trava de janela operacional — comportamento esperado e não
um defeito. Contudo, o caminho de retomada tem duas lacunas relevantes para este teste:

1. `processDeferredFirstContacts()` chama `ensureWorkspaceCard` **sem**
   `responsibleExecutiveId`/`responsibleExecutiveSlug` — o card nascerá sem responsável e o
   modo E0 tende a resolver como **manual**, anulando o objetivo de testar o E0 automático
   do Thiago.
2. A mesma chamada não repassa `isTest`/`testBatchId` — o card retomado nasceria **sem
   marcação de teste**, misturando-se à carteira operacional.

Recomendação (a decidir pelo usuário, nada implementado): não deixar a retomada automática
das 07:00 acontecer para este lote antes de decidir entre (a) ajustar a retomada para
preservar responsável e marcação de teste, ou (b) descartar o lote e refazer o teste dentro
da janela operacional.

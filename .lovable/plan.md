# Teste controlado — 1 lead fictício na Financeira /f (auditoria, sem implementação)

## A) Caminho recomendado para criar o lead de teste

Já existe uma ferramenta oficial de homologação que entra pelo fluxo real:
**Ambiente de Teste em Tempo Real da Cadência** — rota `/f/executivo/teste-cadencia`
(somente Administrador do CRM).

Procedimento existente: selecionar **1 cenário** (recomendado `sem_acao_humana`),
`perScenario = 1`, criar o lote. Isso gera um lote `TEST-AAAAMMDD-A` e chama
`createTestBatch` → `intakeLead(...)` — exatamente a mesma função que a
sincronização GreenSales usa para cada lead real. Não há trilha paralela, não há
INSERT artificial, não há segundo motor.

Não é necessário tocar no Portal de Leads real, na GreenSales, nem rodar sync.

## B) Por que é o caminho mais seguro

- Entra pelo `intakeLead` real: espelho `crm_leads` → card `portal_leads` →
  responsável → E0 → motor → Ação do Dia.
- Marcação **técnica** (`is_test = true` + `test_batch_id`), nunca heurística por
  nome/telefone; nenhum lead real pode receber essa marcação.
- Telefone sintético `5500…` (não roteável) e e-mail `@teste.velox.local`.
- O despachante força modo simulado para todo lead marcado, mesmo com credencial
  real presente — além da Safety Lock.
- Limpeza por lote (`purgeTestBatch`) age exclusivamente sobre os registros
  daquele lote.

## C) Identificadores e tabelas envolvidos

```text
external_id   TEST-20260904-A-01        (crm_leads.external_id, external_source=greensales)
card_id       gs_TEST-20260904-A-01     (portal_leads.id = "gs_" + external_id)
crm_leads.id  uuid                      (espelho da origem)
```

| Camada | Tabela | Chave |
| --- | --- | --- |
| Espelho de origem | `crm_leads` | `external_id`, `is_test`, `test_batch_id` |
| Card/oportunidade | `portal_leads` | `id = gs_<external_id>` |
| Responsável | `portal_leads.responsible_executive_id` | resolvido no servidor |
| E0 manual | `workspace_e0_actions` | `card_id` UNIQUE |
| Mensagem E0 | `crm_messages` | `id = msg_e0_<cardId>`, `investor_id = cardId` |
| Cadência | `relationship_cadences` | `lead_id = cardId`, `scope = production` |
| Próxima etapa | `relationship_queue` | `lead_id = cardId`, `status = PENDING` |
| Histórico | `crm_lead_events`, `crm_timeline`, `relationship_decisions`, `relationship_engine_log` | |
| Lote | `test_batches` | `id = TEST-…` |

Identidade Fase 1 (`investors` / `investor_identifiers` / `canonical_investor_id`):
o `intakeLead` **não** grava nessas tabelas hoje — elas foram criadas de forma
aditiva e são preenchidas só por backfill. Portanto, no teste, o item "identidade"
será verificado como **ausente por desenho** (o vínculo canônico é trabalho da
próxima fase), e não como falha.

## D) Como garantir E0 MANUAL sem alterar configuração de ninguém

Nenhuma alteração é necessária. O modo é resolvido por lead em
`resolveExecutiveE0Mode(responsável)`:

- `createTestBatch` chama `intakeLead` **sem** `connectionUserId`;
- logo `resolveResponsibleByUserId(null)` retorna `null`;
- sem responsável resolvido o modo é **manual, sempre** ("nunca há execução
  automática às cegas").

Consequência: o card nasce **sem responsável**, e a E0 pendente aparece na Ação do
Dia de qualquer executivo (a lista só filtra quando há responsável definido). Se
quiserem responsável nomeado no teste, isso exige atribuição pela tela do card
depois da entrada — decisão a tomar antes de começar; não altera o modo manual.

## E) Como validar a E0

1. `workspace_e0_actions` → 1 linha, `card_id = gs_…`, `state = PENDENTE`.
2. `crm_lead_events` → `e0_identificada`, `workspace_card_criado`, `e0_manual_pendente`.
3. Abrir a **Ação do Dia** em `/f` — a E0 pendente tem prioridade máxima.
4. Executar pela própria Ação do Dia (`executeE0Action` → `registerFirstContact`):
   - `workspace_e0_actions.state = EXECUTADA`, `result = EXECUTADA_SIMULADA`,
     `executed_by`/`executed_at` preenchidos;
   - `crm_messages` com `id = msg_e0_<cardId>` (texto vindo da Biblioteca oficial,
     assinatura do executivo);
   - `relationship_cadences` sai de não iniciada para ativa em E0.

## F) Como validar a primeira etapa da cadência

Regra vigente: enquanto o lead estiver na coluna **NOVOS**, o motor recusa criar
qualquer etapa após a E0 ("Lead ainda em NOVOS — aguardando a primeira ação
humana"). A E1 só é calculada a partir da **saída de NOVOS** (`leftEntryStageAt`),
não do cadastro nem da E0.

Portanto: executar a E0 → depois registrar a primeira ação humana (mover o card de
NOVOS; no laboratório existe a ação "Sair de NOVOS") → então nasce **uma** linha
`PENDING` em `relationship_queue`.

## G) Como testar o atraso sem gerar dívida artificial

`nextStep()` devolve apenas a primeira etapa não executada do fluxo, e o motor
recusa etapa fora de ordem. Logo, uma E1 pendente e vencida **continua E1**; o
tempo sozinho não cria E2/E3/E4.

Para observar isso sem esperar dias, sem tocar na regra e sem segunda fila:
deixar a E1 pendente e reexecutar o **tick do motor real** várias vezes,
verificando que `relationship_queue` continua com exatamente 1 linha `PENDING` em
E1 e que `relationship_decisions` registra sempre a mesma decisão.

Ponto de atenção operacional: hoje `runRelationshipTick()` só é chamado dentro de
`runScheduledLeadSync` (endpoint público de sync), ou seja, **acionar o tick hoje
significa acionar a sincronização GreenSales**. Como vocês pediram para não rodar
sync, a alternativa é aceitar o tick natural do cron ou, em passo futuro e
separado, um gatilho de tick isolado — nada disso será feito nesta etapa.

O relógio virtual (fator 12) pertence ao escopo `homologation` do simulador e
**não** deve ser usado aqui: este teste roda em `scope = production` com relógio
real, por escolha explícita.

## H) Executar a primeira etapa e validar a próxima

Executar a E1 pela Ação do Dia (registro de execução) e conferir:
- a linha E1 sai de `PENDING`;
- `relationship_cadences.executed_steps` passa a conter E1;
- nasce **exatamente uma** nova linha `PENDING` (E3 no fluxo `sem_resposta`);
- `relationship_decisions` explica cada transição.

## I) Riscos

| Risco | Situação |
| --- | --- |
| Duas E0 | Protegido: `workspace_e0_actions.card_id` UNIQUE + trava `msg_e0_<cardId>`. |
| Duas próximas etapas | Protegido: `nextStep` retorna uma etapa e ordem é validada. |
| Reabrir E0 histórica | Baixo: o corte de 2026-09-03 torna leads antigos inelegíveis; a E0 é por card e já executada. |
| Ações para outros leads | O tick avalia todos os leads elegíveis — não é isolado ao lote. Por isso rodar o tick é decisão consciente. |
| Misturar com dados reais | Baixo: marcação técnica e limpeza por lote; o card aparece no board com "[TESTE]" no nome. |
| Outro ambiente | Nenhum: `/s` e `/seg` não compartilham este fluxo. |
| Envio real de WhatsApp | Impossível: modo simulado forçado para lead de teste **e** Safety Lock. |

## J) Procedimento exato do próximo passo

1. Entrar como Administrador em `/f/executivo/teste-cadencia`.
2. Cenário `sem_acao_humana`, 1 lead, nota "primeiro teste controlado pós-corte".
3. Criar o lote e anotar `batchId`, `external_id`, `cardId`.
4. Conferir (somente leitura): `crm_leads`, `portal_leads`, `workspace_e0_actions`.
5. Abrir a Ação do Dia em `/f` e confirmar a E0 pendente.
6. Executar a E0 e conferir `crm_messages`, `workspace_e0_actions`, `relationship_cadences`.
7. Registrar a primeira ação humana (sair de NOVOS) e conferir a única E1 `PENDING`.
8. Deixar a E1 pendente e observar que continua E1 a cada tick.
9. Executar a E1 e conferir o nascimento de exatamente uma próxima etapa.
10. Ao final, limpar apenas o lote (`purgeTestBatch`).

## Confirmações pedidas

- **Safety Lock**: intacta; bloqueio incondicional até 2029 **e** exigência de
  `WHATSAPP_REAL_SEND_ENABLED=true` depois disso. Lead de teste nunca chega lá.
- **Corte 2026-09-03**: o lead nasce hoje, logo é elegível — tratado como NOVA
  OPERAÇÃO, nunca como legado.
- **TikTok/Meta**: fora deste teste; o caminho exercitado é GreenSales → Workspace.

## Decisões que precisamos de vocês antes de executar

1. O card pode nascer **sem responsável** (comportamento atual do laboratório) ou
   querem atribuir um executivo manualmente após a entrada?
2. Aceitam que o avanço do tempo seja observado pelo tick natural do cron
   (que também executa a sincronização), ou preferem apenas observar sem tick
   nesta primeira rodada?

# Auditoria (somente leitura) — Ação do Dia × Cadência × transição E0 → E1 (/f)

Nada foi alterado: sem código, sem banco, sem migration, sem configuração, sem execução de tick/sync.

## 1. E0

1. **Onde a E0 executada é registrada**: `crm_messages` com id fixo `msg_e0_<cardId>` (trava de idempotência), snapshot em `relationship_message_sends`, evento em `crm_lead_events` (`e0_enviada` / `e0_simulada` / `e0_manual_executada`), cadência em `relationship_cadences` (`executed_steps=["E0"]`, `state=CADENCE_ACTIVE`) e, no modo manual, `workspace_e0_actions.state='EXECUTADA'`.
2. **Como a Ação do Dia decide mostrar E0**: `buildDailyActions` (`src/server/crm/daily-actions.server.ts`) chama `listPendingE0Actions()` (`src/server/crm/e0-actions.server.ts`), que lê **apenas** `workspace_e0_actions` com `state='PENDENTE'`. É a única fonte do card "Primeiro contato com lead novo".
3. **Por que uma E0 automática já executada continua aparecendo** — causa confirmada em dados reais: a retomada da E0 adiada roda mais de uma vez. Em `gs_TEST-20260904-A-01` e `gs_58997`, às 10:04 UTC a retomada resolveu **manual** (card ainda sem responsável) e criou `workspace_e0_actions` PENDENTE; às 12:11 UTC a mesma retomada resolveu **automático** (card já com `usr_thiago`) e executou `registerFirstContact` — E0 enviada, cadência ativa, mas **ninguém fecha a linha PENDENTE**. `registerFirstContact` não conhece `workspace_e0_actions`; só `executeE0Action` marca EXECUTADA. Resultado: E0 concluída + ação humana órfã na Ação do Dia (e sem responsável, portanto visível para todos os executivos).
4. **Consulta que olha só PENDENTE**: sim — `listPendingE0Actions`, `.eq("state","PENDENTE")`, sem qualquer verificação de `msg_e0_<cardId>` ou de cadência.
5. **Condição exata que deveria excluir a E0**: existir prova de execução para o card — `crm_messages.id = 'msg_e0_' || card_id` (ou `relationship_cadences.executed_steps` contendo E0 para aquele `lead_id`). Havendo prova, a ação não é ação humana.
6. **Pode ser resolvido só na Ação do Dia?** Sim: filtrar em `listPendingE0Actions`/`buildDailyActions` resolve a exibição sem tocar no motor E0. A correção estrutural (fechar a linha PENDENTE quando a E0 sai por outro caminho) é opcional e independente.

## 2. Estado NOVOS

7. **Onde vive**: `crm_leads.stage_key='novos'` (+ `stage_entered_at`, `entered_entry_stage_at`) para leads GreenSales; para leads nascidos no Portal/TikTok/Meta o equivalente é `portal_leads.relationship_started_at` nulo (`commercial_state`).
8. **Evento que representa a saída**: leitura única em `src/server/relationship/lead-context.server.ts` — `awaitingFirstHumanAction = (stage_key === 'novos')`; `leftEntryStageAt = stage_entered_at` da etapa atual. No caminho Portal, `leftEntryStageAt = relationship_started_at`.
9/10. **Caminhos reais de saída**: (a) mudança de `stage_key` no CRM/Workspace (arrastar card ou `set_lead_operational`); (b) sincronização com a origem trazendo outra etapa; (c) para leads Portal, "Iniciar Relacionamento" no CRM ou "Solicitar Atendimento" pelo investidor, que gravam `relationship_started_at`.
11. **Diferenças**: abrir o card **não** é atividade (regra vigente) e não muda nada; ligar / registrar tentativa (`crm_cadence_tasks`, `crm_lead_events`) registra histórico mas **não** tira de NOVOS; copiar/enviar mensagem também não; **só** a mudança de `stage_key` (ou `relationship_started_at`) tira de NOVOS.
12. **Primeiro contato humano verdadeiro hoje**: a transição de etapa registrada em `stage_entered_at` (GreenSales) / `relationship_started_at` (Portal). É isso que o motor lê.
13. **Auditoria**: sim — `crm_lead_events`, `crm_timeline`, `relationship_engine_log` e os próprios campos de timestamp.

## 3. Início da contagem da E1

14/15. `src/lib/relationship/decide.ts` → `referenceMoment()`: referência = **o maior** entre `lastOutboundAt ?? startedAt` (a E0) e `leftEntryStageAt`. O vencimento sai de `dueMomentAfterBusinessDays(referência, 1 dia útil, config)` (E1 = `businessDaysAfterReference: 1`).
16/17. **Existe contagem antes de sair de NOVOS?** Não pela decisão: `awaitingFirstHumanAction` bloqueia toda etapa que não seja E0/E0_V1 ("Lead ainda em NOVOS…"). Risco residual: quando `loadLeadStageContext` devolve `null` (lead sem espelho em `crm_leads` **e** sem `portal_leads`), o portão fica desligado e a E1 conta só a partir da E0.
18/19. **Sim, o comportamento desejado já é o do motor atual** e pode ser reforçado sem criar segundo relógio: o único relógio é `decide.ts` + `calendar.ts`, alimentado por `lead-context.server.ts`.

## 4. Cadência configurada (`src/lib/relationship/config.ts`, fluxo `sem_resposta`)

| Código | Label (`step-labels.ts`) | Delay | Unidade | Referência | Condição | Agendamento |
|---|---|---|---|---|---|---|
| E0 | E0 — Primeiro contato | 0 | dias úteis | entrada do lead | entrada + janela operacional | `crm_messages msg_e0_*` / `workspace_e0_actions` |
| E1 | E1 — Primeiro acompanhamento | 1 | dias úteis | max(E0, saída de NOVOS) | fora de NOVOS + etapa elegível no fechamento | `relationship_queue` (PENDING) |
| E3 | E3 — Segundo acompanhamento | 2 | dias úteis | mesma referência | E1 executada | `relationship_queue` |
| E4 | E4 — Acompanhamento mais firme | 3 | dias úteis | mesma referência | E3 executada | `relationship_queue` |
| E12 | E12 — Encerramento sem resposta | 5 | dias úteis | mesma referência | E4 executada; terminal (E30 desligada) | `relationship_queue` |

22. **Sim**, E1 é a primeira etapa após E0 no fluxo `sem_resposta` (E0 → E1 → E3 → E4 → E12).
23. **Condições que alteram/pulam E1**: resposta do investidor (vai para reengajamento/`RESPONDED`), duas visualizações (fluxo `visualizacao`), reentrada (RE0…), etapa terminal OPORTUNIDADE no fechamento, arquivamento, motor desligado, ausência de template oficial com janela de 24h fechada, e reprogramação automática quando o vencimento cai fora do dia útil/horário.

## 5. Ação do Dia

24/25. `src/server/crm/daily-actions.server.ts` → `buildDailyActions`, normalizado por `src/lib/crm/daily-actions.ts`. Fontes: E0 pendente, reuniões, agenda, fechamento (E27/Finalização), `relationship_queue` PENDING com `due_at <= hoje` e fila de ligações recalculada (`buildCadenceQueue`).
26. **Como sabe que concluiu**: pelo estado da fonte — item sai de PENDING na fila, `workspace_e0_actions` vira EXECUTADA, reunião muda de status, `crm_cadence_tasks` DONE — **não** por marcação própria.
27. **Duplicação**: `actionKey` determinístico por fonte + `normalizeDailyActions` + supressão diária de puladas (`listSkippedActionKeys`).
28. **Etapa ainda não vencida**: fica em `relationship_queue` com `status='PENDING'` e `due_at` futuro (filtro `if (dueDate > today) continue`).
29. **O que faz aparecer**: nenhuma escrita nova — basta `due_at` alcançar o dia operacional corrente.
30. **Sim**: "etapa existente" = linha PENDING na fila; "ação liberada" = essa linha com `due_at` até hoje e não suprimida.

## 6. Dependência e rótulos

31/32. Confere com o motor atual: com E0 concluída e o lead fora de NOVOS, a E1 é agendada; enquanto `due_at` for futuro ela não aparece.
33/34. Hoje o card de fila mostra `title: "Mensagem E1"` e `stepLabel` bruto (`E1`), e o painel exibe "Ver mensagem completa". Para ler "Etapa 1 — Copiar mensagem" a alteração é de apresentação, em dois pontos: título/rótulo em `buildDailyActions` (bloco `for (const item of queue)`, usando `stepDisplayLabel`) e os textos do botão em `src/components/crm/daily-actions-overlay.tsx`. Nenhum impacto no motor.

## 7. Comportamento esperado por cenário

- **A — E0 automática executada, lead ainda NOVO**: hoje aparece indevidamente a ação de E0 se existir linha PENDENTE órfã (caso observado). Correto: nada aparece; contagem da E1 não começou; próxima ação é humana (tirar de NOVOS).
- **B — E0 automática executada, lead saiu de NOVOS**: E0 não deve aparecer; a contagem inicia em `stage_entered_at`; E1 entra na fila e aparece quando vencer.
- **C — E0 manual pendente**: aparece como "Primeiro contato com lead novo", prioridade máxima; sem contagem de E1; próxima ação é executar a E0.
- **D — E0 manual executada + saiu de NOVOS**: E0 desaparece (state EXECUTADA); contagem da E1 a partir do maior entre E0 e a saída de NOVOS; E1 aparece no vencimento.

## 8. Conclusão

- **A) Causa**: linha `workspace_e0_actions` em PENDENTE criada pela retomada em modo manual e nunca fechada quando a mesma retomada, no ciclo seguinte, executou a E0 automaticamente (`registerFirstContact` não fecha a ação). Comprovado em `gs_TEST-20260904-A-01` e `gs_58997` (pendente 10:04 → `msg_e0_*` 12:11).
- **B) Relógio da E1**: `decide.ts::referenceMoment` = max(E0/`lastOutboundAt`, `leftEntryStageAt`), + 1 dia útil, ajustado pelo calendário operacional.
- **C) "Saiu de NOVOS"**: `crm_leads.stage_key` deixar de ser `novos` (timestamp `stage_entered_at`); para leads do Portal, `portal_leads.relationship_started_at`.
- **D) Menor alteração**: filtrar, na leitura, as ações de E0 cujo card já tenha `msg_e0_<cardId>` (ou E0 nos `executed_steps`) — camada da Ação do Dia apenas.
- **E) Arquivos**: `src/server/crm/e0-actions.server.ts` (ou `src/server/crm/daily-actions.server.ts`) para o filtro; opcionalmente `daily-actions.server.ts` + `daily-actions-overlay.tsx` para os rótulos da E1.
- **F)** Sim, o motor E0 permanece intocado (`first-contact.server.ts`, `first-contact-queue.server.ts`, `lead-intake.server.ts`, `engine`/`decide`).
- **G) Riscos**: nenhum sobre CRM, GreenSales, cadência ou Safety Lock (leitura pura, sem envio). Risco único: um filtro largo demais poderia esconder uma E0 manual legítima — por isso a prova deve ser por card (`msg_e0_<cardId>`), nunca por lead ou por nome.

Nenhuma implementação foi feita.

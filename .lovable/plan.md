# AUDITORIA DA E0 — POR QUE O COMPORTAMENTO PARECE ALEATÓRIO

Investigação somente de leitura. Nada foi alterado: sem código, sem migration, sem cron, sem envio, sem tocar a Global WhatsApp Safety Lock.

**Resposta curta, comprovada nos dados:** a E0 não é aleatória. Ela tem **uma única tentativa** no momento da entrada do lead. Quando essa tentativa falha por falta de executivo responsável (o card nasce sem responsável), **nunca mais é repetida** — a não ser que o lead tenha nascido de madrugada, porque só o caminho do adiamento noturno tem repetição. Leads da madrugada acabam recebendo E0; leads do horário comercial ficam sem, indefinidamente.

---

## 1. NASCIMENTO DA E0

Ordem real:

1. `runLeadSync` (`src/server/crm/lead-sync.server.ts`) varre a origem e classifica cada lead em A/B/C/D (`classifyScannedLead`, `src/lib/crm/sync-classification.ts`).
2. Casos A e C vão para `intakeLead` (`src/server/crm/lead-intake.server.ts`). É **aqui, e somente aqui**, que o sistema decide "este lead precisa de E0", através da variável `enteredNow` (linha ~140): lead criado agora na coluna de entrada, ou lead que acabou de entrar em NOVOS.
3. Se `enteredNow && eligibility.eligible` (`cadenceEligibility`, `src/lib/crm/cutover.ts`): grava `e0_identificada`, cria o card (`ensureWorkspaceCard`) e chama `registerFirstContact` (`src/server/crm/first-contact.server.ts`) → `dispatchFirstContact` (`src/server/relationship/e0.server.ts`).

Respostas objetivas:

- **Existe uma linha individual "E0 deste lead"?** NÃO. Não há tabela de ações/fila de E0. O que existe é: eventos em `crm_lead_events` (`e0_identificada`, `e0_adiada`, `e0_ignorada`, `e0_simulada`, `e0_enviada`) e, quando a E0 realmente ocorre, a mensagem `crm_messages.id = msg_e0_<cardId>`.
- **A pendência é inferida?** SIM, e apenas em um caso: a fila do adiamento noturno infere pela **presença do evento `e0_adiada` e ausência de `e0_simulada`/`boas_vindas_enviada`** (`processDeferredFirstContacts`). Fora disso não existe pendência registrada em lugar nenhum.
- **Campo identificador:** `crm_leads.external_id` no espelho; `portal_leads.id = gs_<external_id>` no card operacional (a E0 usa sempre o card).
- **Chave anti-duplicidade:** a chave primária determinística `msg_e0_<cardId>` em `crm_messages` — o INSERT conflita (23505) na segunda tentativa e devolve "primeiro contato já registrado" (`e0.server.ts`, linhas ~132-147).
- **Existe `due_at`/`scheduled_at`/`next_run_at` da E0?** NÃO. Não existe horário de vencimento individual. A E0 é síncrona à sincronização.

---

## 2. CAMINHO COMPLETO DA E0 (o que existe hoje)

```text
pg_cron 'portal-crm-sync-automatico' (a cada minuto)
  → POST /api/public/crm/sync            (src/routes/api/public/crm/sync.ts)
  → isAutomationRequestAuthorized        (automation-auth.server.ts)
  → runScheduledLeadSync                 (sync-scheduler.server.ts)
      ├─ trava: última crm_sync_runs RUNNING < 15 min → NÃO RODA
      ├─ trava: intervalo configurado não vencido      → NÃO RODA
      ├─ runLeadSync("cron")             (lead-sync.server.ts)
      │    ├─ greenSalesLogin / fetchLeadsSince (janela = último finished_at OK − 15 min)
      │    ├─ classifyScannedLead → A | B | C | D
      │    ├─ (B) upsertLead({historical:true}) → SEM E0, definitivo
      │    └─ (A/C) intakeLead
      │           ├─ upsertLead → espelho crm_leads
      │           ├─ dedup por telefone → encerra
      │           ├─ cadenceEligibility (corte 01/09) → e0_ignorada
      │           ├─ isE0NightWindow() → deferFirstContact → evento e0_adiada, FIM
      │           └─ enteredNow && elegível:
      │                 recordEvent e0_identificada
      │                 ensureWorkspaceCard (card nasce com responsible_executive_id = NULL)
      │                 registerFirstContact
      │                    → cadenceEligibility de novo + isE0NightWindow de novo
      │                    → dispatchFirstContact
      │                         resolveLeadDestinations (exige link do Portal → exige executivo)
      │                         renderFromLibrary (texto oficial)
      │                         INSERT crm_messages id=msg_e0_<card>  ← idempotência
      │                         entrega (simulada ou Meta) → recordMessageSnapshot → crm_timeline
      │                    → engine.handleEvent FIRST_CONTACT_SENT
      │                 recordEvent e0_enviada | e0_simulada | e0_ignorada
      │    └─ processDeferredFirstContacts (fim do runLeadSync)
      ├─ processDeferredFirstContacts    (de novo, no finally do agendador)
      ├─ runRelationshipTick             (scheduler.server.ts)
      └─ runDailyReconciliation
```

Observação factual: `processDeferredFirstContacts` é chamada **duas vezes por ciclo** (uma no fim de `runLeadSync`, outra no `finally` de `runScheduledLeadSync`). Isso está visível nos dados: o lead 58827 registra dois `e0_ignorada` por ciclo, com ~3 segundos de diferença.

---

## 3. CRONS E JOBS

Agendamentos ativos no banco (`cron.job`):

| Job | Frequência | Chama |
|---|---|---|
| `portal-crm-sync-automatico` | `* * * * *` | `/api/public/crm/sync` → `runScheduledLeadSync` |
| `remarketing-engine` | `* * * * *` | `/api/public/remarketing/run` |
| `portal-backup-automatico` | `0 * * * *` | insere pedido de backup |
| `portal-backup-processador` | `* * * * *` | `/api/public/backup/process` |

Só o primeiro toca a E0. Detalhamento dele:

- **Lote/limite:** a varredura não tem limite de leads; existe `DETAIL_CHECK_LIMIT = 80` para reconsulta de detalhe. A fila de adiadas tem `.limit(200)` (GreenSales) + `.limit(200)` (Portal).
- **Ordem de processamento:** a ordem de chegada da paginação da origem. **Não há `order by`** em nenhum ponto do caminho da E0.
- **Anti-concorrência:** apenas a leitura da última linha de `crm_sync_runs`; se `status = RUNNING` e idade < `STALE_RUN_MINUTES` (15), o ciclo é abortado.
- **Execução anterior travada em RUNNING:** bloqueia todos os ciclos pelos 15 minutos seguintes. **Isto está acontecendo em produção:** nos últimos 3 dias há 88 execuções `RUNNING` sem `finished_at` contra 521 `OK` — aproximadamente uma trava a cada 40 minutos, cada uma congelando a sincronização por 15 minutos.
- **Falha:** `runLeadSync` marca `ERRO` e a janela seguinte volta ao último `finished_at` com status OK — a janela temporal não se perde. Mas se o processo morrer no meio (o caso dos RUNNING), a linha fica RUNNING para sempre e o `finally` que chama a fila de adiadas pode não executar.
- **Retry:** não há retry por lead. Só existe repetição implícita para quem tem `e0_adiada`.
- **Timeout:** nenhum controlado pela aplicação.
- **Duas execuções simultâneas:** possível em teoria (a trava é leia-depois-escreva, sem lock transacional), mas improvável, porque a janela de 15 min é generosa.
- **Um job bloqueia outro?** Sim, dentro do mesmo ciclo: `runRelationshipTick` só roda depois de `runLeadSync`. Uma queda em `runLeadSync` que não chegue ao `finally` cancela a fila de adiadas e o tick daquele minuto.

**Cenário em que "o cron funciona mas leads ficam para trás": CONFIRMADO.** O cron continua registrando execuções OK, e ainda assim um lead cuja única tentativa de E0 falhou nunca é reavaliado — porque nada no ciclo reexamina leads sem E0.

---

## 4. E0 ADIADA

`deferFirstContact` (`first-contact-queue.server.ts`, linha 19) grava apenas um evento `e0_adiada` em `crm_lead_events` quando `isE0NightWindow()` é verdadeiro na entrada (fora de Seg–Sex 07:00–22:30, Sáb 07:00–12:00, Dom sem envio).

`processDeferredFirstContacts`:

- **Quem lê:** `runLeadSync` (fim) e `runScheduledLeadSync` (finally).
- **Período pesquisado:** `created_at >= agora − 3 dias`.
- **LIMIT:** 200 eventos (GreenSales) e 200 eventos (Portal).
- **Ordenação:** **nenhuma**. Não há `order by`; o Postgres devolve na ordem que quiser, e o `limit 200` recorta esse conjunto arbitrário.
- **É FIFO?** NÃO.
- **Prioridade por idade do lead?** NÃO. **Por `due_at`?** NÃO — não existe `due_at`.
- **Lead antigo pode ficar atrás de novos?** SIM, e pode inclusive cair fora do `limit 200`; e ao passar de 3 dias sai da janela e é abandonado silenciosamente.
- **Erro em um item interrompe os seguintes?** NÃO — cada item está em `try/catch` individual.
- **Sequencial ou paralelo?** Sequencial (`for ... await`).
- **Lock por lead?** NÃO. **Lock por lote?** NÃO. A única proteção real contra duplicidade é a chave `msg_e0_<card>`.

Ponto importante e comprovado: **esta é a única repetição de E0 que existe no sistema.** Ela reexecuta `registerFirstContact` a cada ciclo enquanto o lead não tiver `e0_simulada`/`boas_vindas_enviada`, o que dá ao lead da madrugada dezenas de chances ao longo do dia.

---

## 5. RELATIONSHIP TICK

`runRelationshipTick` (`src/server/relationship/scheduler.server.ts`):

- **Participa da E0?** Só depois dela. Ele **não cria nem envia E0**.
- **Como identifica E0 faltando:** `bootstrapMissingCadences` busca `crm_messages` com `id like 'msg_e0_%'` e, para quem já tem essa mensagem mas não tem cadência aberta, emite `FIRST_CONTACT_SENT` no motor. É recuperação de **cadência**, não de mensagem.
- **Depende de `msg_e0_%`?** SIM, integralmente. Lead que nunca teve E0 enviada é invisível para ele.
- **Pode competir com outro processo criando a mesma E0?** Não cria E0; o evento usa a mesma chave `e0_<lead>`, portanto é idempotente.
- **Lote:** `BATCH = 200` em cada uma das três consultas de elegibilidade.
- **Ordenação:** só a busca de primeiros contatos usa `order by at desc` — ou seja, **prioriza os mais recentes**; as outras duas não têm ordenação.
- **Pode favorecer leads novos / deixar antigos para trás?** SIM, pelo `order by at desc` + `limit 200` e pelo `slice(0, BATCH)` final.
- **Pode recuperar E0 muito tempo depois?** Recupera a **cadência**, sim; a **mensagem E0**, não.

**Existem hoje dois caminhos para chegar à E0?** Sim, mas ambos terminam na mesma função: (1) `intakeLead` → `registerFirstContact` — tentativa única; (2) `processDeferredFirstContacts` → `registerFirstContact` — tentativa repetida. O caminho do Portal (`kickoffPortalFirstContact`) é um terceiro ponto de entrada, com o mesmo destino. O tick **não** é um caminho de E0.

---

## 6. POR QUE UM LEAD DE 2 DIAS PODE FICAR SEM E0

| Hipótese | Veredito | Evidência |
|---|---|---|
| **Lead sem executivo responsável** | **CONFIRMADA — causa principal** | `ensureWorkspaceCard` cria o card com `responsible_executive_id: null`; `resolveLeadExecutive` devolve "Lead sem executivo responsável definido — envio bloqueado."; `dispatchFirstContact` aborta antes de qualquer mensagem. Nos eventos: 58897, 58893, 58887, 58877, 58874 — todos com `e0_identificada` seguido de `e0_ignorada` por esse motivo exato, e nenhuma nova tentativa desde então |
| **Tentativa única fora do adiamento noturno** | **CONFIRMADA — causa estrutural** | `enteredNow` em `intakeLead` só é verdadeiro na transição para NOVOS. Depois disso nenhum processo reexamina o lead. Sem evento `e0_adiada`, o lead não entra na única fila que repete |
| **Janela operacional** | CONFIRMADA (atrasa, não perde) | `isE0NightWindow` em `intakeLead`, `registerFirstContact` e `processDeferredFirstContacts` |
| **Estágio/etiqueta não resolvido para NOVOS** | CONFIRMADA | Lead 58912 (Filipi) entrou como `zero_contato`, `entered_entry_stage_at` nulo: nenhum evento de E0 foi sequer criado |
| **Classificação B (histórico)** | CONFIRMADA (por desenho) | `classifyScannedLead` devolve B quando o lead não está no espelho e a entrada não é comprovadamente recente → `historical: true`, sem E0, para sempre. Data ausente/inválida também cai em B |
| **Corte operacional 01/09** | CONFIRMADA (por desenho) | `cadenceEligibility` → `e0_ignorada` |
| **Cron travado em RUNNING** | **CONFIRMADA** | 88 execuções RUNNING sem término em 3 dias; cada uma bloqueia 15 minutos (`STALE_RUN_MINUTES`) |
| **Ordem de processamento sem FIFO** | CONFIRMADA | Nenhum `order by` no caminho da E0; `order by at desc` no tick |
| **LIMIT / lote cheio** | CONFIRMADA como risco | `limit 200` sem ordenação na fila de adiadas; `DETAIL_CHECK_LIMIT = 80` |
| **Janela de 3 dias da fila de adiadas** | CONFIRMADA | `since = agora − 3 dias`: passado esse prazo, a pendência some sem registro |
| **Deduplicação por telefone** | CONFIRMADA | `outcome.deduplicated` encerra o intake antes da E0 |
| **Falta de template oficial da Meta** | CONFIRMADA (não bloqueia o registro) | `E0_TEMPLATE_MISSING_REASON`: a E0 é registrada, só a entrega externa fica pendente |
| **Erro em um item interrompendo os demais** | NÃO ENCONTRADA | `try/catch` por lead em todos os laços |
| **Duplicidade de E0** | NÃO ENCONTRADA | chave `msg_e0_<card>` com conflito 23505 |
| **Timeout/retry por lead** | NÃO ENCONTRADA | não existe |
| **Duas execuções realmente simultâneas** | POSSÍVEL, MAS NÃO COMPROVADA | trava sem lock transacional; nenhum caso observado nos dados |
| **Perda da janela temporal por falha do cron** | POSSÍVEL, MAS NÃO COMPROVADA | `since` volta ao último `finished_at` OK, o que protege; um lead cuja entrada não é recente e que ainda não está no espelho vira B |

---

## 7. FIFO POR IDADE

**NÃO.** O sistema não garante que o lead elegível mais antigo seja processado antes do mais novo.

Motivos técnicos:

1. `intakeLead` processa na ordem em que a origem devolve as páginas — não há reordenação por data de entrada.
2. `processDeferredFirstContacts` consulta `crm_lead_events` **sem `order by`** e com `limit 200`. Sem ordenação, o recorte é arbitrário: um lead antigo pode simplesmente não estar nos 200 devolvidos.
3. `runRelationshipTick` usa explicitamente `order by at desc` na busca de primeiros contatos e `slice(0, 200)` no final — favorecendo os mais novos.
4. Não existe `due_at`, prioridade ou fila persistente por lead que pudesse impor ordem.

---

## 8. SINCRONIZAÇÃO MANUAL

A interface chama `runCrmSyncNow` (`src/lib/crm/leads.functions.ts`, linha ~203), que executa `runLeadSync("manual", userId)`.

- **Chama `runLeadSync`?** SIM.
- **Chama `registerFirstContact`?** SIM, indiretamente — via `intakeLead` para leads em transição para NOVOS, e via `processDeferredFirstContacts` no fim de `runLeadSync`.
- **Chama algum scheduler?** NÃO — não passa por `runScheduledLeadSync`, portanto **ignora a trava de RUNNING e a trava de intervalo**.
- **Chama `processDeferredFirstContacts`?** SIM (fim de `runLeadSync`).
- **Chama `runRelationshipTick`?** NÃO — o tick só é chamado pelo agendador.

Conclusão: **clicar em Sincronizar pode disparar E0**, inclusive de leads adiados que estavam parados. Apenas abrir o CRM não dispara — a leitura do quadro não chama essas funções.

---

## 9. REGISTRO DE EVIDÊNCIA

| Pergunta | Como se prova hoje |
|---|---|
| "o sistema decidiu que a E0 deveria acontecer" | evento `e0_identificada` em `crm_lead_events` (só no caminho do intake) ou `e0_adiada` |
| "o sistema tentou executar" | **não é distinguido**. Não há registro de "tentativa": existe só o desfecho. A tentativa é inferida pelo evento de resultado |
| "a E0 foi bloqueada" | evento `e0_ignorada` com o motivo; e, para bloqueio por destino, `relationship_engine_log` com `action = 'e0_bloqueada'` |
| "a E0 foi simulada" | evento `e0_simulada`, `crm_messages.simulated = true`, `relationship_message_sends` com snapshot, `crm_timeline` com o rótulo de simulação |
| "a E0 foi realmente enviada" | `crm_messages.id = msg_e0_<card>` com `simulated = false` + snapshot em `relationship_message_sends` + `crm_timeline` |

Lacunas reais: (a) o lead que nunca chegou a `enteredNow` **não gera nenhum registro** — a ausência de E0 é invisível (caso 58912); (b) não existe registro de "E0 pendente"; (c) a fila de adiadas repete `e0_ignorada` a cada ciclo, o que polui o histórico sem indicar que existe uma pendência aberta.

---

## 10. CONCORRÊNCIA E DUPLICIDADE

- **Locks:** nenhum por lead ou por lote no caminho da E0. Só a trava de 15 min baseada na última linha de `crm_sync_runs`.
- **Idempotency key:** `msg_e0_<cardId>` (`e0MessageId`) e o id de evento do motor `e0_<lead>`.
- **Unique constraint:** a PK de `crm_messages` — o código trata explicitamente o código 23505.
- **SELECT antes de INSERT:** sim em `ensureWorkspaceCard` (verifica o card antes de inserir) — janela de corrida teórica, sem consequência de E0.
- **INSERT ... ON CONFLICT:** usado em `resolve_portal_identity` (identidade do Portal), não na E0.
- **Processamento paralelo:** nenhum; tudo sequencial.
- **Jobs concorrentes:** `remarketing-engine` roda no mesmo minuto, mas não emite E0.
- **Retries:** só a repetição implícita da fila de adiadas.

Dois processos podem olhar o mesmo lead (por exemplo, sincronização manual e o cron), mas **não podem produzir duas E0** — o segundo esbarra na chave `msg_e0_`. Podem, sim, produzir **dois registros de bloqueio** para o mesmo lead, como já ocorre.

---

## 11. CASOS REAIS

**gs_58827 (Pianezzer) — recebeu E0**
- 31/08 03:45 entrada na origem; 03:59 espelhado (`lead_criado`).
- 00:59 de Brasília = fora da janela → `e0_adiada`.
- A partir das 10:04, a fila de adiadas tentou a cada ciclo: `e0_ignorada — Lead sem executivo responsável definido` — dezenas de vezes, sempre em pares (as duas chamadas por ciclo).
- 31/08 13:51 → `e0_simulada`: assim que o card ganhou executivo responsável, a mesma fila conseguiu executar.
- 17:37 → `lead_nao_localizado` (reconciliação).

**gs_58897 (athus) — NÃO recebeu E0**
- 02/09 00:41 UTC (21:41 de Brasília, **dentro** da janela) → intake normal.
- `e0_identificada` → `workspace_card_criado` → `e0_ignorada — Lead sem executivo responsável definido`.
- Nenhum evento depois disso. Como não houve `e0_adiada`, o lead **nunca entrou na fila que repete**. Hoje o card já tem `usr_thiago` como responsável, e ainda assim nada reexamina a E0.

Mesmo padrão em 58893, 58887, 58877 e 58874.

**gs_58912 (Filipi)** — caso diferente: entrou já em `zero_contato`, com `entered_entry_stage_at` nulo. Só existe o evento `lead_criado`; a E0 nunca foi sequer considerada.

Nada faltou para reconstruir os casos.

---

## 12. CONCLUSÃO EXECUTIVA

**A) Existe fila individual e persistente de E0 por lead?**
NÃO. Só eventos e a mensagem `msg_e0_<card>`. (`lead-intake.server.ts`, `first-contact-queue.server.ts`)

**B) Existe horário individual de vencimento da E0?**
NÃO. Não há `due_at`/`scheduled_at` em nenhum ponto do caminho.

**C) O processamento é FIFO?**
NÃO. Nenhuma consulta do caminho da E0 ordena por data; o tick ordena `desc`. (`first-contact-queue.server.ts` linha ~37, `scheduler.server.ts` linha ~66)

**D) Existem múltiplos caminhos capazes de processar E0?**
SIM: `intakeLead`, `processDeferredFirstContacts` e `kickoffPortalFirstContact` — todos convergindo em `registerFirstContact`. `runRelationshipTick` recupera cadência, não E0.

**E) Um cron travado pode causar acúmulo?**
SIM, e está ocorrendo: 88 execuções RUNNING em 3 dias, cada uma bloqueando 15 minutos. (`sync-scheduler.server.ts`, `STALE_RUN_MINUTES`)

**F) Um lead novo pode passar na frente de um antigo?**
SIM. Ausência de ordenação com `limit 200` na fila de adiadas e `order by at desc` no tick.

**G) Abrir o CRM ou clicar em sincronizar pode disparar E0?**
Abrir, NÃO. Clicar em Sincronizar, SIM — `runCrmSyncNow` → `runLeadSync` → intake e fila de adiadas, sem passar pelas travas do agendador.

**H) Existe um ponto no código que explica diretamente o comportamento observado?**
SIM, e são dois, combinados:

1. `ensureWorkspaceCard` cria o card com `responsible_executive_id: null`, e `resolveLeadDestinations`/`resolveLeadExecutive` bloqueiam a E0 exatamente nesse instante.
2. `intakeLead` só tenta a E0 quando `enteredNow` é verdadeiro — uma única vez na vida do lead. Sem o evento `e0_adiada`, não existe nenhuma repetição.

O resultado prático é o padrão observado: **lead que nasce de madrugada é adiado, entra na única fila com repetição e acaba recebendo E0 quando o responsável é definido; lead que nasce em horário comercial tem uma única chance, falha por falta de responsável e fica sem E0 para sempre.** A aparência de aleatoriedade é, na verdade, o horário de nascimento do lead.

---

**Nada foi implementado, corrigido ou alterado nesta rodada.** Este documento descreve apenas o mecanismo atual.

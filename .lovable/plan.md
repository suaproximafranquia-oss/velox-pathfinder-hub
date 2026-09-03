# Auditoria de dados — o que os "462" realmente significam

Somente consulta. Nada foi alterado.

**Resposta direta (item 12): opção C.** São 462 **eventos** (tentativas), gerados por apenas **25 leads distintos**. Não são 462 leads.

## Números verificados (últimos 7 dias)

| Medida | "Sem executivo responsável" | "Link do Portal indisponível" |
| --- | --- | --- |
| Eventos | 462 | 69 |
| Leads distintos | 25 | 1 (`gs_58725`, Rodrigo Felipe) |
| Leads com 1 só ocorrência | 12 | 0 |
| Leads com 2+ ocorrências | 13 | 1 |
| Maior nº de eventos num único lead | 41 | 69 |

Por dia (horário de São Paulo):

| Dia | Eventos sem responsável | Leads | Eventos sem link | Leads |
| --- | --- | --- | --- | --- |
| 29/08 | 12 | 3 | 69 | 1 |
| 31/08 | 444 | 16 | 0 | 0 |
| 01/09 | 5 | 5 | 0 | 0 |
| 02/09 | 1 | 1 | 0 | 0 |

Ou seja: 444 dos 462 eventos são de **um único dia (31/08)** e de apenas 16 leads, todos repetindo a cada tique do cron entre 07:04 e 10:35.

## Itens 5, 6 e 7 — por executivo / conexão

Existe **uma única conexão GreenSales cadastrada**, do usuário `6005ef93…` (Thiago). Portanto todos os eventos vêm dessa mesma conexão — não há concorrência entre executivos.

| Responsável atual do card | Eventos sem responsável | Leads | Eventos sem link | Leads |
| --- | --- | --- | --- | --- |
| `usr_thiago` | 461 | 24 | 69 | 1 |
| Sem responsável até agora | 1 | 1 | 0 | 0 |

Importante: essa é a posse **de hoje**, atribuída depois pela abertura do CRM. No instante de cada evento o card estava sem dono — é exatamente isso que o evento registra.

## Item 9 — distribuição por lead (amostra dos maiores)

| Card | Nome | Eventos | Primeiro | Último | Motivo | E0 hoje |
| --- | --- | --- | --- | --- | --- | --- |
| gs_58725 | Rodrigo Felipe | 79 (69 sem link + 10 sem resp.) | 29/08 07:05 | 29/08 11:24 | link do Portal | sim |
| gs_58744 | Eraldo Macedo | 41 | 31/08 07:04 | 31/08 10:35 | sem responsável | sim |
| gs_58749 | Nelson Ferreira | 38 | 31/08 07:04 | 31/08 10:30 | sem responsável | sim |
| gs_58756 / 58787 / 58799 / 58808 / 58815 / 58823 / 58827 / 58771 / 58779 / 58792 | — | 36 cada | 31/08 07:04 | 31/08 10:30 | sem responsável | sim |
| gs_58874, gs_58893, gs_58735, gs_58936 e outros | — | 1 cada | 29/08 a 02/09 | — | sem responsável | não |

Estado atual: dos 25 leads, **13 já têm E0 registrada** (`msg_e0_…`) e **12 continuam sem E0 nenhuma**. Todos estão com `stage_key = nao_localizado` no espelho.

## Item 10 — os 69 eventos de "link do Portal"

São **um único lead** (`gs_58725`), 69 tentativas em 29/08 entre 07:05 e 11:24. O card tem responsável (`usr_thiago`), mas o executivo está **sem slug** (`responsible_executive_slug` nulo), então o link personalizado não pôde ser montado. A E0 desse lead acabou saindo depois.

## Item 11 — por que um mesmo lead repete o evento

O evento é gravado a cada **tentativa** de E0, e a tentativa se repete porque:

1. O lead continua aparecendo na janela de leitura da sincronização, que roda **a cada minuto**;
2. `intakeLead` reavalia a E0 sempre que detecta o lead na coluna de entrada;
3. O bloqueio **não marca nada** no lead — não existe "já tentei e falhei", então o próximo ciclo tenta de novo;
4. Quando alguém abre o CRM e o card ganha dono, a tentativa seguinte passa e o evento para.

Por isso o padrão observado é: dezenas de eventos seguidos no mesmo lead durante algumas horas, terminando no momento em que a posse aparece.

## Correção da leitura anterior

O diagnóstico anterior falava em "462 ocorrências" e isso podia ser lido como volume de leads perdidos. O impacto real é: **25 leads afetados em 7 dias, dos quais 12 seguem sem E0**. O diagnóstico técnico abaixo permanece válido — a causa raiz (card nasce sem responsável e a E0 é decidida na mesma hora) é a mesma, e ganha um sintoma adicional: **ausência de marcação de tentativa, gerando ruído de repetição minuto a minuto**.

---

# Diagnóstico técnico — Entrada de leads + E0 (pré-implantação da Financeira /f)

Somente leitura. Nenhum código, banco, cron, mensagem ou Safety Lock foi alterado.
Cada afirmação abaixo foi verificada no código atual e, quando marcada, nos dados reais.


## A) Diagrama do fluxo ATUAL

```text
pg_cron (job 3, a cada minuto)
  -> POST /api/public/crm/sync
  -> runScheduledLeadSync()            [sync-scheduler.server.ts]
       trava: última execução RUNNING < 15 min  => não roda
       trava: intervalo de crm_automation_settings
  -> runLeadSync("cron")               [lead-sync.server.ts]
       resolveCredentials(actorUserId) [connections.server.ts]
          1) conexão do usuário (só existe no caminho MANUAL)
          2) qualquer conexão ATIVA mais recente  <-- cron sempre cai aqui
          3) GREENSALES_EMAIL / GREENSALES_PASSWORD do ambiente
       login + fetchLeadsSince(janela = último run OK - 15 min)
       classificação A / B / C / D
          B = histórico ausente do espelho -> upsertLead(historical) SEM E0
          A/C -> intakeLead(raw, { pipeline, settings })   <-- contexto da conexão NÃO segue
  -> intakeLead()                      [lead-intake.server.ts]
       upsertLead -> crm_leads (espelho)
       enteredNow = criado em coluna de entrada OU transição real p/ NOVOS
       cadenceEligibility (corte histórico) -> senão: evento e0_ignorada
       isE0NightWindow() -> deferFirstContact() (evento e0_adiada)
       ensureWorkspaceCard() -> portal_leads id = gs_<external_id>
                                responsible_executive_id = NULL  (literal)
       registerFirstContact({ ownerId: null, simulated: executionMode() })
  -> registerFirstContact()            [crm/first-contact.server.ts]
       cadenceEligibility + janela + welcomeEnabled
  -> dispatchFirstContact()            [relationship/e0.server.ts]
       resolveLeadDestinations -> resolveLeadExecutive(leadId)
           lê portal_leads.responsible_executive_id  <-- NULL => BLOQUEIA
       texto da Biblioteca -> insert crm_messages id = msg_e0_<card> (idempotência)
       se !simulated: sendTemplateWithDestinations()
  -> whatsapp.server.ts -> blockRealWhatsappSend()  [Safety Lock]  -> Graph API
  -> volta ao scheduler: processDeferredFirstContacts() e runRelationshipTick()
```

## B) Respostas item a item (25 perguntas)

Legenda: **EXISTE** / **PARCIAL** / **NÃO EXISTE (só planejado)**.

1. **EXISTE.** Entrada única real: `runLeadSync` → `intakeLead`. Outras portas: carga histórica (`runGreenSalesBackfill`, sem E0), Portal (`portal-first-contact.server.ts`), laboratório de teste, cadastro manual no CRM.
2. **EXISTE.** `classifyScannedLead` (A/B/C/D) + `enteredNow` em `intakeLead` (criado em coluna de entrada, ou `outcome.enteredEntryStage`). Lead histórico entra como caso B e nunca gera E0.
3. **PARCIAL / é aqui que quebra.** No servidor ninguém define responsável: `ensureWorkspaceCard` grava `responsible_executive_id: null` explicitamente (workspace-card.server.ts:65). O preenchimento acontece **depois, no navegador**, quando alguém abre o CRM: `listConversations` → `ensureOwnership` → `updateWorkspaceOperational` grava o dono no banco, usando `assignedToUserId`, que por sua vez cai no executivo padrão (`getDefaultExecutive`).
4. **EXISTE.** `resolveCredentials(actorUserId)` em connections.server.ts:90: conexão do usuário → **qualquer conexão ATIVA mais recente** → variáveis de ambiente. No cron não há usuário, então é sempre o fallback.
5. **NÃO.** `resolveCredentials` devolve só `{ email, password }`; o `user_id` da conexão é descartado. `runLeadSync` não repassa `actorUserId` a `intakeLead`, e `intakeLead` não repassa nada a `ensureWorkspaceCard`.
6. **Três perdas encadeadas:** (a) `resolveCredentials` descarta o dono da conexão; (b) `intakeLead(raw, { pipeline, settings })` não recebe ator; (c) `ensureWorkspaceCard` não tem parâmetro de responsável.
7. **EXISTE.** `upsertLead` grava/atualiza `crm_leads` (espelho). O card operacional é `portal_leads`.
8. **EXISTE.** `ensureWorkspaceCard`, idempotente por `gs_<external_id>`; não sobrescreve card existente.
9. **EXISTE.** Decisão em `intakeLead` (elegibilidade + janela + `enteredNow`), dentro do mesmo laço do sync.
10. **NÃO EXISTE.** Não há etapa de planejamento persistente da E0: não existe linha "E0 planejada" com `due_at`. A única persistência é o evento `e0_adiada` para a madrugada.
11. **EXISTE.** Execução imediata, na mesma chamada da decisão (`registerFirstContact` → `dispatchFirstContact`).
12. **EXISTE.** `intakeLead`, `processDeferredFirstContacts`, `kickoffPortalFirstContact`, laboratório de teste (`test-lab.server.ts`) — todos convergem em `registerFirstContact`.
13. **EXISTE.** Somente o job `portal-crm-sync-automatico` (a cada minuto, ativo). Confirmado em `cron.job`: também estão ativos `remarketing-engine`, `portal-backup-automatico` e `portal-backup-processador` — estes não disparam E0.
14. **SIM.** `runLeadSync("manual", context.userId)` percorre o mesmo `intakeLead` e a mesma fila de adiadas. A diferença é que aí a conexão do próprio usuário é usada.
15. **SIM — e é relevante.** Abrir o CRM cria o vínculo de posse no cliente e grava no servidor via `updateWorkspaceOperational`. Não dispara E0 diretamente, mas muda o resultado da próxima tentativa.
16. **EXISTE, com falha de negócio.** `resolveLeadExecutive` devolve "Lead sem executivo responsável definido — envio bloqueado", `dispatchFirstContact` retorna `registered:false` e o intake grava `e0_ignorada`.
17. **PODE SER PERDIDO.** Não há retry para bloqueio por ausência de responsável: `e0_ignorada` é terminal. Só a fila noturna (`e0_adiada`, janela de 3 dias) é reexaminada.
18. **PARCIAL.** A "fila" é a leitura do evento `e0_adiada` dos últimos 3 dias, `limit 200`, sem `ORDER BY`. Não é uma tabela de fila.
19. **NÃO EXISTE FIFO.** Ordem = ordem de retorno da origem no sync, e ordem arbitrária do banco na fila de adiadas.
20. **EXISTE e é sólido.** Chave primária determinística `msg_e0_<cardId>` em `crm_messages`; conflito 23505 devolve "primeiro contato já registrado". Vale para retry, concorrência e clique duplo.
21. **PARCIAL.** `runScheduledLeadSync` considera abandonada uma execução `RUNNING` com mais de 15 minutos. Mas `runLeadSync` só chama `finish()` nos caminhos previstos: uma exceção fora do `try` por lead deixa a linha em `RUNNING` para sempre. **Confirmado nos dados:** 184 execuções em `RUNNING` no total, 64 nas últimas 48 h.
22. **SIM, por até 15 minutos.** Enquanto a última linha estiver `RUNNING` e recente, todo tique do cron é recusado com `execucao-em-andamento`.
23. **EXISTE.** Todas as saídas passam por `whatsapp.server.ts`: `metaProvider.send`, `sendTextMessage`, `sendMediaMessage`, `sendTemplateWithDestinations`. Fluxos que chegam lá: E0, motor de cadência, remarketing, CRM manual, campanhas.
24. **EXISTE e está no lugar certo.** `blockRealWhatsappSend` é chamado nos quatro pontos de saída, imediatamente antes da Graph API. Bloqueio incondicional até 01/01/2029 **e** exigência adicional de `WHATSAPP_REAL_SEND_ENABLED=true`. Cada bloqueio é auditado em `relationship_engine_log`.
25. **SIM — EXISTE HOJE.** `runScheduledLeadSync` chama `runRelationshipTick`, que monta `productionEngine()` e chama `engine.tick(leadId)` para até 200 leads, decidindo **e** despachando E1+. A regra "só a E0 é automática" ainda é **planejamento**, não estado atual.

## C) Pontos exatos de falha da E0 (com evidência de dados)

Últimos 7 dias, eventos `e0_ignorada`:

| Motivo | Ocorrências |
| --- | --- |
| Lead sem executivo responsável definido — envio bloqueado | 462 |
| Link personalizado do Portal não disponível para o executivo responsável | 69 |

Hoje só **1** card GreenSales está sem responsável (de 68) — prova de que a posse é atribuída **depois**, pela abertura do CRM, e não no momento da E0. A E0 corre antes de existir dono.

Falhas, em ordem de impacto:
1. **Card nasce sem responsável** (workspace-card.server.ts:65) e a E0 é decidida na mesma transação → bloqueio garantido para todo lead novo.
2. **Bloqueio é terminal**: `e0_ignorada` não entra em nenhuma fila de reprocessamento.
3. **Slug ausente** no cadastro do executivo → sem link personalizado → bloqueio mesmo com dono definido (69 casos).
4. **Sync travado em RUNNING** bloqueia o ciclo por 15 min e adia toda entrada nova.
5. **Conexão GreenSales anônima no cron** (fallback "conexão ativa mais recente"): a origem dos leads não identifica o dono da carteira.
6. **Sem fila persistente/FIFO** da E0: não há como responder "quem está esperando" nem reprocessar por ordem.

## D) Arquivos / funções / tabelas que seriam tocados

Arquivos: `src/server/crm/lead-sync.server.ts`, `src/server/crm/lead-intake.server.ts`, `src/server/crm/workspace-card.server.ts`, `src/server/crm/connections.server.ts`, `src/server/crm/first-contact-queue.server.ts`, `src/server/crm/sync-scheduler.server.ts`.
Funções: `resolveCredentials`, `runLeadSync`, `intakeLead`, `ensureWorkspaceCard`, `registerFirstContact`, `processDeferredFirstContacts`, `runScheduledLeadSync`.
Tabelas: `crm_connections` (leitura do `user_id`), `portal_leads` (posse na criação), `crm_lead_events` (novo motivo de retry), `crm_sync_runs` (fechamento de execução).
Intocados: `e0.server.ts`, `destinations.server.ts`, `whatsapp.server.ts`, `whatsapp-safety-lock.server.ts`, Biblioteca de mensagens, motor de cadência.

## E) O que pode ser corrigido sem mexer na cadência futura

- Propagar o dono da conexão GreenSales até a criação do card.
- Definir responsável no servidor no momento em que o card nasce.
- Reprocessar E0 bloqueada por falta de responsável.
- Fechar execuções de sync órfãs.
Nada disso altera etapas, mensagens, templates ou o motor.

## F) O que NÃO deve ser alterado nesta primeira implantação

Safety Lock; `e0.server.ts` e a idempotência `msg_e0_<card>`; texto e Biblioteca; templates da Meta; motor de cadência e `runRelationshipTick`; regras de corte histórico (casos A/B/C/D); janela operacional; Portal dos Leads e dados reais; nada de Solar/Seguros; nenhuma tela nova.

## G) Menor alteração segura para a E0 funcionar

Quatro correções pequenas, independentes entre si, aplicáveis em qualquer ordem:

1. **Dono da conexão viaja com o lead.** `resolveCredentials` passa a devolver também o `user_id` da conexão usada; `runLeadSync` repassa a `intakeLead`, que repassa a `ensureWorkspaceCard`.
2. **Card nasce com responsável.** `ensureWorkspaceCard` grava `responsible_executive_id` (e `slug`) resolvido a partir do usuário da conexão via `executive_profiles`. Sem executivo resolvível, mantém `null` — sem inventar dono.
3. **Retry da E0 bloqueada por posse.** Estender `processDeferredFirstContacts` para também considerar `e0_ignorada` cujo motivo é falta de responsável, reprocessando quando o card já tiver dono. Idempotência continua garantida pela chave `msg_e0_<card>`.
4. **Fechar execução órfã.** Envolver o corpo de `runLeadSync` em `try/catch` que chame `finish("ERRO", ...)`, eliminando linhas presas em `RUNNING`.

Fora de escopo desta correção (fica para a reengenharia): fila persistente com FIFO e `due_at`, e desligar o tick automático de E1+.

## H) Riscos e efeitos colaterais

- Card passar a nascer com dono muda o que o CRM mostra ao abrir; a posse deixa de ser decidida no navegador. Mitigado porque `ensureOwnership` preserva vínculo existente.
- Retry pode gerar E0 para leads que estavam parados há dias — deve ser limitado à mesma janela de 3 dias já usada e respeitar corte histórico e janela operacional.
- Fechar execuções órfãs libera o cron e aumenta a frequência real de sync (efeito desejado, mas muda volume).
- Se o executivo dono da conexão não tiver slug, o bloqueio nº 3 (link do Portal) permanece — é problema de cadastro, não de código.
- Nenhum risco de envio: toda saída continua atrás da Safety Lock.

## I) Como testar sem qualquer envio real

1. Confirmar `whatsappSafetyLockStatus().locked === true` e `WHATSAPP_REAL_SEND_ENABLED` ausente.
2. Usar o Laboratório/lote de teste (`is_test`, `test_batch_id`) — `executionMode` força simulação.
3. Verificar em `crm_messages` a existência de `msg_e0_<card>` com `simulated = true` e em `relationship_message_sends` o snapshot.
4. Conferir queda dos eventos `e0_ignorada` com motivo de responsável e ausência de novas linhas em `relationship_engine_log` com escopo `whatsapp_safety_lock`.
5. Rodar o sync duas vezes seguidas e confirmar que nenhuma segunda E0 é criada.

## J) Plano de rollback

Cada uma das quatro correções é isolada e reversível por reversão do arquivo, sem migration e sem apagar dados. Se a atribuição automática de posse gerar dono errado, basta voltar `ensureWorkspaceCard` a `null` — as mensagens já gravadas mantêm snapshot congelado e não são reescritas. O retry é desligado removendo o filtro adicional na fila.

## Decisões que preciso de você antes de implementar

1. Quando não houver executivo resolvível pela conexão, o card fica sem dono (E0 aguarda) ou usa um responsável padrão configurável?
2. O retry da E0 bloqueada deve alcançar leads dos últimos 3 dias ou apenas os que entrarem a partir da correção?
3. O tick automático de E1+ permanece como está nesta primeira implantação (recomendo sim, para não misturar assuntos)?

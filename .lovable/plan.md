# DIAGNÓSTICO (somente leitura) — Ação do Dia, Central de Operações, V0

Nenhum arquivo, banco ou migration foi alterado. Escopo verificado: Financeira `/f`.

---

## BLOCO 1 — AÇÃO DO DIA

### 1. Atualização após concluir uma ação (demora de 10–15s)

STATUS: implementado, porém lento por reconstrução repetida.
ARQUIVO(S): `src/components/crm/daily-actions-overlay.tsx`, `src/components/crm/daily-actions-real-adapter.ts`, `src/lib/crm/daily-actions.functions.ts`, `src/server/crm/daily-actions.server.ts`, `src/server/crm/daily-actions-gate.server.ts`, `src/server/relationship/call-outcome.server.ts`, `src/server/crm/e0-manual.server.ts`.
FUNÇÃO(ÕES): `completeCall` / `handleRegisterMessage` → `adapter.completeCall` → `registerQueueCallOutcomeFn` → `assertCurrentQueueItem` → `currentDailyAction` → `buildDailyActions`; depois `recordDailyActionHistoryFn`; depois `load()` → `listDailyActions` → `buildDailyActions` (de novo).
COMO FUNCIONA HOJE:
- A interface remove o card de forma otimista (`applyResult` → `dropAction`, overlay:236-240), sem esperar o servidor.
- Para itens de fila (`item.source === "queue"`) ela ainda dispara um `load()` completo (overlay:264).
- Não existe React Query, invalidate, refetch, Realtime ou polling de dados; o único `setInterval` (30s, overlay:167) só recalcula a janela operacional.
- `buildDailyActions` faz ~10+ consultas por execução (5 em paralelo + dependentes), incluindo `ensureManualE0Cadences()` com laço sequencial `await` por linha (`e0-manual.server.ts:104-124`).
- `registerQueueCallOutcome` roda o tick do motor de forma síncrona dentro da própria requisição (`call-outcome.server.ts:87` → `tickLead`).
PROBLEMA: por clique, `buildDailyActions` é reconstruída no mínimo 2 vezes (trava + recarga) e o tick do motor roda dentro da mutação. Esse é o ponto principal da demora.
EVIDÊNCIA: `daily-actions.server.ts:87-495`; `daily-actions-gate.server.ts:46-75`; `call-outcome.server.ts:87`.

### 2. Trava da posição 1

STATUS: implementada e efetiva no servidor.
ARQUIVO(S): `src/server/crm/daily-actions-gate.server.ts`, `src/lib/crm/daily-actions.functions.ts`.
FUNÇÃO(ÕES): `currentDailyAction`, `assertCurrentAction` (:91-105), `assertCurrentLead` (:112-124), `assertCurrentQueueItem` (:131-144).
COMO FUNCIONA HOJE: a lista é recalculada no servidor a cada tentativa; a ação corrente é sempre a primeira. Qualquer chave/lead/item divergente é recusado com `OutOfTurnError` antes de qualquer escrita. Todas as funções de mutação (pular, mensagem, reunião, reagendamento, follow-up, resultado de ligação) passam por essa trava. A posição 1 ainda é reivindicada na fila (`PROCESSING` + `claimed_by`).
PROBLEMA: a interface não impede visualmente a seleção de outro item — ela apenas exibe o erro devolvido. Não há, porém, forma de contornar a regra: quem tenta recebe recusa e a lista é relida.
EVIDÊNCIA: `daily-actions-gate.server.ts:91-144`; chamadas em `daily-actions.functions.ts:81,116,133,163,187,219,243,322`.

### 3. Pular

STATUS: implementado.
ARQUIVO(S): `src/components/crm/daily-actions-overlay.tsx` (`handleSkip`:300-316), `src/lib/crm/daily-actions.functions.ts` (`skipDailyActionFn`:72-87), `src/server/crm/daily-actions-log.server.ts` (`skipDailyAction`:92-107, `writeLedger`:52-89), `src/server/crm/daily-actions-gate.server.ts` (`releaseQueueClaim`:78-85).
COMO FUNCIONA HOJE: exige justificativa (mín. 3 caracteres, validada no cliente e no servidor); grava em `relationship_engine_log` (`acao_do_dia_pulada`), `crm_timeline` e histórico do investidor; libera a reivindicação (`PROCESSING → PENDING`) e nada é apagado. O item sai da posição 1, o próximo assume, e a linha da fila continua pendente — some só no dia corrente (`listSkippedActionKeys`, filtro por `operationalDate`) e volta no dia seguinte.
EVIDÊNCIA: `daily-actions-log.server.ts:452-469`.

### 4. Recuperar pendência

STATUS: parcialmente implementado — **não existe botão "Resolver pendência"**.
ARQUIVO(S): `src/server/crm/daily-actions-log.server.ts` (`recordSkipRecovery`:145-199).
COMO FUNCIONA HOJE: a recuperação é implícita. A ação pulada reaparece no dia seguinte na própria Ação do Dia; quando a mesma `actionKey` é concluída (mensagem concluída ou reunião com comparecimento), o servidor grava `acao_do_dia_pulo_recuperado`, preservando o registro original do pulo. A execução recuperada conta normalmente: a fila vira `EXECUTED` e a reunião vira "Concluída", igual a uma execução de primeira.
PROBLEMA: busca em pesquisa por todo o `src` não encontrou nenhum botão/rota "Resolver pendência"; não há lista de pendências puladas com ação de retomada, nem recuperação disparada por ligação (só mensagem e reunião).
EVIDÊNCIA: `recordSkipRecovery` chamado em `daily-actions-log.server.ts:305-316` e nas rotinas de reunião; nenhuma ocorrência textual de "Resolver pendência".

### 5. Responsabilidade do executivo

STATUS: protegido na leitura; sem checagem própria na escrita.
ARQUIVO(S): `src/server/crm/daily-actions.server.ts` (:139, :165, :347-354), `src/server/crm/e0-actions.server.ts` (:107-120), `src/lib/crm/daily-actions.functions.ts` (identidade por `currentExecutiveId`).
COMO FUNCIONA HOJE: a fila é montada já filtrada pelo executivo autenticado (reuniões, agenda e E0 por `responsible_executive_id`). Como toda mutação passa pela trava, que reconstrói a lista com esse mesmo escopo, um executivo não alcança a ação de outro.
PROBLEMA: as funções de escrita (`skipDailyAction`, `recordSkipRecovery`) não repetem a checagem de propriedade; confiam na trava. Funciona hoje, mas a proteção é indireta.

---

## BLOCO 2 — CENTRAL DE OPERAÇÕES (por que está zerada)

### 6. Indicadores, fonte por fonte

ARQUIVO: `src/server/crm/operations-center.server.ts` (`buildProductionReport`:202-425).

| Indicador | Fonte | Critério | Período | Executivo |
|---|---|---|---|---|
| Ligações | `crm_cadence_tasks` (LEGADO) | `channel='call'`, `status='DONE'` | `completed_at`, reagrupado por dia operacional | `completed_by` |
| Mensagens | `relationship_engine_log` | `acao_do_dia_mensagem_registrada` **e** `details.resultado = 'enviada'` | `details.operationalDate` | `details.executivo` |
| Reuniões | `relationship_engine_log` | `acao_do_dia_reuniao_resolvida` **e** `resultado='compareceu'` | idem | idem |
| Pulos | `relationship_engine_log` | `acao_do_dia_pulada` | idem | idem |
| Recuperadas | `relationship_engine_log` | `acao_do_dia_pulo_recuperado` (casada por `actionKey`) | idem | idem |
| Concluídas | derivado das linhas acima | — | — | — |

### 7. Fonte legada — confirmado

STATUS: **falha estrutural confirmada**.
COMO FUNCIONA HOJE: só o indicador de ligações usa fonte legada (`crm_cadence_tasks`). O caminho real de hoje (`registerQueueCallOutcome`) grava apenas em `relationship_queue` e `crm_lead_events` — nunca em `crm_cadence_tasks`. E o único gravador dessa tabela (`completeCadenceTask`) está inalcançável, porque a fila legada foi aposentada (`daily-actions.server.ts:128-133`, `Promise.resolve([])`).
EVIDÊNCIA (dados reais, últimos 30 dias): `crm_cadence_tasks` com `DONE` = **0**; `relationship_queue` executadas = **8**.

### 8/9. O que a ação real grava — e "copiada" vs "enviada"

STATUS: segunda falha estrutural confirmada.
COMO FUNCIONA HOJE:
- Ligação concluída → `relationship_queue.status='EXECUTED'` + `crm_lead_events`; **nenhum** evento `acao_do_dia_*` e nenhuma linha legada.
- Mensagem concluída → `relationship_engine_log` com `resultado = 'copiada'` (ou `'registrada'`), snapshot em `relationship_message_sends`, nota no histórico.
- Pulo → `acao_do_dia_pulada`. Recuperação → `acao_do_dia_pulo_recuperado`.
- A Central sabe distinguir "copiada" de "enviada" (o filtro existe), mas **nenhum código grava `'enviada'`**. Pesquisa em todo o servidor não encontrou gravador desse valor.
EVIDÊNCIA (dados reais): `acao_do_dia_mensagem_registrada` = 2 linhas, ambas `resultado = 'copiada'`; `acao_do_dia_pulada` = 5; `acao_do_dia_reuniao_resolvida` = 1, com `nao_compareceu`.
CONCLUSÃO: ligações zeram por tabela errada; mensagens zeram por valor esperado que nunca é gravado; reuniões zeram porque a única reunião registrada foi "não compareceu". Só os pulos deveriam aparecer (5 registros).

### 10. Atualização dos dados da Central

STATUS: cálculo no carregamento.
ARQUIVO(S): `src/components/executive/central-operacoes/central-home.tsx`, `src/lib/crm/operations-center.functions.ts`.
COMO FUNCIONA HOJE: uma chamada ao servidor por montagem e a cada troca de período/escopo (`useEffect` com `[from, to, scope]`). Sem cache, sem tempo real, sem polling. O escopo é decidido no servidor pela identidade.

---

## BLOCO 4 — V0 / DECISÃO PRÉ-E1

### 11. Localização

STATUS: existe e está ligado ao motor (não é código morto).
ARQUIVO(S): `src/server/relationship/visual-path.server.ts`; chamado em `src/server/relationship/cadence-v2-state.server.ts:145-162` e :210-218; consumido por `engine.server.ts:63` e pelo tick de produção `scheduler.server.ts:179`.
FUNÇÃO(ÕES): `ensureVisualPathDecision`, `readVisualPath`, `materialActiveMsAfter`, `reachedE4Historically`.
CONFORMIDADE: V0 não é etapa, não é mensagem, não está na Biblioteca, não aparece na Ação do Dia e não é configurável — confere com o conceito.

### 12. Momento da decisão

STATUS: implementado com uma diferença importante.
COMO FUNCIONA HOJE: a cada tick, se o fluxo é E, o motor chama a decisão; ela só grava quando **E0 já executada e E1 ainda não existe**. Fora dessa janela, apenas lê o fato já gravado. A decisão usa `materialSentAt` (evento `CONTENT_SENT`) como marco inicial.
PROBLEMA: não existe "janela de observação" com duração. A decisão é tomada no primeiro tick válido após o E0 — pode acontecer minutos depois, não em um fechamento programado.

### 13/14. Pré-visualização e fechamento às 08:00

STATUS: **não existe**.
COMO FUNCIONA HOJE: há uma única decisão, imediata e congelada ("a decisão nunca é reconsultada", cabeçalho de `visual-path.server.ts`). Não há consulta preliminar, não há fechamento de janela, não há job de madrugada nem de 08:00. Os `pg_cron` existentes são de sincronização de leads, backup e importação de nomes — nenhum ligado ao V0.
PROBLEMA: a distinção "consulta preparatória" × "decisão definitiva no fechamento pré-E1" que você descreve ainda não está construída.

### 15. Persistência

STATUS: implementado.
COMO FUNCIONA HOJE: `V_PATH_OPENED` / `V_PATH_SKIPPED` / `MATERIAL_VIEWED` são gravados em `relationship_events`, `scope='production'`, com chave idempotente (`v_path_<lead>`, `material_viewed_<lead>`). O motor relê por `readDecision`/`readVisualPath`.
PROBLEMA: a chave é por **lead**, não por ciclo; um novo ciclo herdará a decisão antiga.

### 16. Congelamento

STATUS: garantido.
COMO FUNCIONA HOJE: uma vez gravado o fato, todo tick apenas o relê; E1 normal não vira V1 depois, nem o contrário. `resolveStepContext` (`cadence-v2.ts:97-110`) mapeia E1→V1, E2→V2, E3→V3 a partir do mesmo sinalizador único, então a sequência V1→V2→V3 é estrutural e nenhuma etapa V nasce isolada.

### 17. Caminho final

OPENED → E1(V1) → E2(V2) → E3(V3). SKIPPED → E1 → E2 → E3 → E4. Ambos usam as mesmas etapas técnicas, a mesma fila e a mesma Ação do Dia; muda só o contexto de leitura do texto.

### 18. Critério de visualização

COMO FUNCIONA HOJE: evento inicial exigido = `CONTENT_SENT` (material formalmente disponibilizado). Módulos considerados: `material` e `manual`. Tempo mínimo: **3 minutos** efetivos. O tempo é somado a partir dos intervalos entre sinais reais em `portal_journey_events` posteriores ao envio, cada intervalo limitado a 5 minutos; o total é acumulado e visualizações em horários diferentes somam. O batimento do Portal chega mesmo ao servidor (a cada ~15s, só com aba visível e interação, e só nos módulos do material).
PROBLEMA: o limiar de 3 minutos foi definido no código, não por decisão sua registrada; e leitura sem interação/aba oculta não é contada.

---

## RESUMO

| BLOCO | ESTÁ IMPLEMENTADO? | ESTÁ CORRETO? | PRECISA CONSTRUÇÃO? |
|---|---|---|---|
| Ação do Dia | Sim (trava, pulo, histórico) | Parcialmente — lenta (2 reconstruções + tick síncrono) e sem "Resolver pendência" | Sim: desempenho e tela de pendências |
| Central de Operações | Sim | Não — ligações leem tabela legada vazia; mensagens exigem `'enviada'`, que nunca é gravado | Sim: religar à fonte atual |
| V0 | Sim (decisão única, congelada, persistida) | Parcialmente — sem janela de observação, sem fechamento às 08:00, chave por lead e não por ciclo | Sim, quando o Portal e o material definitivo estiverem prontos |

Nada foi alterado. Aguardo sua autorização para construir.

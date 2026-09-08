# Financeira /f — Diagnóstico forense antes da segunda construção

Somente leitura. Nada foi alterado em código, banco, Biblioteca ou Ação do Dia.

## A. Motor atual

Cadeia real, com nomes exatos:

```text
cron/sync  → src/server/crm/sync-scheduler.server.ts (linha 72)
           → runRelationshipTick()            src/server/relationship/scheduler.server.ts
             ├─ eligibleLeadIds()             (cadências abertas + fila vencida + E0 já enviada)
             ├─ bootstrapMissingCadences()    (cria ciclo para E0 órfã)
             └─ engine.tick(leadId)           productionEngine() em engine.server.ts
                → createEngine().evaluate()   src/lib/relationship/engine.ts
                   → decideNextAction()       src/lib/relationship/decide.ts   [DECISÃO]
                      → dueMomentAfterBusinessDays()  src/lib/relationship/calendar.ts
                      → FLOW_SEQUENCE / STEPS         src/lib/relationship/config.ts
                   → repository.upsertQueueItem()     repository.server.ts → relationship_queue
                   → repository.saveRecord()          repository.server.ts → relationship_cadences
                   → repository.registerEvent()       repository.server.ts → relationship_events
                   → scheduleFollowUp()               engine.ts (programa a etapa seguinte)
Ação do Dia: src/server/crm/daily-actions.server.ts lê relationship_queue (mensagem),
buildCadenceQueue() (ligação), reuniões/agenda/closure → normalizeDailyActions().
```

Ainda usam a régua antiga: `decide.ts`, `config.ts`, `calendar.ts`, `flow-plan.ts`, `machine.ts`, `engine.ts`. Nenhum arquivo importa `cadence-v2.ts` hoje — a busca não retorna nenhum consumidor.

## B. Cadence-v2

Puro e determinístico (sem banco/rede/relógio implícito). Já resolve: próxima etapa E0–E8 / R1–R4 / RE0–RE3, ramo E5/E6, salto R3, salto RE2, data teórica pela origem, piso de execução anterior, sábado→segunda, domingo→terça, feriado, colisão no mesmo dia, janelas 09:00–17:30 e sábado 08:00–16:00, ações internas de E1 (ligação 1 → +3h → ligação 2 → mensagem) e E2/E3/E4 (ligação → mensagem), contexto SEM_CONTATO/MATERIAL_ENVIADO, congelamento por AGENDAMENTOS e liberação de R só por movimentação humana para FRIO.

Precisa receber: data de origem do ciclo, etapa atual, execuções anteriores, datas já ocupadas, `CycleContext` (materialSent / materialRequested / needsNewPresentation), estágio atual do lead e o estado das ações internas.

## C. Ponto exato que ainda usa a régua antiga

`decideNextAction()` em `src/lib/relationship/decide.ts`, linhas 190–216: escolhe a etapa por `FLOW_SEQUENCE` e calcula o vencimento com `dueMomentAfterBusinessDays(reference, businessDays)` em dias úteis. É o único ponto de cálculo — trocar aqui troca todo o motor.

## D. Risco de duplicidade

Hoje o risco é zero: nada chama `cadence-v2`. O risco nasce na segunda construção se o V2 virar um segundo gerador. A regra: `decide.ts` delega ao V2 e continua sendo o único a chamar `upsertQueueItem`. Nunca criar um segundo tick.

Estado real do banco agora: `relationship_queue` = 0 linhas, `relationship_cadences` = 0 linhas, `relationship_events` = 111 (96 FIRST_CONTACT_SENT, 15 MESSAGE_SENT), `crm_cadence_tasks` = 13 (0 pendentes). Ou seja, a virada acontece praticamente em base limpa de obrigações.

## E. relationship_queue

Colunas: `id, scope, run_id, lead_id, flow, step, due_at, priority, status, attempts, executed_at, result, reason, created_at, updated_at, canonical_investor_id, flow_version_id, responsible_executive_id`.

Vencimento = `due_at`. Execução = `executed_at` + `result`. Etapa = `step`. Status existe. Ordem = `priority`. Não existe referência de AÇÃO INTERNA (ligação 1 / ligação 2 / mensagem) nem campo de DATA TEÓRICA. `priority` (inteiro) pode carregar a ordem interna, mas não distingue o tipo da ação.

## F. relationship_cadences

É o CICLO, não a obrigação: estado, fluxo, etapa atual, `executed_steps`, contadores de leitura/resposta, janela de 24h, `scheduled`, `content_history`, `instance_seq`, versão de fluxo, fechamento. Relação com a fila: 1 ciclo → N linhas de `relationship_queue` por `lead_id`+`scope`. A fila é a obrigação; a cadência é o estado.

## G. relationship_events

Histórico append-only com `type`, `step`, `event_key` (idempotência), `data` jsonb. Tipos existentes: LEAD_CREATED, FIRST_CONTACT_SENT, MESSAGE_SENT, MESSAGE_DELIVERED, MESSAGE_READ, MESSAGE_RECEIVED, EXECUTIVE_MESSAGE_SENT, WINDOW_*, SCHEDULE_CREATED/CANCELLED, MANUAL_*, NAME_CONFIRMED, CONTENT_SENT, CADENCE_*.

Ligação NÃO é registrada aqui: o desfecho vive em `crm_cadence_tasks.outcome` (SIM/NAO) + `completed_at`. Mudança de estágio também não é evento do motor.

"Apresentação digital enviada": não existe evento próprio. O que existe é `relationship_e20_occurrences` (emissão do link, status, token) e `relationship_e20_events` com `event = 'mensagem_enviada' | 'link_copiado' | 'aberta'`. Lugar tecnicamente mais seguro: derivar `materialSent` de `relationship_e20_occurrences` (emissão) + `relationship_e20_events.mensagem_enviada`, e gravar em paralelo um evento próprio no motor para o registro manual.

## H. Ações internas

O V2 já representa a lógica inteira, inclusive o cancelamento por mudança de fluxo (`nextReleasedAction({ flowChanged })` devolve `null`, e `isStepComplete` aceita CANCELLED). Falta apenas PERSISTIR: hoje não há onde guardar ordem, tipo, status e execução de cada ação interna.

## I. Agendamento e resultado da ligação

`crm_cadence_tasks.outcome = 'SIM'` já é a prova estruturada de atendimento (`human-contact.ts` a usa). `SCHEDULE_CREATED` já cancela pendências no `engine.ts` (CANCELLING_EVENTS). Reuniões já existem em `portal_meetings`. A arquitetura suporta a regra sem conflito; o que falta é ligar "outcome SIM" ao cancelamento das ações internas seguintes da mesma etapa.

## J. E7/E8 + material

Fonte do contexto: E20 (ocorrência emitida / mensagem enviada) — nunca texto. `resolveStepContext()` já converte em SEM_CONTATO / MATERIAL_ENVIADO.

## K. Biblioteca (estado real)

- E7: v1 (word, inativa) e v2 ativa, ambas com COM NOME e SEM NOME. Não há eixo de contexto — existe UM texto só, sem MATERIAL_ENVIADO / SEM_CONTATO.
- E8: NÃO existe nenhuma linha. Hoje o fim do ciclo é coberto por E20/E27/FINALIZACAO (todas com v3/v2 ativas, com e sem nome).

Falta: eixo de contexto para E7 e E8, e os textos de E8.

## L. L1–L4

L2/L3/L4 já não geram obrigação nova (`cadence.server.ts`, filtro `next.step >= 2 && !existingObligations`). L1 continua nascendo normalmente. Caminho indireto restante: `persistPlannedCalls()` grava as linhas PENDING da fila calculada — como L2+ nunca entra na fila, ele não recria. Não há outro gerador.

## M. Migration mínima

- (A) Reutilizar: `relationship_cadences` (ciclo/contexto em `content_history`/colunas existentes), `relationship_events` (histórico), `crm_cadence_tasks.outcome` (desfecho da ligação), `relationship_e20_*` (material).
- (B) Novas colunas em `relationship_queue`: `action_order` int, `action_kind` text ('call'|'message'), `theoretical_date` date, `origin_date` date, `cancel_reason` text. Status precisa aceitar `CANCELLED`.
- (C) Nova tabela: nenhuma. Uma linha por AÇÃO em `relationship_queue` cobre o caso; o par (step, action_order) já dá a chave.
- (D) Só código: transições, contexto, cancelamento, ordem da Ação do Dia, desligamento da régua antiga.

Biblioteca: E7/E8 por contexto cabe em `step_key` + `purpose` existentes (ex.: purpose `e7_material` / `e7_sem_contato`) — sem migration, apenas conteúdo cadastrado pela gestão.

## N. Ordem recomendada da segunda construção

Quase igual à sua, com uma inversão: o contexto de material precisa vir ANTES das ações condicionais, porque E4→E5 e E7/E8 dependem dele.

1. Migration mínima (colunas da fila + status CANCELLED).
2. Leitor de contexto do ciclo (material, estágio, desfecho de ligação).
3. `decide.ts` passa a delegar ao `cadence-v2` (única autoridade de etapa e data).
4. Persistência das ações internas na fila (uma linha por ação).
5. Cancelamento automático por atendimento / agendamento / mudança de fluxo.
6. Ação do Dia consome ação liberada, na ordem certa.
7. Biblioteca: eixo de contexto E7/E8 + cadastro do E8.
8. Testes e desligamento definitivo do caminho antigo.

## O. Testes da segunda construção

Exatamente os 16 que você listou, mais: idempotência do tick (rodar duas vezes não duplica obrigação) e ciclo histórico continua sem gerar obrigação.

## P. Decisões de negócio pendentes

Duas, e ambas bloqueiam parte da construção:

1. Os TEXTOS de E8 não existem na Biblioteca, e E7 não tem versão por contexto. O motor pode ficar pronto, mas E7/E8 não terão o texto certo até a gestão cadastrar.
2. Confirmar se "ligação atendida" sem agendamento e sem mudança de estágio deve encerrar a etapa e seguir para a próxima no prazo normal, ou congelar aguardando decisão humana.

Fora isso, a arquitetura da segunda parte está pronta para construção.

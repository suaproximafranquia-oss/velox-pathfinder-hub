# Diagnóstico de engenharia — Pausar/Continuar do relógio /f

## A — VIABILIDADE

**SIM**, é possível reaproveitar o relógio atual, sem segundo motor, nova fila, tabela ou mudança na cadência.

A abstração genérica já aceita congelamento por `frozenAtVirtual` em `src/lib/relationship/clock.ts:createVirtualClock()`. O relógio ambiental de `/f` ainda não persiste nem repassa esse campo. A alteração futura é pequena, mas precisa tratar cache e concorrência para não permitir que um tick já iniciado avance após a confirmação visual da pausa.

## B — MECANISMO ATUAL

O estado fica em uma única linha de `test_batches`:

- `id = environment-clock-f`
- `kind = environment_clock`
- `status = ATIVO | ENCERRADO`
- `scenarios.factor = 720`
- `scenarios.startedAtReal`
- `scenarios.startedAtVirtual`

`src/server/time/environment-clock.server.ts:envNow()` calcula:

```text
elapsedReal = max(0, realNow - startedAtReal)
virtualNow = startedAtVirtual + elapsedReal × 720
```

`environmentClock()` entrega a mesma âncora ao motor por `createVirtualClock()`. O estado é persistido no banco, mas existe cache local por processo com TTL de 10 segundos. `runRelationshipTick()` e `buildDailyActions()` forçam uma releitura antes de usar o relógio.

O código distingue:

- **Servidor real:** `Date.now()` / `new Date()`.
- **Navegador real:** `new Date()` nos componentes.
- **Ambiente /f:** `envNow()`, `envNowIso()` ou `environmentClock()`.

## C — PONTO EXATO DA ALTERAÇÃO

Arquivos/funções que precisariam mudar futuramente:

1. `src/server/time/environment-clock.server.ts`
   - `ClockState` e `parseState()` — reconhecer `frozenAtVirtual`/estado pausado.
   - `envNow()` — devolver o instante congelado quando pausado.
   - `environmentClock()` — repassar `frozenAtVirtual` ao `createVirtualClock()`.
   - `environmentClockStatus()` — expor `running | paused | real`.
   - novas operações server-side `pauseEnvironmentClock()` e `resumeEnvironmentClock()` com transição protegida.
2. `src/lib/testing/environment-clock.functions.ts`
   - expor Pausar/Continuar com a mesma autenticação Admin já usada por ligar/desligar.
3. `src/components/executive/environment-clock-card.tsx`
   - mostrar estado verde/amarelo e os botões Pausar/Continuar, mantendo “Voltar ao tempo real”.
4. `src/lib/relationship/clock.ts:createVirtualClock()`
   - **não precisa de nova lógica**; já suporta `frozenAtVirtual`. No máximo receberia teste adicional.

### Consumidores relevantes inspecionados

| Arquivo | Função/uso | Usa virtual? | Durante pausa futura |
|---|---|---:|---|
| `src/server/relationship/engine.server.ts` | `productionEngine()` injeta `environmentClock()` | Sim | Motor continua sendo chamado, mas nenhuma nova maturação temporal ocorre. |
| `src/lib/relationship/engine.ts` | `evaluate()`, `tick()`, `handleEvent()`, execução/fila | Sim, via `clock.nowIso()` | Eventos ainda podem ser tratados; prazos não avançam. |
| `src/server/relationship/scheduler.server.ts` | `runRelationshipTick()` | Sim | Cron continua rodando; usa o mesmo instante congelado. Itens já vencidos podem ser avaliados; novos não vencem. |
| `src/server/relationship/cadence-v2-state.server.ts` | `loadCadenceV2State()` | Sim | Decisão E/R/RE permanece no mesmo ponto temporal. |
| `src/server/relationship/repository.server.ts` | grava cadência, fila e decisões | Sim nos timestamps | Persistência continua; timestamps lógicos ficam iguais durante a pausa. |
| `src/server/crm/daily-actions.server.ts` | `buildDailyActions()` | Sim | Leitura continua; “atrasada/hoje/futura” fica congelada no instante virtual. |
| `src/server/crm/daily-actions-gate.server.ts` | `recentContinuityLead()`, claim/release | Sim | Claims continuam; janela de continuidade lógica não envelhece durante a pausa. |
| `src/server/crm/daily-actions-log.server.ts` | concluir, pular, anotar, reunião | Sim em vários registros | Ações manuais continuam, porém recebem o mesmo horário lógico enquanto pausado. |
| `src/server/relationship/call-outcome.server.ts` | resultado de ligação/undo | Sim | Continua funcionando e persiste resultado sem avançar o relógio. |
| `src/server/relationship/material.server.ts` | `registerMaterialEvent()` | Sim | E5/material continua sendo registrado; `occurred_at` será o instante congelado. |
| `src/server/relationship/handoff.server.ts` | `resolveHandoff()` | Sim | Decisão manual continua; não reinicia a cadência. |
| `src/server/relationship/e0.server.ts`, `e0-manual.server.ts` | eventos E0 | Sim | Operações continuam, mas sem maturação de novos prazos durante a pausa. |
| `src/server/relationship/e20.server.ts` | emissão/expiração/fechamento | Sim | Janelas lógicas E20 não expiram enquanto pausadas. |
| `src/server/relationship/closure.server.ts` | `listClosureDuties()`/execução | Sim | Novos fechamentos não vencem; vencidos continuam elegíveis. |
| `src/server/relationship/cold-relationship.server.ts` | `runColdRelationshipTick()` | Sim | RF não progride por tempo enquanto pausado. |
| `src/server/relationship/reentry-open.server.ts`, `instances.server.ts` | abertura/fechamento de instância | Sim | Operações explícitas continuam e usam timestamp lógico congelado. |
| `src/server/crm/lead-sync.server.ts` | `runLeadSync()` | **Não** | Sincronização continua em tempo real. |
| `src/server/crm/sync-scheduler.server.ts` | `runScheduledLeadSync()` | **Não** para intervalo do sync | O cron e a trava de sincronização continuam em tempo real; depois chamam o tick lógico. |
| `src/server/crm/greensales-followup.server.ts` | `syncGreenSalesFollowUps()`, `syncOneFollowUp()` | **Não** | AGENDAMENTOS/VÍDEO e `portal_meetings` continuam sendo criados/atualizados em tempo real. |
| `src/lib/portal-access.functions.ts` | `trackPortalProgress()` | **Não** | Eventos e progresso do Portal continuam sendo gravados em tempo real. |
| `src/server/portal-engagement.server.ts` | `applyEngagementEvent()` | **Não** | Sessões, retornos e atividade continuam em tempo real. |
| `src/server/crm/portal-activity-alerts.server.ts` | listar/concluir alertas | Misto | Eventos são reais; a Ação do Dia os lê usando o “agora” lógico. |
| `src/server/workspace/alerts.server.ts` | alertas e compromissos | **Não** | Continua usando tempo real. |
| `src/components/crm/next-commitment-alert.tsx` | alerta no navegador | **Não** | Continua avançando pela hora real do navegador. |

## D — O QUE NÃO PRECISA SER ALTERADO

Podem permanecer intactos:

- sequência e intervalos E0–E8, R, RE, RF e V;
- `cadence-v2`, decisões, calendários e cálculo dos `due_at`;
- motor único, scheduler e `relationship_queue`;
- prioridade, ordenação, posição 1, continuidade e claims;
- Biblioteca, templates e dispatcher;
- GreenSales, `runLeadSync()` e agendador externo;
- espelho `crm_leads`, Portal dos Leads, Workspace e portão dos quatro IDs;
- regras de AGENDAMENTOS/VÍDEO/follow-up e `portal_meetings`;
- eventos, identidade e navegação do Portal;
- regras de material E4/E5/E6;
- tabelas e migrations;
- `/s`, `/s/portal` e `/seg`.

## E — COMPORTAMENTO DURANTE PAUSE

**Continuam funcionando:** cron GreenSales, leitura externa, atualização de `crm_leads`, materialização permitida em `portal_leads`, mudanças de estágio, follow-up, compromissos AGENDAMENTOS/VÍDEO, acesso e eventos do Portal, ações manuais, notas, histórico, persistência e leitura da Ação do Dia.

**Fica congelado:** somente o “agora” retornado por `envNow()`/`environmentClock()`. Portanto não amadurecem novos prazos E/R/RE/RF, `due_at`, atraso lógico, janelas E20 nem continuidade baseada em tempo lógico.

**Consumidores que seguem em tempo real:** sincronização e follow-up GreenSales, eventos/engajamento do Portal, alertas gerais do Workspace e alguns indicadores no navegador.

**Dependência real:** um compromisso recebido do GreenSales durante a pausa é persistido normalmente. Sua classificação na Ação do Dia compara a data real do compromisso com o instante virtual congelado; se já estiver vencido nesse instante, aparece, caso contrário só amadurece após Continuar. Isso é compatível com “congelar somente o tempo virtual”, mas produz deliberadamente duas referências temporais.

Nenhum sincronizador é congelado pela arquitetura atual.

## F — PERSISTÊNCIA

O estado pausado deve usar a mesma linha `environment-clock-f`, sem nova tabela. Estado mínimo adicional:

```text
status: ATIVO | PAUSADO | ENCERRADO
scenarios.factor: 720
scenarios.startedAtReal: instante real da última partida/retomada
scenarios.startedAtVirtual: instante virtual da última partida/retomada
scenarios.frozenAtVirtual: instante virtual fixado na pausa, ou null
```

Fórmulas exatas:

```text
RUNNING:
virtualNow = startedAtVirtual + max(0, realNow - startedAtReal) × 720

PAUSE:
frozenAtVirtual = virtualNow calculado imediatamente antes da transição
virtualNow = frozenAtVirtual

CONTINUE:
startedAtVirtual = frozenAtVirtual
startedAtReal = realNow da retomada
frozenAtVirtual = null
virtualNow = startedAtVirtual + max(0, realNow - startedAtReal) × 720
```

Assim, o intervalo real da pausa nunca entra no novo `elapsedReal`. Como o estado fica no banco, F5, fechamento do navegador, outro usuário, nova sessão e reinício do servidor recuperam a pausa. O cache em memória não é a autoridade.

## G — RISCOS

| Risco | Existe? | Por quê | Prevenção futura |
|---|---:|---|---|
| Duplicação de ações | Baixo, mas real em corrida | Tick em curso pode usar snapshot anterior; fila/eventos já têm chaves idempotentes. | Transição condicional e releitura síncrona antes do tick. |
| Duplicação de compromissos | Baixo | Follow-up usa ID determinístico/upsert e condição de atualização. | Não alterar esse fluxo. |
| Perda de eventos/histórico | Não pela pausa em si | Escritas continuam; relógio só fornece timestamp. | Não cancelar processos; persistir pausa antes de responder. |
| `due_at` alterado retroativamente | Não pela fórmula proposta | Prazos já gravados não são recalculados só por pausar. | Não reancorar cadências; reancorar somente o relógio ao continuar. |
| Timestamps iguais durante pausa | Sim | Ações manuais que usam `envNow()` recebem o mesmo instante lógico. | Aceitar como semântica da pausa ou usar desempate por ID/`created_at` real; não mudar regra comercial. |
| Mistura de tempo real e virtual | Sim, já existe | GreenSales/Portal usam real; motor/Ação do Dia usam virtual. | Documentar a fronteira e testar classificação de compromissos/eventos. |
| Tick concorrente com PAUSE | Sim | Um `productionEngine()` já criado conserva o estado capturado; cache é por processo. | Guardas de estado e barreira de releitura; admitir/concluir de forma controlada o tick iniciado antes da pausa. |
| Duplo PAUSE | Sim | Hoje não há transição condicional no servidor. | `UPDATE` somente se estado esperado for RUNNING; segunda chamada vira no-op. |
| Duplo CONTINUE | Sim | Última escrita poderia reancorar o relógio novamente. | `UPDATE` somente se PAUSED e verificar linha afetada. |
| PAUSE e CONTINUE simultâneos | Sim | Escritas atuais não usam versão/lock. | Máquina de estados e atualização atômica/condicional. |
| Cache divergente entre servidores | Sim | `cache` e `inflight` são locais, TTL 10s. | Invalidar localmente e forçar leitura persistida nas entradas críticas; não depender apenas do TTL. |
| F5/nova sessão | Não para persistência | A autoridade é `test_batches`; UI apenas consulta. | Status deve expor PAUSADO corretamente. |
| Reinício do servidor | Não para persistência; há risco transitório | Banco preserva estado, mas `currentState()` sem cache devolve real na primeira chamada enquanto recarrega. | Nas entradas críticas, aguardar `refreshEnvironmentClock()` antes de usar `envNow()`. |
| Lead fora dos quatro durante pausa | Sim, risco estrutural | A allowlist é validada ao ligar, não continuamente. | Revalidar os quatro também ao Pausar/Continuar, fail-closed. |

**NÃO CONFIRMADO:** o comportamento quantitativo sob múltiplas instâncias simultâneas não tem teste de carga/concorrência no código inspecionado. Também não há teste automatizado atual cobrindo pause/resume, pois esses estados ainda não existem.

## H — MENOR ALTERAÇÃO FUTURA

1. Reutilizar a linha `environment-clock-f` e adicionar apenas `frozenAtVirtual` em `scenarios` mais o estado `PAUSADO`.
2. Fazer `envNow()` retornar `frozenAtVirtual` e `environmentClock()` repassá-lo ao `createVirtualClock()` já existente.
3. Pausar calculando e persistindo o instante virtual corrente uma única vez.
4. Continuar reancorando `startedAtVirtual` no congelado e `startedAtReal` na hora real da retomada.
5. Proteger transições no servidor: RUNNING→PAUSED e PAUSED→RUNNING; chamadas repetidas viram no-op.
6. Revalidar a allowlist dos quatro leads e forçar refresh síncrono nas entradas críticas.
7. Acrescentar dois server functions Admin e dois controles no cartão atual.

Não é necessário tocar no motor, nas etapas, nos prazos ou nas integrações.

## I — TESTE DE ACEITAÇÃO

1. Confirmar os quatro cards e ligar o relógio em 720x.
2. Registrar hora real e virtual; após 10 segundos reais, confirmar avanço aproximado de 2 horas virtuais.
3. Clicar Pausar e registrar `frozenAtVirtual`.
4. Esperar alguns minutos, atualizar a página e abrir nova sessão; confirmar o mesmo horário virtual e hora real avançando.
5. Durante a pausa, alterar um dos quatro no GreenSales para AGENDAMENTOS ou VÍDEO com follow-up; confirmar atualização de `crm_leads`, card e único `portal_meetings`.
6. Acessar o Portal do lead; confirmar `portal_journey_events`, `portal_engagement` e aviso operacional, sem avanço virtual.
7. Executar uma ação manual/material; confirmar persistência e ausência de duplicação, mantendo o horário virtual congelado.
8. Clicar Continuar; confirmar que o primeiro instante é o congelado e que o avanço posterior volta a 720x, sem salto pelo tempo pausado.
9. Confirmar que a mesma cadência/instância e os mesmos `due_at` anteriores foram preservados, sem reinício ou eventos repetidos.
10. Confirmar que `/s` e `/seg` continuam usando suas fontes normais e que nenhum registro fora dos quatro foi afetado.
11. Repetir Pausar/Continuar em duas abas para provar idempotência e transições condicionais.

## J — VEREDITO

**PEQUENA, MAS COM RISCO.**

A matemática e a persistência cabem no relógio atual, e `createVirtualClock()` já suporta congelamento. O risco está no cache por processo, no tick que pode estar em andamento e nas transições hoje não atômicas. Com estado persistido, guards condicionais, refresh síncrono e testes concorrentes, não exige nova arquitetura nem alteração das regras comerciais.

Nenhum código, dado, relógio, sincronização ou deploy foi alterado neste diagnóstico.
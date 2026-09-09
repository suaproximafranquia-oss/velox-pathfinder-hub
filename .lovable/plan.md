# Diagnóstico — horários, atrasos e próximos compromissos /f

Somente leitura de código e consultas SELECT. Nenhuma alteração de código/dados, sincronização, teste ou simulação. Este documento é diagnóstico, não autorização de construção.

## Evidências reais

| Pessoa | `scheduled_at` UTC | Brasília | Estado consultado |
|---|---|---|---|
| Yuri — `gsfu_57239` | 2026-09-09 16:05:00+00 | **09/09, 13:05** | `AGUARDANDO_REAGENDAMENTO_GREENSALES` |
| Marco — `gsfu_59142` | 2026-09-09 19:00:00+00 | **09/09, 16:00** | `PENDENTE` |
| Marcelo — `gsfu_59056` | 2026-09-10 18:00:00+00 | **10/09, 15:00** | `PENDENTE` |

**Marco e Marcelo não estão no mesmo dia.** `external_follow_up`, o espelho `crm_leads.raw_payload.follow_up` e o histórico confirmam essas datas. Ambos têm status `Agendada` e o mesmo executivo. O histórico de Marcelo já registra 10/09 na criação: não sustenta inversão do mesmo dia.

**Yuri:** às **13:02:27**, antes de 13:05, o histórico registra “sem contato, vai reagendar”. Sua retirada após F5 não pode ser atribuída exclusivamente à passagem do horário. O espelho atual já contém outra alteração; o registro acima identifica especificamente o compromisso de 13:05 solicitado.

## 1–7. Yuri e permanência visual

**1.** `buildDailyActions()` passa o instante do servidor para `resolveBucket()`, que compara com `startsAt`.

**2.** Não continuamente. O modal recebe `bucket` pronto; `blocks` apenas filtra `actions`.

**3.** Não há releitura periódica contínua da fila. O timer de **30s** atualiza somente a janela operacional. As releituras 0,9/2,2/4/7s ocorrem após desfechos.

**4.** Sim. O array permanece até outra carga, retorno de conclusão ou remoção local; passar do horário não o modifica.

**5.** F5 força leitura/classificação novas. Não é exclusivo da primeira carga: qualquer `load()` ou revalidação server-side recalcula.

**6.** Lacuna confirmada: falta reclassificação temporal contínua do modal. Mas **pendente após o horário continua sendo obrigação**, não deve desaparecer automaticamente. Para Yuri, a mudança de estado explica sua exclusão na próxima leitura; sem captura da sessão anterior, não é possível provar qual atualização visual faltou naquele instante.

**7.** Compromisso passado e `PENDENTE` continua resolvível. Yuri no estado consultado é excluído da ação operacional. `resolveFollowUpContactFn()` revalida a ação corrente; a transição também valida estado. Um card antigo não torna esse estado novamente pendente.

## 8–22. Marco 16:00 × Marcelo 15:00

**8.** A lateral usa `actions.filter(bucket === "futura")`, derivado de `buildDailyActions()`. Pode incluir `portal_meetings` e `workspace_agenda_events`.

**9.** O aviso usa `listNextCommitments()`: somente `portal_meetings` do executivo autenticado.

**10.** Não são a mesma coleção/função; filtros, limites e atualização são independentes.

**11.** Aviso: `scheduled_at ASC` no banco. Lateral: rank, depois `startsAt`, depois chave, em `sortDailyActions()`.

**12.** Timestamp completo, **data e hora**, não somente a hora local exibida.

**13.** Sim, ordenam antes da formatação visual para Brasília.

**14.** Não ordenam pelo texto local `HH:mm`. Na lateral, reuniões chegam normalizadas por `toISOString()`.

**15.** **Não neste caso:** Marco é hoje, Marcelo amanhã. A comparação textual recebe ISO UTC normalizado dessas reuniões; não há evidência de offsets diferentes causando a ordem.

**16.** Há filtros distintos: aviso usa executivo/RLS, agora−5min até agora+7dias, consulta 10, exclui apenas status exatamente `Cancelada`, retorna até 5. Não verifica `follow_up_state`. Lateral usa horizonte +2dias, estado operacional, executivo e colapso por lead; só `futura` aparece nessa seção. Não é necessário invocar esses filtros para explicar os dois registros reais.

**17.** Sim: aviso inclui inclusive os primeiros 5 minutos após o horário. Lateral deixa de chamar de futuro em T−5. Podem divergir legitimamente.

**18.** Mesmo dia, futuros e elegíveis: **Marcelo 15h** primeiro. Dados reais: **Marco 09/09 16h** antes de Marcelo 10/09 15h.

**19.** `NextCommitmentAlert()` escolhe `items[0]`; `listNextCommitments()` produz a ordem.

**20.** `sortDailyActions()`, via `normalizeDailyActions()` e `commitQueue()`. `blocks` só separa os grupos, preservando ordem.

**21.** Sim: `items` no aviso e `actions` no modal são estados independentes; não recebem invalidação compartilhada após criação/reagendamento.

**22.** Aviso carrega ao montar e a cada **120s**, sem TTL que remova itens automaticamente. Falha conserva estado antigo; não há controle de versão para respostas concorrentes. Modal não tem TTL do array. A proteção de 15s das ações resolvidas não é cache de futuros.

## 23–31. Yuri 13:05 × 16:05

**23.** Valor confirmado: **`2026-09-09 16:05:00+00`**.

**24.** Campo `timestamp with time zone` (`timestamptz`): instante retornado em UTC nesta consulta, correspondente a 13:05 Brasília. Original preservado: `2026-09-09 13:05:00`.

**25.** `buildWorkspaceAlerts()` monta `Início em ...` no servidor, linha 330.

**26.** Timezone padrão do ambiente; não informa `timeZone`. `pt-BR` define formato/idioma, não Brasília. Em UTC produz exatamente 16:05. O timezone do processo publicado não foi medido nesta investigação.

**27.** Sim: `alerts.server.ts:319,330`, confirmação e lembrete. A descrição chega pronta ao navegador, sem reconversão.

**28.** No escopo, a data complementar de `AlertsCenterPage` e `PortalLeadsBoard.formatDate()` também não fixam timezone; dependem do navegador. Ação do Dia e aviso usam `operationalTime()` com Brasília explícita. Não houve varredura de outras telas.

**29.** A descrição não participa da ordenação. Lembrete compara `Date.parse(scheduled_at)`; alertas ordenam por `date`, não pelo texto exibido.

**30.** O desvio identificado é **de apresentação**, não altera timestamp nem a seleção do aviso superior, que tem consulta própria.

**31.** Sim: fixar Brasília nas duas descrições server-side e na data complementar. **Não deslocar nem regravar `scheduled_at`.**

## 32–41. T−5 e posição 1

**32.** `resolveBucket()` calcula `startMs`/`nowMs` com `Date.getTime()`; janela = `MEETING_FOCUS_WINDOW_MS`, 5 minutos.

**33.** Regra real de `resolveBucket()` para reunião/GreenSales pendente:
- Antes de T−5: `futura`.
- De T−5 **até T+5 inclusive**: `agora`.
- Depois de T+5: `atrasada`.

**Diverge da regra apresentada:** hoje existe tolerância de 5 minutos após T, em vez de atraso imediatamente após o horário.

**34.** Comparação entre instantes absolutos, não textos locais. Brasília serve à data operacional e apresentação.

**35.** Cliente usa o resultado recebido, que pode envelhecer. Há outra distinção: `overdue` da reunião é calculado por **dia anterior**, mas `bucket` por minutos; pode haver `bucket=atrasada` e `overdue=false` no mesmo dia. A lateral e contadores usam `bucket`.

**36.** Na próxima atualização, entra também na disputa da ação corrente.

**37.** `buildDailyActions` → `resolveBucket` → normalização/ordenação; no modal, `commitQueue` → `firstExecutableKey`. Não acontece sozinha sem nova carga.

**38.** Pode: reunião em foco e cadência reivindicada recebem rank 0. Claim não vence absolutamente esse empate. Continuidade contextual de outra lead também pode prevalecer no modal.

**39.** Sim: `actionRank()` mais desempate temporal/chave. `sortDailyActions()` aplica antes a continuidade quando recebida.

**40.** Sim, grupo temporal é diferente de posição de execução.

**41.** **“AGORA · 1” = um item no grupo `bucket=agora`**, renderizado por `block.items.length`. Não é posição. O card principal depende de `selectedKey`/primeira ação executável.

## 42–48. Cadência × compromisso

**42.** Compartilham apresentação `DailyAction`, não cálculo: cadência usa `due_at`, data/dias úteis e `startsAt=null`; reunião usa `scheduled_at` e T−5.

**43.** `buildDailyActions()`: `action_kind=call` → `ligacao`; demais itens desse ramo → `mensagem`. Reunião: `source=meeting`, `kind=reuniao`; agenda própria: `source=agenda`.

**44.** Sim, mesma coleção de apresentação, não nova fila persistida.

**45.** Identidade preservada em `source`, `kind`, `actionKey`, `queueItemId/action_order` ou `meetingId/followUp`. `collapseByLead()` mantém principal e `secondary`, sem converter entidades.

**46.** Mesma função de rank, com condições diferentes por fonte/etapa/claim/prioridade/bucket.

**47.** Rank → `startsAt` ou data sintética `dueDateT23:59:59.999Z` → chave. Mesmo lead: reunião precede queue no colapso. Modal pode aplicar continuidade antes do rank.

**48.** **Parcialmente alinhada:** reunião em foco vence cadência comum; empata com reivindicada. Claim antiga pode vencer por data; continuidade pode promover outra lead. Não há prioridade absoluta de compromisso em foco em todos os casos.

## 49–55. E0 sem atraso

**49.** Sim, isenção explícita para toda E0 pendente.

**50.** `buildDailyActions()`, `daily-actions.server.ts:364–381`.

**51.** `overdue = isE0 ? false : isOverdueByBusinessDays(...)`; `bucket` deriva desse resultado.

**52.** E0 força `false` independentemente dos dias úteis passados. Prioridade de lead novo é regra separada da indicação de atraso.

**53.** Utilitário geral considera dias úteis/feriados. `availabilityDate(timestamp)` considera fechamento às 17:30. Porém queue usa `availabilityFromDate(dueDate)`, perdendo a hora, e E0 ignora o cálculo inteiro.

**54.** Proteção de calendário existe, mas a chamada não cobre toda a janela: sexta após 17:30 não é deslocada por `availabilityFromDate`. `isOverdueByBusinessDays()` compara datas sem esperar as 09h do dia corrente. E0 mascara isso com isenção total.

**55.** Remover a isenção é necessário, mas **só trocar o ternário não garante a regra inteira**. O ajuste mínimo deve usar disponibilidade real de `due_at`, calendário e próxima abertura; sem mudar vencimento, cadência ou fila.

## 56–62. Atualização

**56.** Ação do Dia: abertura, recarga e desfechos; reconferência 900/2.200/4.000/7.000ms. Sem polling contínuo da fila. Timer 30s apenas da janela operacional.

**57.** Aviso: montagem e **120s**. Não reavalia continuamente `items[0]` pela passagem do tempo.

**58.** Portal dos Leads: **60s**, página visível; consulta execuções do espelho e recarrega se mudou o ID mais recente. Também carrega ao abrir/mudar filtros. **Workspace é distinto:** carga de `portal_leads` ao montar e realtime com debounce **1,5s após o último evento**, seguido de `pullLeads()`; não polling fixo dos cards.

**59.** Combinação de cargas/eventos, intervalos específicos e realtime. Sem invalidação única compartilhada.

**60.** Sim: modal, aviso, quadro e Central têm estados independentes. Central carrega ao estabelecer sessão/montar, **sem intervalo periódico**. Workspace conserva espelho local, substituído por `pullLeads()`; promessa em voo não é TTL.

**61.** Sim. Modal/Central podem ficar antigos até recarga/reabertura. Aviso normalmente atualiza no próximo ciclo; falhas/aba suspensa prolongam. Workspace depende da criação do card e entrega do evento. Não se mediu nem revisou sincronização GreenSales para atribuir a ela latência.

**62.** Menor ponto futuro: reclassificar itens carregados pelo relógio existente; mudanças de estado/inclusão exigem invalidar/reler as mesmas fontes em eventos pertinentes. Aviso deve reavaliar sua seleção temporal. **Não repetir `listDailyActions()` como leitura pura:** ela também reconcilia/reivindica ações. Preservar autoridade server-side, claims, continuidade e velocidade. Nenhum polling novo foi criado.

## Arquivos/funções diretamente envolvidos e pontos mínimos futuros

- `src/components/crm/daily-actions-overlay.tsx`: `load`, `commitQueue`, `blocks`, `firstExecutableKey`, `ActionRow`. Reclassificação temporal; mostrar **data** na lateral elimina ambiguidade Marco/Marcelo — não corrigir a ordem deste caso.
- `src/lib/crm/daily-actions.ts`: `resolveBucket`, `actionRank`, `sortDailyActions`, `collapseByLead`, `operationalTime`. Se aplicada a regra solicitada, retirar tolerância T+5, preservando T−5.
- `src/server/crm/daily-actions.server.ts`: `buildDailyActions`. Estado/temporalidade e isenção E0.
- `src/lib/crm/daily-actions-overdue.ts`: disponibilidade e atraso por dias úteis; ajuste E0 deve preservar abertura/calendário.
- `src/components/crm/next-commitment-alert.tsx`: `NextCommitmentAlert`; `src/lib/agenda.functions.ts`: `listNextCommitments`. Seleção/intervalo próprios; ajuste de atualidade sem outra agenda.
- `src/server/workspace/alerts.server.ts`: `buildWorkspaceAlerts`; `src/routes/f.executivo.alertas.tsx`: `AlertsCenterPage`. Fixar Brasília na apresentação e atualizar estado carregado.
- `src/components/crm/portal-leads-board.tsx`: `load`, efeito 60s, `formatDate`. Atualização do quadro e fuso do navegador.
- `src/routes/f.crm.index.tsx`; `src/lib/portal-leads-sync.ts`: `pullLeads`, `subscribeLeads`. Atualização dos cards do Workspace; não se concluiu necessidade de corrigir sincronização.
- `src/server/crm/daily-actions-gate.server.ts`: `currentDailyAction`, `assertCurrentAction`; `src/lib/crm/daily-actions.functions.ts`: `resolveFollowUpContactFn`. Autoridade operacional, não expiração visual automática.

A interpretação do horário original foi lida em `src/lib/crm/greensales-followup.ts:102–117` (`parseFollowUp`). O estado de Yuri foi confrontado com `src/server/crm/greensales-followup.server.ts:661–688` (`registerFollowUpNoContact`). Nenhuma dessas funções foi executada.

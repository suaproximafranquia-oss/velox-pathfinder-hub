# DIAGNÓSTICO — follow_up do GreenSales x coluna VÍDEO (somente Financeira /f)

Nenhum código, banco, migration ou teste foi alterado. Diagnóstico de leitura.

## Achado central (muda o enunciado da pergunta)

No GreenSales, "agendamento" e "vídeo chamada" **não são duas colunas de dados do lead**: são duas **colunas do quadro (etapas)**. O campo de horário é **um só**: `follow_up`.

Confirmado no banco (`crm_pipeline_stages`):

```text
position 4  key=agendamentos  label=AGENDAMENTOS  external_tag=28
position 6  key=video         label=VÍDEO         external_tag=27
```

E existem hoje leads reais parados na coluna VÍDEO **com follow_up preenchido e ignorados**:

```text
59056  Marcelo Lira   stage_key=video  follow_up=2026-09-10 15:00:00
57239  Yuri Araújo    stage_key=video  follow_up=2026-08-27 20:00:00
```

## A) O QUE O SISTEMA FAZ HOJE

A cada rodada de sincronização, ao final de `runLeadSync`, o Portal varre os leads GreenSales cujo `stage_key = 'agendamentos'`, lê o campo `follow_up`, interpreta o horário em America/Sao_Paulo e espelha um único registro em `portal_meetings` (criar / atualizar / cancelar / nada). Fora de AGENDAMENTOS, nada é criado; e se o lead sai de AGENDAMENTOS com espelho pendente, o compromisso é **cancelado** (`CANCELADO_SAIDA_AGENDAMENTOS`).

## B) ONDE O CÓDIGO CONSULTA O FOLLOW_UP

- `src/server/crm/lead-sync.server.ts` (~linhas 496-511): coleta `follow_up` da listagem da origem e chama `syncGreenSalesFollowUps(overrides)`.
- `src/server/crm/greensales-followup.server.ts`: `syncGreenSalesFollowUps` (busca `crm_leads` com `.eq("stage_key", AGENDAMENTOS_STAGE)`), `syncOneFollowUp`, `loadMirror`, gravação em `portal_meetings`.
- `src/lib/crm/greensales-followup.ts`: `planFollowUpSync` (regra pura), `parseFollowUp`, `followUpExternalRef`, `followUpMeetingId`.

## C) QUAL CAMPO É CONSULTADO HOJE

Um único campo: `raw_payload->>'follow_up'` (ou o override vindo da listagem). A elegibilidade vem de `stage_key === 'agendamentos'` — comparação literal em `planFollowUpSync`.

## D) COMO "VÍDEO CHAMADA" É TRATADA HOJE

Não é tratada. A etapa `video` existe no quadro e é espelhada em `crm_leads.stage_key`, mas nenhum ponto do código de follow-up, agenda ou Ação do Dia menciona essa etapa. O lead em VÍDEO cai no ramo `ignore` ("Lead fora de AGENDAMENTOS").

## E) O CAMPO JÁ CHEGA NA SINCRONIZAÇÃO?

Sim, integralmente. O `follow_up` já chega e já é armazenado para os leads em VÍDEO (evidência acima). Não falta dado, falta leitura.

## F) portal_meetings JÁ SUPORTA OS DOIS TIPOS?

Estruturalmente sim, sem migration obrigatória. A tabela tem `topic`, `origin`, `external_source`, `external_ref`, `meeting_provider`, `meet_url`, `notes (jsonb)`. Não existe campo dedicado de **modalidade**. Hoje o tipo é implícito em `topic = "Agendamento (GreenSales)"`. Identificar videochamada pode ser feito por `topic` (ex.: "Videochamada (GreenSales)") — zero alteração estrutural — ou, se quiser filtro estruturado, uma coluna `meeting_kind` seria a extensão mínima e aditiva.

## G) RISCO DE DUPLICIDADE

Nenhum. A identidade é por lead, não por coluna: `external_ref = f:greensales:lead:<externalId>:follow_up` e `id = gsfu_<externalId>`, com índice único `portal_meetings_external_ref_uidx (external_source, external_ref)` e upsert `ignoreDuplicates`. Como o horário vem de um único `follow_up`, é impossível gerar dois compromissos para o mesmo lead — o registro é o mesmo, mude o lead de AGENDAMENTOS para VÍDEO ou vice-versa.

## H) CASO "AGENDAMENTO + VÍDEO CHAMADA"

Não existe esse caso no modelo real: o lead ocupa **uma** coluna por vez e possui **um** `follow_up`. Portanto não há dois compromissos a fundir. Se o lead migrar de AGENDAMENTOS para VÍDEO mantendo o mesmo horário, o mesmo registro seria reaproveitado.

## I) CASO "SOMENTE VÍDEO CHAMADA"

Hoje: nada acontece (ramo `ignore`). Pior: se o lead estava em AGENDAMENTOS com espelho pendente e é movido para VÍDEO, o compromisso existente é **cancelado** como se tivesse saído do fluxo — este é o efeito colateral mais relevante do estado atual.

## J) MENOR ALTERAÇÃO NECESSÁRIA

Tratar VÍDEO como uma segunda etapa elegível do mesmo mecanismo:

1. `greensales-followup.ts`: constante `VIDEO_STAGE = "video"` e um conjunto de etapas elegíveis; `planFollowUpSync` passa a aceitar as duas, devolvendo também a modalidade (`AGENDAMENTO` | `VIDEOCHAMADA`) derivada do `stage_key`.
2. `greensales-followup.server.ts`: consulta com `.in("stage_key", [...])` em vez de `.eq(...)`; `topic` conforme a modalidade; troca de coluna entre as duas etapas vira **atualização de modalidade**, não cancelamento.
3. Sem nova fila, motor, tabela ou agenda. O mesmo `portal_meetings` alimenta a mesma Ação do Dia e a mesma prioridade/foco.

## K) ARQUIVOS/FUNÇÕES REALMENTE ENVOLVIDOS

- `src/lib/crm/greensales-followup.ts` — `planFollowUpSync`, constantes de etapa.
- `src/server/crm/greensales-followup.server.ts` — `syncGreenSalesFollowUps`, `syncOneFollowUp`, `MIRROR_TOPIC`.
- (opcional, só apresentação) rótulo do card em `src/server/crm/daily-actions.server.ts` / `daily-action-card.tsx`.

## L) O QUE NÃO PRECISA SER ALTERADO

Ação do Dia, `relationship_queue`, motor V2, Biblioteca, E0/E4/E7/E8, R1–R4, Central de Operações, Central dos Nomes, GreenSales (leitura), estrutura de `portal_meetings`, Safety Lock, `/s`, `/s/portal`, `/seg`.

## Itens 22-25

- **22. Sincronização:** a atualização é amarrada ao par (lead, `follow_up`), não à coluna. Passa a funcionar igual para VÍDEO assim que a etapa for elegível.
- **23. Cancelamento:** hoje some o `follow_up` → `CANCELADO_ORIGEM`. Mesma estrutura serve para VÍDEO sem nada novo.
- **24. Reagendamento:** já é genérico (compara `scheduled_at` e o texto bruto do `follow_up`); só o filtro de etapa é específico.
- **25. T-5:** a constante `FOLLOW_UP_FOCUS_MINUTES = 5` e o foco da Ação do Dia atuam sobre o registro de `portal_meetings`, sem olhar a etapa de origem — videochamada usaria exatamente a mesma prioridade.

## GATILHO DO COMPROMISSO (pergunta complementar)

Verificado no código: `syncOneFollowUp` só consulta o estágio do lead, o `follow_up` da origem e o espelho existente. Não consulta a Ação do Dia, `relationship_queue`, ligações, desfechos nem qualquer histórico de execução.

1. **Depende só de etapa + follow_up?** Sim. Única condição adicional: o lead precisa existir em `portal_leads` e ter **executivo responsável** (sem responsável o espelho é ignorado, porque o compromisso não teria dono na agenda).
2. **Dependências de execução?** Nenhuma: nem ação aberta, nem ligação realizada/concluída, nem "atendeu", nem item em `relationship_queue`, nem registro na Ação do Dia.
3. **Lead em AGENDAMENTOS sem ser aberto na Ação do Dia:** o compromisso é criado pela sincronização, sozinho. É o comportamento atual.
4. **Lead em VÍDEO, após a alteração planejada:** sim, o mesmo mecanismo criaria automaticamente, sem nada de novo.
5. **Abrir a Ação do Dia sem trabalhar o lead:** irrelevante para a existência do compromisso.
6. **Pular a ação:** o compromisso continua existindo — o pulo é histórico de execução, não altera o espelho.
7. **Lead já trabalhado e depois movido para AGENDAMENTOS/VÍDEO com follow_up:** criado da mesma forma.
8. **Confirmação:** sim, o compromisso é informação de ORIGEM/AGENDA do GreenSales. A Ação do Dia executa, não cria.

**Caso do Marcelo (VÍDEO, follow_up para amanhã, nunca aberto):** a resposta correta é **(A)** — criar o compromisso e deixá-lo aguardando a data. É exatamente o que a arquitetura atual faz para AGENDAMENTOS; hoje ele não é criado apenas porque a etapa VÍDEO não é consultada.

### Três camadas distintas

- **EXISTÊNCIA:** nasce da origem (etapa elegível + `follow_up`), gravada em `portal_meetings`, estado `PENDENTE`. Só a origem cria, reagenda ou cancela.
- **EXECUÇÃO:** a Ação do Dia apresenta o compromisso no dia/horário, com foco T-5. Executar, pular ou nem abrir não muda a existência.
- **DESFECHO:** o resultado humano (contato realizado, aguardando reagendamento, vencido sem contato, encerrado, retomar em Frios) grava estado e histórico no mesmo registro — nunca apaga o passado.

## RESPOSTAS FINAIS

1. **Hoje o Portal olha somente a coluna agendamento?** Sim. A elegibilidade é `stage_key = 'agendamentos'`, literal, em um único ponto.
2. **A coluna vídeo chamada já chega ao Portal?** Sim. A etapa VÍDEO já está mapeada e o `follow_up` desses leads já está gravado — só não é lido.
3. **Dá para reaproveitar a mesma lógica sem segundo motor?** Sim. É trocar uma comparação de etapa por um conjunto de etapas elegíveis e carregar a modalidade; tudo desemboca no mesmo `portal_meetings` e na mesma Ação do Dia.


---

# DIAGNÓSTICO COMPLEMENTAR — HISTÓRICO DO AGENDAMENTO + TRANSIÇÃO DA AÇÃO DO DIA

## PARTE 1 — Registro do agendamento no histórico

1. **Já existe evento?** Sim. `syncOneFollowUp` grava em `crm_timeline` (via `appendTimeline`) nos três momentos:
   - criação → `agendamento_greensales_espelhado` ("Compromisso do GreenSales espelhado para <data>")
   - reagendamento → `agendamento_greensales_atualizado` ("Horário atualizado no GreenSales: X → Y")
   - cancelamento → `agendamento_greensales_cancelado` (com o motivo)
   Além disso, o próprio `portal_meetings.follow_up_history` guarda um log append-only (`espelhado`, `reagendado_na_origem`, `cancelado`, `movido_para_frios`).
2. **Onde:** tabela `crm_timeline`, gravada por `appendTimeline` em `src/server/crm/greensales-followup.server.ts` (linhas ~226, ~261, ~290 e demais transições). A leitura oficial é `pullCrmRecords` (`src/lib/crm/crm-sync.functions.ts`) e a apresentação usa `src/lib/crm/timeline.ts` (`listCrmTimeline`). O rótulo exibido vem de `CRM_TIMELINE_LABEL`.
3. **Mecanismo a reutilizar:** exatamente esse — `crm_timeline` + `relationship_events`. Nada de sistema paralelo de notas.
4. **Lacuna real:** os eventos de agendamento **não têm rótulo** em `CRM_TIMELINE_LABEL` (a lista de tipos não inclui `agendamento_greensales_*`), então hoje eles chegam ao banco mas podem não aparecer com nome legível na ficha do lead. É esse o ponto a corrigir — não a gravação.
5. **Sequência histórica pretendida:** viável sem estrutura nova. E0 ligação 1 / ligação 2 / mensagem já são registradas; "AGENDAMENTO CRIADO", "REAGENDADO", "CANCELADO" já são gravados; os desfechos (compareceu / não compareceu / sem contato / reagendamento) já são gravados nas transições de `follow_up_state`.
6. **Momento do registro:** já é no reconhecimento da sincronização, não no dia do compromisso. Correto.
7. **Mudança de horário:** já registra `agendamento_greensales_atualizado` no MESMO registro (`external_ref` único) — nunca cria um segundo compromisso.
8. **Cancelamento na origem:** já existe (`CANCELADO_ORIGEM` + evento de timeline). Reutilizável.
9. **Permanência:** `crm_timeline` e `follow_up_history` são append-only; nada é apagado após a conclusão.
10. **Independência da Ação do Dia:** confirmada — o registro nasce na sincronização, sem qualquer dependência de card aberto ou executado.

## PARTE 2 — Transição para a próxima ação

11. **O servidor sabe a próxima ação?** Sim. `buildDailyActions` (`src/server/crm/daily-actions.server.ts`) reconstrói toda a fila ordenada, incluindo a próxima ação do mesmo lead.
12. **Função equivalente:** `buildDailyActions` é a autoridade única. Não existe hoje um `nextReleasedAction` que devolva só o próximo item.
13/14/15. **Causa dos 10–15s:** é de interface, não de decisão de fila errada no servidor. No card (`daily-action-card.tsx`, `completeCall`) a conclusão chama `applyResult` → `dropAction` em `daily-actions-overlay.tsx`, que remove a ação da lista local e seleciona `rest[0]` — que naquele instante é **outro lead** (William), porque a mensagem E0 do Alex ainda não estava na lista (a ligação 2 só a libera ao ser concluída). Em seguida `onReload?.(true)` recarrega em silêncio, a mensagem do Alex aparece e volta para a posição 1. O servidor esteve certo o tempo todo; a UI é que exibiu um estado intermediário.
16. **A resposta da conclusão já traz o suficiente?** Não. `registerQueueCallOutcomeFn` devolve o resultado da ligação (`concluded`, etc.), sem a próxima ação.
17. **Dá para devolver a próxima ação junto?** Sim, e é o caminho natural: a mesma função pode chamar `buildDailyActions` ao final e devolver a fila recalculada (ou apenas o primeiro item), já autorizada pelas mesmas travas.
18. **UI abrir imediatamente:** sim — com a fila vinda da própria resposta não há otimismo cego, é o estado oficial do servidor entregue uma rodada antes; elimina a janela dos 10–15s sem inventar nada no cliente.
19. **Inconsistência:** se a gravação falhar, a resposta não vem `ok` e a UI não avança (comportamento atual já é esse); e a trava `assertCurrentQueueItem` continua rejeitando qualquer execução fora da posição 1, então mesmo uma tela desatualizada não consegue executar a ação errada.
20/21/22/23. **Regras preservadas:** só se não houver outra ação liberada do mesmo lead a fila promove o próximo; posição 1 continua protegida no servidor; cards seguintes continuam visíveis e não interativos; concluir passa a significar "descobrir a próxima ação correta", não "pegar o próximo lead".

## PARTE 3 — Separação dos fluxos (confirmada)

- **A) COMPROMISSO:** nasce na origem (etapa elegível + `follow_up`) → `portal_meetings` → histórico. Independente da Ação do Dia.
- **B) EXECUÇÃO:** a Ação do Dia apresenta e o executivo executa; o desfecho grava estado e histórico.
- **C) CADÊNCIA:** a existência do compromisso não depende de ação anterior. A Ação do Dia executa, não descobre.

## RESPOSTA FINAL (10 pontos)

1. Em `crm_timeline` (histórico do lead), `relationship_events` (fatos do motor) e `portal_meetings.follow_up_history` (histórico do próprio compromisso).
2. Sim — `agendamento_greensales_espelhado` / `_atualizado` / `_cancelado`.
3. O mesmo `crm_timeline`; falta apenas o rótulo legível em `CRM_TIMELINE_LABEL`.
4. Sim, e já é criado nesse momento.
5. Sim — `buildDailyActions` já calcula; ela só não é consultada no retorno da conclusão.
6. Na interface: `dropAction` seleciona `rest[0]` antes de a recarga silenciosa trazer a próxima ação do mesmo lead.
7. Sim, devolvendo a fila recalculada na resposta de conclusão.
8. Sim, sem esperar refetch, usando essa fila já autorizada.
9. Mantendo `assertCurrentQueueItem`/posição 1 no servidor e só avançando quando a resposta for `ok`.
10. Mínimo envolvido: `src/lib/crm/daily-actions.functions.ts` (retorno da conclusão), `src/components/crm/daily-actions-overlay.tsx` e `daily-action-card.tsx` (transição), `src/components/crm/daily-actions-real-adapter.ts` (repasse), `src/lib/crm/timeline.ts` (rótulos), `src/lib/crm/greensales-followup.ts` e `src/server/crm/greensales-followup.server.ts` (etapa VÍDEO por `stage_key`).

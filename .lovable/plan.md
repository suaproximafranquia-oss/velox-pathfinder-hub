# Diagnóstico RF — Relacionamento Esfriado (somente Financeira /f)

Levantamento técnico, sem alteração de código, banco ou conteúdo. Nada de RF foi criado.

## 1. Como o sistema reconhece hoje o fim de E, R e RE

Cada passagem do lead pela jornada é uma **instância** em `relationship_cadences` (`src/server/relationship/instances.server.ts`):

- `active = false` + `ended_at` + `close_reason` = passagem encerrada; o histórico nunca é reescrito.
- `flow` diz qual jornada foi percorrida (`sem_resposta`, `visualizacao`, `reengajamento`, `reentrada`).
- `executed_steps` guarda as etapas efetivamente cumpridas.
- A régua operacional (`src/lib/relationship/cadence-v2.ts`) considera a jornada terminada quando `nextTransition()` devolve `null`: E8, R4 e RE3 são os fins naturais de E, R e RE.

Ou seja: **existe encerramento explícito**, mas ele hoje só é lido para decidir R (`reengagement-history.ts`). Não existe nenhuma noção de "jornada terminou e o lead sumiu há X dias".

## 2. Onde está a última tentativa efetiva

Na fila `relationship_queue`: a coluna `executed_at` das linhas com `status = 'EXECUTED'`, filtrando por `lead_id` e `scope = 'production'`. É a fonte mais fiel de "tentativa que realmente aconteceu" (uma linha por ação executada, com `step` e `action_order`).

Fontes secundárias, úteis como conferência, não como base de cálculo: `relationship_cadences.last_outbound_at` / `ended_at` e `relationship_events.occurred_at`.

Conclusão: a data de referência do RF deve ser `max(executed_at)` da fila do lead — não a entrada em FRIOS, exatamente como a regra exige.

## 3. Como calcular D+20 e D+50

Todo o cálculo de datas já existe e é reutilizável:

- `daysBetween()`, `shiftTheoreticalDate()`, `nextOpenDay()`, `atWindowStart()` e `planDue()` em `cadence-v2.ts` — inclusive calendário operacional, fim de semana e datas administradas.
- Regra: `RF0_devido = maxExecutedAt + 20 dias corridos`, depois `RF1_devido = RF0_executado + 30 dias corridos`, ambos deslocados para o próximo dia/janela válida pelas funções acima.
- RF1 conta a partir da **execução real** da RF0 (linha da fila), não da data prevista — assim um atraso operacional não encurta o intervalo.

## 4. Como detectar que o lead voltou a evoluir

Sem inventar sinal novo, a elegibilidade cai quando qualquer um destes existir depois da data de referência:

- instância ativa em `relationship_cadences` (`active = true`) — nova E, R ou RE aberta;
- linha `EXECUTED` na fila posterior à referência;
- compromisso em `portal_meetings` (agendamento/vídeo) criado ou remarcado depois da referência;
- etapa comercial do lead em `portal_leads.commercial_state` fora de FRIO (AGENDAMENTOS, VÍDEO, OPORTUNIDADE — esta última já é terminal em todo o motor);
- evento novo em `relationship_events` (resposta, reentrada, liberação de R).

Se o RF já estiver na fila como `PENDING` e um desses sinais aparecer, a linha é **cancelada** (`status = 'CANCELLED'` com motivo), como já acontece hoje em outros cancelamentos por etapa — nada é apagado.

## 5. Ponto exato de construção

Dois arquivos, nenhum motor novo:

1. **Novo módulo puro** `src/lib/relationship/cold-relationship.ts` — decide, a partir de fatos já lidos (instâncias, fila, compromissos, etapa atual, "agora"), se RF0/RF1 é devido, em que data e por qual motivo. Espelha o formato de `reengagement-history.ts`.
2. **Novo módulo servidor** `src/server/relationship/cold-relationship.server.ts` — lê os fatos, aplica a regra e grava/cancela na fila existente, chamado **uma vez dentro de `runRelationshipTick()`** (`src/server/relationship/scheduler.server.ts`), no mesmo padrão do fechamento (`closure.server.ts`), com falha isolada.

Ponto de atenção obrigatório: `eligibleLeadIds()` no scheduler só reavalia leads com cadência aberta, tarefa vencida ou E0 recente. Um lead com jornada **encerrada** nunca é reavaliado hoje — por isso o RF precisa da própria varredura (leads com última execução entre 20 e ~90 dias atrás, sem instância ativa), e não pode depender da lista atual.

## 6. Persistência nova é necessária?

Não. As estruturas existentes bastam:

- `relationship_queue.flow` e `.step` são texto livre → `flow = 'relacionamento_frio'`, `step = 'RF0'/'RF1'` (chaves já reservadas em `config.ts` e `current-steps.ts`, com `FLOW_SEQUENCE.relacionamento_frio = ['RF0','RF1']`);
- `relationship_events` registra a decisão com `event_key` determinístico;
- `relationship_decisions` guarda o motivo legível.

Sem tabela nova, sem migration, sem coluna nova.

Ressalva a confirmar antes de construir: o índice único da fila é `(scope, run_id, lead_id, step, action_order)`, e em produção `run_id` é nulo. Isso garante RF0/RF1 uma única vez por lead **para sempre** — o que atende à regra atual ("não existe RF2", RF é a última camada). Se no futuro se quiser um segundo RF depois de uma nova jornada, aí sim seria preciso um discriminador.

## 7. Como impedir RF duplicado

Três travas, todas já usadas pelo motor:

1. índice único da fila (item 6) — uma segunda inserção do mesmo passo simplesmente não entra;
2. `event_key` determinístico (`rf0_<leadId>`, `rf1_<leadId>`) em `relationship_events`, o mesmo mecanismo de `appendRelationshipEvent` que hoje evita liberação de R repetida;
3. releitura do histórico antes de gerar: se já existe linha RF0/RF1 em qualquer status, nada é criado.

Sincronização repetida, cron duplicado ou reprocessamento não produzem RF extra.

## 8. RF cabe na Ação do Dia e na fila atuais?

Sim, sem segundo motor. A Ação do Dia consome `relationship_queue` por `due_at`/`status`; uma linha RF0 aparece como qualquer outra obrigação. O que a construção precisará prever, apenas:

- rótulos de RF0/RF1 já existem em `step-labels.ts`;
- o texto vem da Biblioteca (finalidades `relacionamento_frio_retomada` e `relacionamento_frio_encerramento`); **sem texto oficial publicado, a etapa fica pendente e não é enviada**, como já vale para as demais;
- RF1 é terminal: `RF1` encerra a instância e nada nasce depois.

## O que este diagnóstico NÃO tocou

Nenhuma alteração em E, R, RE, Biblioteca, V1/V2/V3, agenda, notas, Timeline, métricas, `/s` ou `/seg`. Nenhuma migration, tabela, RF0/RF1 criado ou suíte de testes executada.

## Decisões pendentes antes de construir

1. RF é único por lead para sempre (índice atual) ou deve poder repetir após uma nova jornada completa?
2. Existe janela máxima para o RF? Um lead parado há 2 anos deve receber RF0 hoje ao ligar a regra, ou só leads encerrados a partir de uma data de corte?
3. Se a RF0 não puder ser executada no dia previsto (sem texto, fora de janela), ela permanece pendente até ser cumprida — e o D+30 da RF1 conta da execução real. Confirmar.

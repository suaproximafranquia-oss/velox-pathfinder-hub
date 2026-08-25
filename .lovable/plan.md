# Diagnóstico técnico — horários, sincronização, ligações e divergências de etapa

Somente análise. Nenhuma alteração de código, regra, calendário ou dado foi feita.

## 1. Horários das mensagens e "há X h"

O que foi verificado no banco: a última mensagem gravada tem `at = 2026-08-25 07:01:10Z`, ou seja **04:01 no horário de Brasília**. O horário exibido está correto — a mensagem realmente saiu às 04:01 BRT.

- **Armazenamento**: `crm_messages.at` e `created_at` são `timestamptz`, sempre em UTC. Não há dupla conversão.
- **Exibição**: o CRM formata com `toLocaleTimeString("pt-BR")`, isto é, no fuso do navegador (BRT). Correto.
- **A causa real do 04:01**: a janela operacional do E0 (`src/lib/crm/e0-window.ts`) decide a hora com `date.getHours()` — hora **local do processo**. No servidor, o processo roda em **UTC**. Na prática a janela vigente hoje é 07:00–22:30 **UTC**, equivalente a **04:00–19:30 BRT**. Por isso a fila de E0 adiada reabriu às 07:00 UTC e disparou às 04:01 BRT. Os módulos de cadência de ligações (`src/lib/crm/cadence.ts`) e o motor de relacionamento (`config.ts`, `calendar.ts`) usam explicitamente `America/Sao_Paulo`; apenas a janela do E0 não usa.
- **"há 11 h / há 12 h"**: vem de `formatRelative()` (`src/lib/executive-data.ts`) aplicado a `lastActivity`, que é o **maior** entre `createdAt`, `last_activity_at` do lead e `journey_last_event_at` — **atividade do investidor no Portal**. Mensagem enviada pelo executivo **não** entra nesse cálculo (exclusão deliberada, para o card não voltar a "Novo"). Portanto: horário da mensagem e "última atividade" são campos diferentes e propositalmente desacoplados.

## 2. Sincronização com o CRM de origem

- **Automática, via agendador do banco a cada minuto**, com intervalo efetivo em `crm_automation_settings.sync_interval_minutes`. Nos registros reais de `crm_sync_runs` as execuções ocorrem **a cada ~5–6 minutos** e estão com status OK.
- **Não busca só novos**: cada execução varre a paginação da origem e classifica A/B/C/D — A/C entram por `intakeLead` (espelho atualizado), B é recuperação histórica silenciosa, D é ignorado.
- **Atraso conhecido e confirmado**: toda execução termina com `error_count: 6` e `last_error: "Lead 56554: unsupported Unicode escape sequence"`. Seis leads falham na gravação em todo ciclo e nunca atualizam. Além disso, `last_synced_at` dos quatro leads citados está em **24/08 ~20:30 UTC** — desde então nenhuma mudança foi detectada para eles.
- **Movimentação/arquivamento**: só é detectada quando a etiqueta de coluna resolvida difere da espelhada (`caso C`). Quando a origem **não** resolve nenhuma coluna, o sistema preserva a posição anterior por decisão de projeto (nunca rebaixa por ausência de informação). Nada é apagado — leads sumidos da origem viram `NÃO LOCALIZADOS`, e só após prova de varredura completa.

## 3. As ~216 ligações de hoje

- Fonte: `buildCadenceQueue("call")` (`src/server/crm/cadence.server.ts`), **recalculada a cada abertura** — não é uma lista acumulada.
- Base: todos os leads de `crm_leads` nas etapas elegíveis **ZERO CONTATO** e **FRIOS**. Hoje são **364 + 46 = 410 leads**. Para cada um calcula-se a próxima tentativa (L1..L5) a partir da data de entrada do ciclo ou da entrada na etapa elegível; entram na fila os vencimentos `<= hoje`. O resultado da ordem de 216 é coerente com esses 410.
- Histórico de conclusão: `crm_cadence_tasks` com `status = DONE`. Consulta atual: **0 conclusões nos últimos 7 dias** — ou seja, nada foi baixado, e todas as tentativas permanecem em aberto/atrasadas, o que infla a lista.
- "Ligações de leads que não estão no funil visível": a fila lê `crm_leads` (espelho do CRM de origem) e não o quadro do Portal dos Leads; com o espelho defasado (item 2) e o filtro fixo em zero_contato/frio, aparecem leads que na origem já saíram dessas colunas.

## 4. Divergências de etapa (Romualdo, Yuri, Edson, Delmir)

Estado atual do espelho:

```text
Romualdo Andrade  (58172)  video          etapa desde 22/08  sync 24/08 20:27
Yuri Araújo       (57239)  cof_contrato   etapa desde 22/08  sync 24/08 20:29
Edson Lemes de sá (55911)  vencemos       etapa desde 22/08  sync 24/08 20:31
Delmir Fidelis    (54853)  finalizado     etapa desde 12/06  sync 24/08 20:34
```

A regra de mapeamento está em `src/lib/crm/board.ts`: a origem não informa "coluna", informa **etiquetas**; o Portal converte etiqueta → coluna por `crm_pipeline_stages` e, havendo mais de uma etiqueta de coluna, **vence sempre a de maior posição**:

```text
novos 1 · zero_contato 2 · frio 3 · agendamentos 4 · oportunidades 5
vídeo 6 · 4cof/contrato 7 · pagamento 8 · remarketing 9 · vencemos 10 · finalizado 11
```

Consequências que explicam exatamente os casos relatados:

- **Romualdo** — origem em OPORTUNIDADES (5), Portal em VÍDEO (6): o lead conserva a etiqueta de VÍDEO; como 6 > 5, o Portal mantém VÍDEO. **O modelo não admite retrocesso de etapa.**
- **Yuri** — origem em VÍDEO (6), Portal em 4COF/CONTRATO (7): mesma causa, etiqueta mais avançada remanescente.
- **Edson** — VENCEMOS em ambos: correto.
- **Delmir** — FINALIZADO (11) no espelho: correto; ele deixou de aparecer em Vencemos porque avançou, não por perda de dado.

Ou seja, não é erro de tabela de-para (a tabela está completa e alinhada), é a **semântica do resolvedor**: "maior posição vence" + "ausência de etiqueta não rebaixa". Quando a operação move um card **para trás** na origem, ou quando a origem mantém etiquetas antigas, o Portal fica adiantado.

## Pontos que precisarão de correção depois (não executados agora)

1. Janela E0 no fuso `America/Sao_Paulo` (hoje efetivamente UTC) — é a causa direta dos disparos às 04:0x.
2. Os 6 leads que falham todo ciclo com `unsupported Unicode escape sequence` (ex.: 56554) — nunca sincronizam.
3. Política de retrocesso de etapa: definir se a origem manda na posição atual (respeitar remoção de etiqueta / usar etapa declarada) em vez de "maior posição vence".
4. Fila de ligações: alinhar a fonte (espelho `crm_leads`) com o funil exibido e tratar o acúmulo de tentativas nunca concluídas.
5. Opcional: exibir na lista de conversas o horário da última mensagem separado da "última atividade do investidor", hoje conscientemente distintos.

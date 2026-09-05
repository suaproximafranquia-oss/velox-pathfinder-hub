# Central de Operações (/f) — fechamento da semântica dos dados

Somente leitura. Nada foi implementado, alterado ou migrado.

### 1. LIGAÇÕES

- **Onde nasce o planejamento:** em memória, a cada consulta, dentro de
  `buildCadenceQueue("call")` (`src/server/crm/cadence.server.ts`). Não existe linha
  de "ligação planejada" em lugar nenhum do banco.
- **Fonte existente:** `crm_leads` (etapa elegível, `stage_entered_at`,
  `last_entry_at`/`external_created_at`/`ingested_at`) + histórico de conclusões em
  `crm_cadence_tasks` (`status='DONE'`) + data de ativação da cadência
  (`loadCadenceActivationDate`) + `relationship_queue` das mensagens pendentes, usada
  apenas como preferência de calendário.
- **Data prevista:** calculada por `nextCallAttempt(baseDate, history, planned)`; a
  fila só devolve a PRÓXIMA tentativa e descarta `dueDate > hoje`. Ou seja: existe
  data prevista, mas apenas para hoje/atrasadas, nunca para o futuro.
- **Executivo:** não faz parte do cálculo. A fila é por lead; o responsável só existe
  no card (`portal_leads.responsible_executive_id`, dono atual) ou em `completed_by`
  após a execução. Não há responsável histórico de ligação planejada.
- **Lead:** `crm_leads.id`, com `external_id` como ponte para `portal_leads`
  (`gs_<external_id>`).
- **O sistema sabe, antes da conclusão, que "para este lead, nesta data, deveria
  existir uma ligação"?** SIM, mas apenas de forma derivada e volátil, e somente para
  a data corrente ou anterior — não há registro persistido, então não há como
  reconstruir historicamente o que estava previsto em 03/09.
- **É possível representar sem nova estrutura?** SIM para "hoje" (a Central pode
  chamar `buildCadenceQueue("call")` e obter planejadas/pendentes/vencidas do dia);
  NÃO para períodos passados (7/30 dias), porque o passado não é reconstruível — a
  regra depende do estado atual do lead, que já mudou.
- **Menor estrutura necessária (se o histórico for exigido):** persistir a obrigação
  no momento em que a fila a calcula pela primeira vez — uma linha `PENDING` na
  própria `crm_cadence_tasks` (mesma chave `lead_id,channel,cycle_date,step_day` já
  usada no upsert de conclusão), gravada pelo motor existente e nunca por um segundo
  motor. Isso muda o significado da tabela de "conclusões" para "tarefas", que é
  exatamente a ressalva levantada — por isso é uma decisão, não uma recomendação
  automática. A alternativa sem tocar na tabela é aceitar que ligações só têm
  leitura confiável no dia corrente.

### 2. E0

- **Existe prazo formal?** NÃO. Não há `due_at`, `deadline`, SLA ou equivalente em
  `workspace_e0_actions` nem em nenhuma configuração de primeiro contato.
- **Fonte do prazo:** inexistente. O que existe é a JANELA OPERACIONAL
  (`src/lib/crm/e0-window.ts`): Seg–Sex 07:00–22:30, Sábado 07:00–12:00, Domingo sem
  envio, sempre em America/Sao_Paulo. Ela define quando o E0 PODE acontecer, não até
  quando ele DEVE acontecer.
- **Regra atual:** o E0 nasce na entrada do lead; fora da janela é adiado e retomado
  na próxima abertura (`first-contact-queue.server.ts`). No modo manual vira ação
  pendente de prioridade máxima na Ação do Dia, sem prazo.
- **Central deve considerar vencido como:** hoje ela usa idade desde `created_at`, o
  que torna todo E0 pendente automaticamente vencido — isso não representa regra
  nenhuma do negócio. O correto, dentro do que a arquitetura suporta, é NÃO
  classificar E0 como vencido enquanto não houver prazo formal; no máximo, tratar
  como vencido o E0 pendente cuja janela do dia de entrada já fechou (fecho do dia
  operacional), que é a única referência temporal existente.
- **Existe estrutura nova necessária?** NÃO para deixar de marcar vencido. SIM apenas
  se a operação quiser um prazo real (campo `due_at` em `workspace_e0_actions` ou uma
  configuração única de "E0 até X horas/fim do dia").

### 3. PERÍODO

- **Planejadas no período:** mensagem `relationship_queue.due_at`; ligação — data
  calculada pela fila (sem histórico persistido); E0 `created_at`; reunião
  `scheduled_at`.
- **Executadas no período:** mensagem `relationship_queue.executed_at`; ligação
  `crm_cadence_tasks.completed_at`; E0 `workspace_e0_actions.executed_at`; reunião —
  não existe data de desfecho: `portal_meetings` tem apenas `scheduled_at` e `status`,
  então "realizada no período" só pode ser aproximada pelo horário agendado.
- **É possível separar?** SIM para mensagem, ligação e E0. PARCIAL para reunião.
- **Campos utilizados:** os quatro pares acima; nenhum campo novo é necessário.
- **Principal risco:** as duas visões precisam ser consultas distintas (uma por data
  de obrigação, outra por data de execução) e nunca somadas na mesma tabela — se
  forem unidas, a mesma ação planejada e executada em dias diferentes apareceria duas
  vezes. Mantendo-as como visões separadas, não há dupla contagem.

### 4. SCOPE

- **Campo correto:** `relationship_queue.scope`, com os valores do motor
  (`production` | `homologation`, em `src/lib/relationship/types.ts`). Hoje as 38
  linhas existentes são todas `production`.
- **Fonte:** o próprio motor, que já opera scoped (`createRepository(scope, runId)`);
  rodadas de homologação também usam `run_id` não nulo — produção é `run_id IS NULL`.
- **Atenção:** `portal_leads.scope` NÃO é ambiente — guarda a origem
  (green_sales, portal, tiktok, meta, redistribuicao). O marcador de teste do lead é
  `is_test` / `test_batch_id`, usado pelo laboratório.
- **Onde aplicar filtro:** `relationship_queue` (`scope='production'` e
  `run_id IS NULL`) e, nas quatro fontes, exclusão de leads `is_test`. Ligações,
  reuniões e E0 não têm coluna de ambiente própria; o isolamento delas depende do
  `is_test` do lead.
- **Estrutura nova necessária?** NÃO. É só filtro de leitura na Central.

### 5. KPIs

- **Planejadas:** obrigações cuja data de obrigação cai no período (mensagem `due_at`,
  E0 `created_at`, reunião `scheduled_at`, ligação apenas no dia corrente).
- **Executadas:** duas leituras, ambas legítimas e nomeadas explicitamente —
  "executadas do que era previsto" (subconjunto das planejadas) e "produção do
  período" (por `executed_at` / `completed_at`). Nunca somar as duas.
- **Pendentes:** obrigações do período ainda não concluídas, canceladas nem puladas.
- **Vencidas:** pendentes cujo prazo formal já passou — hoje aplicável a mensagem
  (`due_at`) e ligação (data prevista do dia); E0 fica fora até haver prazo; reunião
  passada sem desfecho é "aguardando desfecho", não vencida.
- **Puladas:** eventos `acao_do_dia_pulada` em `relationship_engine_log`, pela data do
  log. Continuam fora da contagem de status, como categoria própria.
- **Canceladas:** E0 `CANCELADA` e reunião cancelada, pela data de obrigação.
- **KPI principal recomendado:** "produção do período" (executadas por data efetiva),
  porque é a pergunta de gestão diária; "aderência ao planejado" fica como segunda
  leitura no mesmo painel, com rótulo distinto.
- **Sobreposição:** só a de vencidas dentro de pendentes. Recomendo manter vencidas
  como recorte visível de pendentes (rótulo "das quais X vencidas"), não como cartão
  paralelo que parece somar.

### 6. DECISÕES A TOMAR

1. Ligações históricas: aceitar leitura confiável só no dia corrente, ou passar
   `crm_cadence_tasks` a registrar também a obrigação pendente (mudança de
   significado da tabela).
2. E0: deixar de marcar vencido, usar o fechamento do dia operacional, ou criar um
   prazo formal.
3. KPI principal: produção por data efetiva (recomendado) ou aderência ao planejado.
4. Vencidas: recorte dentro de pendentes (recomendado) ou cartão separado.
5. Reuniões: aceitar `scheduled_at` como data de produção ou registrar data de
   desfecho.
6. Isolamento: confirmar que a Central deve ver apenas `production`, `run_id IS NULL`
   e leads não marcados como teste.

### 7. ESTRUTURA NOVA REALMENTE INDISPENSÁVEL

Nenhuma, para corrigir E0, período e escopo — tudo é leitura.
Apenas se a decisão 1 for "quero histórico de ligações planejadas": persistir a
obrigação pendente na `crm_cadence_tasks` já existente, escrita pelo motor atual,
sem criar tabela nem segundo motor. E, se a decisão 2 for "quero prazo real de E0":
um único campo de prazo em `workspace_e0_actions`.

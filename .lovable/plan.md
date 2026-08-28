# Diagnóstico técnico pós-Comando A — estado real da aplicação

Análise apenas. Nada foi alterado. Todas as afirmações abaixo foram confirmadas por leitura de código e consulta ao banco nesta mesma etapa.

## 1. Reativação do investidor

1.1 — O único emissor de `investor.reactivated` é `src/lib/workspace-alerts.ts` (função `pushAlert`, linha ~132). Ele só dispara quando um alerta é criado com `category === "movimentacao"` e `investorId` preenchido, com chave determinística `investor.reactivated:{alertId}`. Esse alerta nasce em `evaluateInvestorMovement()`, que compara `investor.lastActivity` com o "último visto" guardado em localStorage e exige um intervalo mínimo de inatividade.

1.2 — Hoje provocam reativação: apenas atividade real do investidor no Portal (a `lastActivity` usada já passa pela lista branca de `src/lib/events/investor-activity.ts` via `listAllInvestors`), e somente para leads de origem `portal`. NÃO provocam: abertura do card, visualização de perfil, edição de ficha, criação/alteração de reunião, alerta administrativo, mensagem enviada pelo executivo, ligação registrada.

1.3 — Não existe estado persistido de "reativado" no banco. É heurística 100% local (`velox:alerts` + "último visto" no navegador), portanto por dispositivo e perdida ao limpar o navegador.

1.4 — Sem criar conceito novo, os candidatos existentes são: `relationship_e20_occurrences` (já modela ocorrência com ciclo/estado por lead), `relationship_events` (fatos do motor) e `crm_timeline` (evento `retorno_identificado`, já previsto no enum de rótulos). A trilha natural é ocorrência de reengajamento em tabela do motor, e não uma coluna booleana em `portal_leads`.

## 2. Histórico da jornada

2.1/2.2 — CONFIRMADO: "Status do Lead atualizado" é rótulo local. Ele existe em dois mapas de apresentação (`src/lib/investor-profile.ts` linha 48 e `src/lib/executive-data.ts` linha 222) para o evento `lead.status.changed` do barramento `velox:events:v1`. No banco não há nenhuma linha equivalente: a distribuição de `crm_timeline` (631 linhas) é `duplicidade_detectada` 299, `conversa_aberta` 132, `relacionamento_oficial` 124, `primeiro_contato` 54, `cadencia_e1` 7, `atividade_portal` 6, `cadencia_e3` 6, `mensagem_enviada`/`lead_criado`/`janela_reaberta` 1 cada. Ou seja, a duplicidade observada é client-side e não contaminou a base.

2.3 — Emissores de `lead.status.changed`: `markLeadViewed`, `closeLead`, `reopenLead` (`src/lib/lead-state.ts`) e `src/components/shared/executive-contact-dialog.tsx` (linha 82). O caso da tempestade era `markLeadViewed` sendo chamado a cada montagem; hoje ele retorna cedo quando `viewedAt` já existe e a emissão usa `dedupeKey` determinística.

2.4 — A forma mais segura já adotada é dupla: guarda de mudança real antes de escrever/emitir + `dedupeKey` no barramento (janela de 15s). O reforço pendente seria tornar a jornada exibida pelo servidor a única fonte, deixando o barramento fora da timeline apresentada.

2.5 — Sim: `executive-contact-dialog.tsx` ainda emite `lead.status.changed` sem `dedupeKey`, e `closeLead`/`reopenLead` também emitem sem chave. São ações intencionais do executivo (não remontagem), mas duplo clique ainda pode duplicar a linha na timeline local.

2.6 — "Contato registrado" é montagem da timeline, não duplicidade de dados: `buildInvestorProfile` (`src/lib/investor-profile.ts`) itera todas as linhas do cache com o mesmo `id`. A deduplicação por `id|createdAt` já está aplicada; a base não tem leads repetidos com a mesma identidade GreenSales.

## 3. Motor de cadência e Agenda

3.1 — DECISÃO JÁ DETERMINADA — motivo: `relationship_queue` é o motor oficial (24 linhas, alimentada por `src/server/relationship/engine.server.ts` / `scheduler.server.ts`, com `flow`, `step`, `due_at`, `status`, `run_id`). `crm_cadence_tasks` é o mecanismo legado das ligações (5 linhas, nenhuma pendente).

3.2 — Não existe chave única de ação. `relationship_queue` tem `lead_id + flow + step + run_id`, mas sem constraint de unicidade; `crm_cadence_tasks` tem `lead_id + step_day + cycle_date`. Não há noção compartilhada de "instância da jornada".

3.3 — O lugar correto é a própria `relationship_queue` (chave lógica `lead_id + flow + step + instância`), consumida por `agenda_cadence_tasks` — nunca uma terceira tabela.

3.4 — Relação atual: a função `agenda_cadence_tasks(_from,_to,_executive_id)` lê exclusivamente `crm_cadence_tasks`, e `src/lib/agenda.functions.ts` (linha 88) chama essa RPC. Portanto a Agenda enxerga ligações legadas e ignora completamente as mensagens da fila oficial. Isso é coerente com o observado.

3.5 — Sim, risco alto: unificar a visualização antes da chave única faria a mesma ação aparecer duas vezes (ligação legada + item da fila), e reprocessamentos do motor multiplicariam linhas na Agenda.

3.6 — São 5 tarefas legadas, nenhuma pendente. Preservar como histórico/somente leitura é suficiente; não há dependência operacional viva.

## 4. Conflito de horário da Agenda

4.1 — `portal_meetings` tem `scheduled_at` + `duration_min` (1 reunião na base). Fim é derivável, mas não existe coluna de término materializada.

4.2 — A constraint atual é `EXCLUDE USING gist (executive_id =, tstzrange(starts_at, ends_at) &&) WHERE (priority = 'maxima')` — apenas evento × evento, e apenas entre eventos de prioridade máxima.

4.3 — NÃO bloqueia. Reunião 14:00–15:00 em `portal_meetings` e evento máximo 14:30–15:30 em `workspace_agenda_events` são tabelas distintas; a exclusão GiST não as cruza.

4.4 — Caminhos possíveis, sem duplicar reuniões: (a) coluna gerada de término em `portal_meetings` + trigger de validação cruzada nas duas tabelas; (b) espelho canônico somente-leitura das reuniões dentro da própria tabela de agenda com `source='reuniao'`, mantendo a exclusão GiST como único guardião. A opção (a) preserva a fonte única; a (b) simplifica a constraint mas exige sincronismo.

## 5. Notas do Executivo (mapeamento, sem implementar)

5.1 — Conflitam conceitualmente: `crm_timeline` (já tem o evento `nota_executivo`), `crm_cadence_tasks.note`/`outcome`, `portal_meetings.notes` (jsonb de notas de reunião) e `crm_messages`.

5.2 — `portal_leads.notes` está vazio em 100% das linhas (0 leads preenchidos) e é exposto como campo livre "Observações" na edição de ficha (`src/lib/workspace-lead-edit.ts`). Não é histórico operacional.

5.3 — `crm_cadence_tasks.note` é desfecho da ação (par com `outcome` e `completed_at`), não nota de histórico.

5.4 — Existe hoje `src/lib/investor-comments.ts`, comentários internos guardados apenas em localStorage (`velox:investor-comments:v1`) e incluídos nos backups. É o mecanismo que precisa ser preservado/migrado quando o módulo for construído.

## 6. Rotas /f

6.1 — 38 arquivos de rota sob o prefixo `f.` em `src/routes`.

6.2 — As antigas são apenas stubs de 13 linhas com `redirect` preservando `search` e `replace: true` (verificado em `executivo.dashboard`, `executivo.investidores`, `crm`, `remarketing`, `portal-leads`). Nenhuma implementação duplicada encontrada.

6.3/6.4 — `unitPath()` e `currentUnit()` continuam com ZERO uso fora de `src/lib/business-unit.ts`; permanecem 153 literais `/f/...`. Concentração: `src/components/executive/executive-shell.tsx` (24), `src/components/recognition/recognition-host.tsx` (2), `src/config/modules.ts`, `src/components/auth/operational-guard.tsx`, `src/components/crm/portal-leads-board.tsx`, `src/components/executive/google-status-indicator.tsx`, e o restante nos próprios arquivos de rota.

6.5 — `/f/$slug` está intacto: resolve a marca por prefixo (`getBrandByPrefix("f")`) e redireciona para a Home com `e` (executivo), `o` (origem) e `b` (marca) — ownership e identidade preservados.

---

## A. Correto e mantido

Lista branca de atividade real; `viewed_at`/`closed_at` no banco como verdade; guarda de mudança real em `markLeadViewed`; `dedupeKey` no barramento; dedupe de "Contato registrado"; identidade GreenSales; stubs de redirecionamento; `/f/$slug`; constraint GiST da Agenda; `relationship_queue` como motor.

## B. Problemas reais encontrados

1. Agenda cega para a fila oficial: `agenda_cadence_tasks` lê só `crm_cadence_tasks`.
2. Sem chave única de ação (lead + etapa + instância) na `relationship_queue`.
3. Conflito de horário não cobre reunião × evento máximo.
4. Reativação é heurística de navegador, sem estado de negócio.
5. `executive-contact-dialog`, `closeLead` e `reopenLead` emitem `lead.status.changed` sem `dedupeKey`.
6. `unitPath()` sem uso, 153 literais `/f/` espalhados.
7. Notas do executivo vivem só em localStorage.

## C. Decisões pendentes

- D1 Formato da chave única de instância da jornada.
- D2 Estratégia de conflito Agenda × reunião: validação cruzada por trigger ou espelho canônico.
- D3 Onde persistir reativação: ocorrência no motor ou evento em `crm_timeline`.
- D4 Destino das 5 tarefas legadas de `crm_cadence_tasks`: congelar como histórico.
- D5 Migrar comentários locais para tabela de notas, ou começar do zero preservando o cache.

DECISÃO JÁ DETERMINADA — motor oficial (`relationship_queue`), identidade do lead (ID GreenSales) e arquitetura de prefixos `/f`, `/s`, `/seg`: definidos por código e regra vigente, não voltam à mesa.

## D. Recomendações

- D1: chave lógica na própria fila (`lead_id + flow + step + instância`) com índice único parcial sobre itens não cancelados. Evita terceira tabela e resolve reentrada.
- D2: validação cruzada por trigger com término derivado de `scheduled_at + duration_min`. Mantém `portal_meetings` como fonte única de reuniões e não duplica registros na Agenda.
- D3: ocorrência persistida no motor (`relationship_e20_occurrences` ou equivalente do reengajamento) e `retorno_identificado` na `crm_timeline` só como fato exibível.
- D4: congelar o legado em leitura; a Agenda passa a ler fila oficial + legado, deduplicado pela chave de D1.
- D5: migração idempotente dos comentários locais na criação da tabela, para não perder observação já escrita pelo executivo.

## E. Dependências

D1 é pré-requisito de qualquer unificação da Agenda e de D4. D2 é independente. D3 depende do motor de reengajamento (etapa posterior) e não deve ser antecipado. D5 é independente, mas deve vir antes de qualquer limpeza de localStorage.

## F. Ordem recomendada

1. Chave única de ação na fila oficial (D1).
2. Agenda lendo fila oficial + legado congelado, sem inventar tarefas (D4).
3. Conflito de horário reunião × evento máximo (D2).
4. Higiene de emissão restante do barramento (`dedupeKey` nos três pontos abertos).
5. Notas do Executivo (D5).
6. Reengajamento persistido (D3), já na etapa do motor.

## G. Superfície afetada quando autorizado

Arquivos: `src/lib/agenda.functions.ts`, `src/components/agenda/agenda-dock.tsx`, `src/server/relationship/scheduler.server.ts`, `src/server/relationship/engine.server.ts`, `src/lib/lead-state.ts`, `src/components/shared/executive-contact-dialog.tsx`, `src/lib/investor-comments.ts`, `src/lib/business-unit.ts` e os arquivos com literais `/f/`.

Banco: índice único parcial em `relationship_queue`; nova versão de `agenda_cadence_tasks`; trigger de conflito envolvendo `workspace_agenda_events` e `portal_meetings`; futura tabela de notas com RLS e GRANTs. Nada disso executa nesta etapa.

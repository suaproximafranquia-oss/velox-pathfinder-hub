# Bateria final de fechamento — respostas (Financeira /f)

Nada foi alterado: sem código, banco, migration, mensagens, Biblioteca, Ação do Dia, E0, E4, E7/E8, agendamento, GreenSales, /s, /s/portal, /seg. Sem build, typecheck ou testes.

## Bloco 1 — Referência E7/E8
1 SIM · 2 SIM · 3 SIM · 4 SIM
5. `src/components/executive/message-library-panel.tsx` (seletor de contexto e listagem por contexto), apoiado em `src/lib/relationship/library.functions.ts` e `src/server/relationship/message-library.server.ts`.

## Bloco 2 — R3
6 SIM · 7 SIM · 8 SIM · 9 SIM · 10 SIM · 11 SIM · 12 SIM · 13 SIM · 14 SIM
15. Evento `CONTENT_SENT`, lido por `loadMaterialState` (`src/server/relationship/cadence-v2-state.server.ts`) e usado como `cycle.materialSent` na transição de R2 em `src/lib/relationship/cadence-v2.ts`.

## Bloco 3 — Quatro conteúdos do R3
16 SIM · 17 SIM · 18 SIM · 19 SIM · 20 SIM · 21 SIM · 22 SIM · 23 SIM · 24 SIM

## Bloco 4 — E1 / V1
25 SIM · 26 SIM · 27 SIM · 28 SIM · 29 SIM · 30 SIM · 31 SIM

## Bloco 5 — E2 / V2
32 SIM · 33 SIM · 34 SIM · 35 SIM · 36 SIM · 37 SIM

## Bloco 6 — E3 / V3
38 SIM · 39 SIM · 40 SIM · 41 SIM · 42 SIM · 43 SIM

## Bloco 7 — E4 intacta
44 SIM · 45 SIM · 46 SIM · 47 SIM · 48 SIM

## Bloco 8 — Decisão do motor
49 SIM · 50 SIM · 51 SIM · 52 SIM · 53 SIM · 54 SIM · 55 SIM

## Bloco 9 — Fila e identidade
56 SIM · 57 SIM · 58 SIM · 59 SIM
60. Hoje a fila NÃO guarda contexto: `relationship_queue` identifica a ação apenas por `lead_id`, `flow`, `step`, `action_order` e `action_kind`. O contexto é resolvido no momento de preparar a mensagem, por `resolveStepContext` (`src/server/relationship/cadence-v2-state.server.ts`) + `prepareStepMessage` (`src/server/relationship/step-message.server.ts`), que busca na Biblioteca pela combinação `step_key` + `step_context`.
61 SIM

## Bloco 10 — V0 e momento da decisão
62 SIM · 63 SIM · 64 SIM · 65 SIM · 66 SIM · 67 SIM · 68 SIM

## Bloco 11 — Mensagem e Biblioteca
69 SIM · 70 SIM · 71 SIM · 72 SIM · 73 SIM · 74 SIM

## Bloco 12 — Legado V3/V4
75 SIM · 76 SIM · 77 SIM · 78 SIM
79. Na Biblioteca atual, a lista operacional é derivada das etapas oficiais da régua V2, então V3/V4 não aparecem como etapas ativas. As referências antigas vivem no código (`src/lib/relationship/types.ts`, `config.ts` no fluxo `visualizacao`, `messages.ts`, `current-steps.ts`, `operational-steps.ts`) e nos rótulos históricos (`step-labels.ts`), e só aparecem na tela se existir registro histórico gravado com essas chaves. Há ainda um rótulo "V3" em dado de demonstração (`src/lib/crm/daily-actions.demo.ts`), fora da produção.
80. Somente históricas (mais o rótulo de demonstração, que é resíduo de interface). Nenhuma é operacional atual.

## Bloco 13 — Finalização e agendamento
81 SIM · 82 SIM · 83 SIM · 84 SIM · 85 SIM · 86 SIM · 87 SIM · 88 SIM

## Bloco 14 — R3 depois do caminho V
89 SIM · 90 SIM · 91 SIM · 92 SIM

## Bloco 15 — Histórico
93 SIM · 94 SIM · 95 SIM · 96 SIM
97. O histórico por lead está em `relationship_queue` (linhas por `lead_id` com `step`, `status`, `executed_at`, independentes de instância) e em `relationship_events` (marcos do lead, incluindo material). Hoje a decisão usa `executedSteps` da instância corrente, carregado por `loadCadenceV2State` (`src/server/relationship/cadence-v2-state.server.ts`) — é esse ponto que precisaria passar a ler o histórico do lead.

## Bloco 16 — Isolamento
98 SIM · 99 SIM · 100 SIM

## Bloco 17 — Mapa final
101 SIM · 102 SIM · 103 SIM · 104 SIM · 105 SIM · 106 SIM · 107 SIM · 108 SIM · 109 SIM · 110 SIM · 111 SIM · 112 SIM

## Bloco 18 — Identificação exata da construção

113.
- A) Dois contextos de R3 — `src/server/relationship/cadence-v2-state.server.ts` (`resolveStepContext`: passar a devolver contexto também para R3) e `src/server/relationship/message-library.server.ts` (`stepCombinations`/`ensureLibrarySeed`: R3 passa a ter slots por contexto).
- B) Determinar NÃO_CHEGOU_E4 / JÁ_PASSOU_E4 — `src/server/relationship/cadence-v2-state.server.ts` (`loadCadenceV2State`: consultar histórico do lead em `relationship_queue`/`relationship_events` em vez de só `executedSteps` da instância), e `src/lib/relationship/cadence-v2-decide.ts` / `src/lib/relationship/cadence-v2.ts` para carregar esse dado no estado de decisão.
- C) Terceiro contexto em E1/E2/E3 — `src/server/relationship/cadence-v2-state.server.ts` (`resolveStepContext`), `src/server/relationship/message-library.server.ts` (combinações e semeadura), tipos de contexto em `src/lib/relationship/library.functions.ts`.
- D) Motor selecionar V1/V2/V3 — `src/lib/relationship/cadence-v2.ts` (entrada do ciclo após E0: decidir uma única vez e marcar o caminho) e `src/lib/relationship/cadence-v2-decide.ts` (propagar o caminho V nas etapas seguintes), com o insumo de V0 vindo do estado em `cadence-v2-state.server.ts`.
- E) Biblioteca apresentar os contextos — `src/components/executive/message-library-panel.tsx` (seletor de contexto passa a valer para E1/E2/E3 e R3) e `src/lib/relationship/library.functions.ts`.
- F) Mensagem contextual chegar à fila — `src/server/relationship/step-message.server.ts` (`prepareStepMessage`) e o gravador de fila em `src/server/relationship/repository.server.ts`; se o caminho V precisar ser auditável na própria linha, o campo natural é o de metadados já existente na fila.
- G) Ação do Dia consumir sem lógica paralela — `src/server/crm/daily-actions.server.ts` e `src/components/crm/daily-actions-overlay.tsx` permanecem como consumidores; nenhuma decisão de contexto entra ali.

Fora dessa lista, para o insumo de V0 (medição): `src/server/portal-engagement.server.ts`, `src/lib/portal-access.functions.ts`, `src/lib/journey/engine.ts`, `src/components/journey/journey-tracker.tsx`.

114. NÃO para os contextos: `relationship_message_library.step_context` já é campo livre e aceita novos valores. SIM, provavelmente, para a medição de visualização — guardar tempo efetivo por módulo e o marco de visualização confirmada exige persistência. Antes de qualquer construção é preciso confirmar se existe restrição de valores no campo de contexto.

115. NÃO para R3 e V1/V2/V3 — cabem nas tabelas existentes. Para a medição de tempo por módulo, é decisão de construção: pode ser coluna adicional no engajamento existente em vez de tabela nova.

116. SIM, apenas no engajamento: hoje só existe tempo ativo total por investidor; para medir consumo do material é preciso tempo efetivo por módulo (e por período). Nenhuma alteração de schema é necessária na Biblioteca, na fila ou nos eventos.

117. SIM.

118. Não se aplica.

# Segunda bateria de diagnóstico — respostas (Financeira /f)

Nada foi alterado: sem código, banco, migration, Biblioteca, mensagens, motor, Ação do Dia, fila, E0, GreenSales, follow_up, E7/E8, R1–R4, /s, /s/portal, /seg. Sem testes, build, typecheck ou refatoração.

## Bloco 1 — R3 e os dois contextos
1 SIM · 2 SIM · 3 SIM · 4 SIM · 5 SIM · 6 SIM · 7 SIM · 8 SIM · 9 SIM · 10 SIM

## Bloco 2 — Material: oferta x envio/recebimento
11 SIM · 12 SIM · 13 SIM · 14 SIM · 15 SIM · 16 SIM · 17 SIM · 18 SIM · 19 SIM
20. Evento `CONTENT_SENT` (escopo `production`), lido em `loadMaterialState` (`src/server/relationship/cadence-v2-state.server.ts`) e aplicado como `cycle.materialSent` na transição de R2 em `src/lib/relationship/cadence-v2.ts`.

## Bloco 3 — Histórico de E4
21 SIM · 22 SIM · 23 SIM
24. SIM — `relationship_events` (marcos do lead, incluindo material) e o histórico de etapas executadas gravado nas instâncias em `relationship_cadences`.
25 SIM · 26 SIM · 27 SIM · 28 SIM · 29 SIM
30. SIM — em `loadCadenceV2State` (`src/server/relationship/cadence-v2-state.server.ts`) o histórico usado é o da instância corrente; a instância de reengajamento nasce com esse histórico vazio (`openInstance`, `src/server/relationship/instances.server.ts`). Além disso, `releaseReengagementOnFrios` (`src/server/crm/greensales-followup.server.ts`) cancela pendências do ciclo anterior — o registro permanece, mas quem só olhar a instância nova não encontra a E4.

## Bloco 4 — V0
31 SIM · 32 SIM · 33 SIM · 34 SIM · 35 SIM · 36 SIM · 37 SIM · 38 SIM · 39 SIM · 40 SIM · 41 SIM · 42 SIM · 43 SIM · 44 SIM · 45 SIM

## Bloco 5 — Quando V0 pode existir
46. SIM — `CONTENT_SENT`.
47 SIM · 48 SIM · 49 SIM · 50 SIM · 51 SIM · 52 SIM · 53 SIM · 54 SIM

## Bloco 6 — O que caracteriza V0
55. NÃO. A estrutura existente que forneceria os dados é o engajamento do Portal: agregado por investidor em `portal_engagement` (sessões, retornos, tempo ativo, primeiro e último acesso por módulo) e linha do tempo bruta em `portal_journey_events` (evento, módulo, percentual, data/hora), alimentados por `applyEngagementEvent` (`src/server/portal-engagement.server.ts`) a partir de `recordPortalActivity` (`src/lib/portal-access.functions.ts`).
56 SIM · 57 SIM · 58 SIM · 59 SIM · 60 SIM · 61 SIM · 62 SIM
63. SIM (`portal_engagement.active_ms`).
64. NÃO.
65. NÃO.
66. SIM — é lacuna; não está implementado.

## Bloco 7 — Medição de visualização
67 SIM · 68 SIM · 69 SIM · 70 SIM · 71 SIM · 72 SIM
73. NÃO — não existe limite de visualização confirmada. Existem apenas parâmetros do engajamento geral (sessão nova após 4 horas sem atividade; intervalo acima de 5 minutos não vira tempo ativo; teto de 30 minutos na pontuação).
74 SIM · 75 SIM (níveis de engajamento em `src/lib/engagement/score.ts`) · 76 SIM · 77 SIM

## Bloco 8 — V1/V2/V3
78 SIM · 79 SIM · 80 SIM · 81 SIM · 82 SIM · 83 SIM · 84 SIM · 85 SIM · 86 SIM · 87 SIM · 88 SIM · 89 SIM · 90 SIM

## Bloco 9 — Identidade técnica
91. SIM.
92. O mecanismo natural é o de CONTEXTO de etapa já existente (`step_context` na Biblioteca + `resolveStepContext` no motor), mantendo a identidade operacional E1/E2/E3 e acrescentando um terceiro valor de contexto — sem criar chaves de etapa novas.
93 SIM
94. SIM — existem chaves históricas `V3` e `V4`, com significado antigo ("visualizou e não respondeu" / "encerramento da interação visualizada"), em `src/lib/relationship/step-labels.ts`, `src/lib/relationship/types.ts`, `src/lib/relationship/config.ts` (fluxo `visualizacao`), `src/lib/relationship/messages.ts`, `src/lib/relationship/current-steps.ts` e `src/lib/relationship/operational-steps.ts`. São referências históricas/legadas, não etapas da régua V2.
95 SIM

## Bloco 10 — Transição V → E4
96 SIM · 97 SIM · 98 SIM · 99 SIM · 100 SIM · 101 SIM · 102 SIM

## Bloco 11 — Se V levar a agendamento
103 SIM · 104 SIM · 105 SIM · 106 SIM · 107 SIM · 108 SIM · 109 SIM · 110 SIM

## Bloco 12 — R depois de V
111 SIM · 112 SIM · 113 SIM · 114 SIM · 115 SIM · 116 SIM · 117 SIM · 118 SIM

## Bloco 13 — Cenários
119 SIM · 120 SIM · 121 SIM · 122 SIM · 123 SIM · 124 SIM · 125 SIM · 126 SIM · 127 SIM · 128 SIM · 129 SIM · 130 SIM · 131 SIM

## Bloco 14 — Histórico e múltiplos ciclos
132 SIM · 133 SIM · 134 SIM · 135 SIM · 136 SIM

## Bloco 15 — R3 e Biblioteca
137 SIM · 138 SIM · 139 SIM · 140 SIM · 141 SIM · 142 SIM · 143 SIM

## Bloco 16 — Ação do Dia
144 SIM · 145 SIM · 146 SIM · 147 SIM · 148 SIM · 149 SIM · 150 SIM

## Bloco 17 — Fila
151 SIM · 152 SIM · 153 SIM · 154 SIM · 155 SIM · 156 SIM · 157 SIM

## Bloco 18 — Cancelamento / finalização
158 SIM · 159 SIM · 160 SIM · 161 SIM

## Bloco 19 — Escopos e ambientes
162 SIM · 163 SIM · 164 SIM · 165 SIM
166. SIM — a régua e o estado são módulos compartilhados: `src/lib/relationship/cadence-v2.ts`, `src/lib/relationship/cadence-v2-decide.ts`, `src/server/relationship/cadence-v2-state.server.ts`, `src/server/relationship/engine.server.ts` e a seleção de conteúdo em `src/server/relationship/message-library.server.ts`/`step-message.server.ts`. Qualquer mudança ali precisa ser aditiva e neutra para os demais ambientes.
167. NÃO.

## Bloco 20 — Reutilização
168 SIM · 169 SIM · 170 SIM · 171 SIM · 172 SIM · 173 SIM · 174 SIM

## Bloco 21 — Lacunas
175.
- A) V0 como decisão única antes de E1: `src/lib/relationship/cadence-v2.ts` (entrada do ciclo após E0), `src/lib/relationship/cadence-v2-decide.ts`, `src/server/relationship/cadence-v2-state.server.ts`.
- B) V1/V2/V3: `src/server/relationship/cadence-v2-state.server.ts` (resolução de contexto), `src/server/relationship/step-message.server.ts` e `src/server/relationship/message-library.server.ts` (seleção por contexto), `src/components/executive/message-library-panel.tsx` (cadastro).
- C) Contexto histórico de R3: `src/lib/relationship/cadence-v2.ts` (escolha de R3) e `src/server/relationship/cadence-v2-state.server.ts` (passar a informação de E4 histórica), mais a seleção de conteúdo citada em B.
- D) Medição para visualização confirmada: `src/server/portal-engagement.server.ts`, `src/lib/portal-access.functions.ts`, `src/lib/journey/engine.ts`, `src/components/journey/journey-tracker.tsx`.
- E) Leitura do histórico de E4: `src/server/relationship/cadence-v2-state.server.ts` (consulta ao histórico do lead em `relationship_queue`/`relationship_events`, e não à instância corrente).

176. Já existem e seriam reutilizados: `relationship_queue` (lead, etapa, situação, datas, ordem, claims); `relationship_events` (`MATERIAL_REQUESTED`, `CONTENT_SENT`, marcos do lead); `relationship_cadences` (instâncias, `awaiting_handoff`, etapas executadas); `relationship_message_library` (`step_key`, `step_context`, corpo com e sem nome, versão/ativação); `portal_engagement` (`sessions`, `returns`, `active_ms`, `modules`, `modules_last`, acessos); `portal_journey_events` (evento, módulo, percentual, data/hora); `portal_meetings` (`follow_up_state`, `follow_up_review_due_at`); `crm_leads.stage_key`.

177. Não existem hoje: tempo efetivo por módulo; tempo efetivo restrito a um período posterior a uma data; marco de visualização confirmada como fato estruturado; terceiro valor de contexto de etapa e aceitação de contexto por E1/E2/E3; segundo eixo de contexto de R3; sinalização de "chegou à E4" independente de instância.

178.
- Tempo efetivo por módulo/período: NÃO é derivável de forma confiável do agregado atual — exige persistência nova (ou refinamento do registro existente), porque `active_ms` é total do investidor.
- Marco de visualização confirmada: derivável no momento da decisão, mas registrá-lo como fato é o que garante auditoria e não reconsulta; depende da medição acima.
- Contextos (V e R3): NÃO exigem tabela nova — cabem no campo de contexto já existente da Biblioteca.
- "Chegou à E4": derivável do histórico já gravado do lead; não exige persistência nova.

179. SIM.

## Bloco 22 — Riscos de interpretação
180. SIM — nomes `V3`/`V4` com significado histórico em `src/lib/relationship/types.ts`, `config.ts` (fluxo `visualizacao`), `messages.ts`, `step-labels.ts`, `current-steps.ts`, `operational-steps.ts`; e a chave histórica `E0_V1`. Há ainda um rótulo "V3" em dado de demonstração (`src/lib/crm/daily-actions.demo.ts`).
181. SIM — os mesmos pontos do item 180.
182. NÃO — nenhuma dessas chaves é etapa operacional da régua V2 hoje.
183. NÃO.
184. NÃO — o motor não consulta engajamento do Portal em nenhum ponto da régua.
185. NÃO — o contexto é resolvido a cada preparo de mensagem, mas apenas entre "sem contato" e "material enviado", conforme fato estruturado; não há reinício de decisão.

## Bloco 23 — Condição de entrada da V
186 SIM · 187 SIM · 188 SIM · 189 SIM · 190 SIM · 191 SIM · 192 SIM

## Bloco 24 — Regra absoluta de entrada
193 SIM · 194 SIM · 195 SIM · 196 SIM

## Bloco 25 — Regra absoluta de R3
197 SIM · 198 SIM · 199 SIM · 200 SIM · 201 SIM

## Inconsistências entre o confirmado e o código atual

1. Histórico de E4 não é lido do lead, e sim da instância corrente.
   Onde: `loadCadenceV2State` em `src/server/relationship/cadence-v2-state.server.ts`, alimentado por `openInstance` (`src/server/relationship/instances.server.ts`), que cria a instância de reengajamento com histórico de etapas vazio.
   Regra contrariada: itens 5, 31, 135 e 136 — o contexto de R3 deve vir do histórico real do lead.

2. R3 é etapa única, sem eixo de contexto.
   Onde: escolha de R3 em `nextStep` (`src/lib/relationship/cadence-v2.ts`) e resolução de contexto em `resolveStepContext` (`src/server/relationship/cadence-v2-state.server.ts`), que só devolve "sem contato" ou "material enviado".
   Regra contrariada: itens 2, 115, 138 e 139.

3. Contexto de etapa não comporta o valor de visualização e E1/E2/E3 não recebem contexto.
   Onde: `resolveStepContext` (`src/server/relationship/cadence-v2-state.server.ts`) e a seleção de conteúdo em `src/server/relationship/step-message.server.ts` / `message-library.server.ts`.
   Regra contrariada: itens 17, 78 e 92.

4. Engajamento não mede tempo por módulo nem por período posterior ao envio do material.
   Onde: `applyEngagementEvent` (`src/server/portal-engagement.server.ts`), que acumula `active_ms` global.
   Regra contrariada: itens 50, 64, 65 e 187.

5. Nomes V3/V4 já existem com significado histórico.
   Onde: `src/lib/relationship/types.ts`, `config.ts`, `messages.ts`, `step-labels.ts`, `current-steps.ts`, `operational-steps.ts`.
   Regra contrariada: risco direto aos itens 93, 94 e 95 caso as novas mensagens usem as mesmas chaves.

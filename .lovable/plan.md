# Auditoria (somente leitura) — Biblioteca × Ação do Dia × Histórico × KPI × Campanha × Remarketing (/f)

Nada foi implementado, alterado ou executado: sem código, sem banco, sem migration, sem tick/sync/cron, sem envio. (Observação: neste modo só o arquivo de plano pode ser gravado, então a nova tarefa ainda não foi anotada em `roadmap.md`.)

## 1. Fonte oficial das mensagens

1. **Tabelas**: texto oficial em `relationship_message_library`; conteúdo de valor (mídia/link) em `relationship_contents`; vínculo etapa↔conteúdo em `relationship_step_content_bindings`; templates aprovados da Meta em `meta_templates`/`crm_meta_templates` via `relationship_template_bindings`. `relationship_content_groups` é legado congelado (não é lido nem escrito).
2. **Consulta**: `getActiveLibraryMessage` e `renderFromLibrary` em `src/server/relationship/message-library.server.ts:302,491`; mídia em `src/server/relationship/step-media.server.ts` (`loadStepContentBindings:75`).
3. **Versão ativa**: `select ... active = true` com índice único parcial `(scope, purpose) WHERE active` — é impossível haver duas versões ativas de texto. `publishLibraryVersion` desativa a anterior antes de inserir a nova.
4. **Campos**: `step_key/purpose` (etapa), fluxo vem do motor (`config.ts`), `version`, `title` (rótulo visível), `body` / `body_without_name` (variante com e sem nome), assinatura resolvida em tempo de render pelo executivo responsável (`resolveLeadExecutive`), `content_group`, `active`.
5. **Mais de um conteúdo ativo por etapa**: sim, e é exatamente o problema (§2).
6. **Regra determinística**: `selectFromPool` em `src/lib/relationship/content.ts:83` — ativos → prioriza não usados → menor `usage_count` → `last_used_at` mais antigo → `id`. Zero aleatoriedade.
7/8. **A Ação do Dia usa a mesma cadeia** (`getDailyActionMessageFn` → `prepareStepMessage` → `renderFromLibrary`), mas **não** usa `selectFromPool` para mídia: usa `loadStepContentBindings`, que é mais restrito. Aí nasce a divergência.

## 2. Causa exata do erro "Etapa 1 exige conteúdo do grupo E1"

9. **Causa comprovada em dados**: `relationship_step_content_bindings` tem **6 vínculos ativos para E1** (e 6 para E3, 3 para R2). `loadStepContentBindings` (`step-media.server.ts:75-82`) só devolve o conteúdo quando a etapa tem **exatamente um** vínculo ativo; com 6, devolve nada. Sem `contentName`, `renderMessageSpec` (`src/lib/relationship/messages.ts:471-476`) detecta o placeholder de conteúdo no corpo e bloqueia com o texto exibido. E4 tem 1 vínculo ativo — por isso E4 funciona e E1 não. Não é falta de cadastro: é excesso de vínculos ativos num caminho que não sabe rotacionar.
10. **Arquivos**: `src/server/relationship/step-message.server.ts` (`prepareStepMessage:54`, `resolveStepContent:37`), `step-media.server.ts:75`, `messages.ts:439-490`.
11. **Fonte diferente do motor?** O texto é o mesmo; a **seleção de mídia** é diferente — o motor usa `selectFromPool` (rotação), a leitura da Ação do Dia usa vínculo único.
12. **Fallback**: não existe — corretamente, o sistema mostra o motivo em vez de inventar texto.
13. **Word**: `src/lib/relationship/word-library.ts` existe apenas como semente/importação (`ensureLibrarySeed`, `importWordLibrary`). Não é lido em nenhum envio nem na Ação do Dia.
14. **Duplicidade de conteúdo**: não há texto duplicado — o TypeScript (`word-library.ts`, `HOMOLOGATION_MESSAGES`) é só semente da versão 1. A única duplicidade real é a de **vínculos de mídia** por etapa.
15. **Fonte única oficial**: `relationship_message_library` (texto ativo) + `relationship_contents` via `relationship_step_content_bindings` (mídia).
16. **Função a reutilizar**: `prepareStepMessage` já é a certa; o que falta é ela resolver mídia pela mesma rotação do motor (`selectFromPool`) em vez de exigir vínculo único.

## 3. Atualização automática quando a Biblioteca muda

17. **Sim, a arquitetura já permite**: toda leitura é `select` direto no Supabase, sem cache de servidor.
18/19. Bloqueio único: o caminho de mídia descrito em §2. Corrigido isso, publicar nova versão na Biblioteca já reflete na próxima abertura da Ação do Dia.
20. **Cache**: não há cache server-side; no cliente vale a política do React Query (a mensagem é buscada sob demanda ao abrir o card).
21. **localStorage de mensagens**: não existe para a Biblioteca. Os usos de `localStorage` no CRM são de UI (tema, presença, leitura de conversa).
22. **Conteúdo estático a abandonar**: nenhum em produção — `word-library.ts` e `HOMOLOGATION_MESSAGES` já estão restritos à semente/importação.

## 4. Nomenclatura para o executivo

23. **Título da ação**: `src/server/crm/daily-actions.server.ts:250` → `title: \`Mensagem ${item.step}\`` e `stepLabel: String(item.step)` (linha 242) — a fila usa a **chave crua**. O bloco de fechamento (linha 213) já usa `stepDisplayLabel`, prova de que a camada de rótulo existe e só não foi aplicada à fila.
24. **Texto do botão**: `src/components/crm/daily-actions-overlay.tsx:538` ("Ver mensagem completa") e :455 ("Executar primeiro contato (E0)").
25. **Como mudar sem tocar no técnico**: `src/lib/relationship/step-labels.ts` já é a camada oficial de apresentação (chave técnica nunca muda; já traduz E20→E6, E27→E7). Basta acrescentar ali o formato "Etapa N — Copiar mensagem" e usá-lo no título da fila e no botão do overlay.
26. **Correspondência atual**: E0=Primeiro contato; E1=Etapa 1; E3=Etapa 2 (segundo acompanhamento); E4=Etapa 3; E12=encerramento; E20→"E6"; E27→"E7". Ou seja, o número apresentado **não** é o número da chave — a numeração visível precisa ser definida na camada de rótulos, nunca inferida do código técnico.

## 5. Copiar mensagem

27/28. **Já existe**: `prepareStepMessage` (`src/server/relationship/step-message.server.ts:54`), exposta por `getDailyActionMessageFn` (`src/lib/crm/daily-actions.functions.ts:90`) e consumida pelo adaptador real (`daily-actions-real-adapter.ts:103`).
29/30. **Sim**: resolve nome do investidor (com variante sem nome quando não há nome utilizável), assinatura do **executivo responsável pelo lead**, link do Portal e conteúdo vinculado.
31. **Sim** — retorna exatamente a versão ativa da Biblioteca ou o motivo do bloqueio.
32/33. **Clipboard**: hoje o overlay exibe a mensagem, mas não há função de cópia. O menor ponto é um `navigator.clipboard.writeText(body)` no modal de mensagem do overlay — mudança puramente de interface.
34. **Menor implementação**: botão "Etapa N — Copiar mensagem" no overlay + a correção de mídia do §2 (senão o corpo vem nulo para E1/E3/R2).

## 6. Confirmação "Mensagem enviada?"

35/36/37. **Existe** `registerDailyActionMessageFn` → `registerDailyActionMessage` (`src/server/crm/daily-actions-log.server.ts:100`), que grava em `relationship_engine_log` (auditoria) e `crm_timeline` (leitura humana), com `outcome: "registrada"`. **Não envia nada** e não toca a fila.
38. **Identificador**: `leadId` do card (`crm_timeline.investor_id`) — nunca nome ou telefone.
39/40. **Duplicação**: como é log append-only, dois cliques geram dois registros. A conclusão real da fila é feita por `claimQueueItem`/`updateQueueItem` (`src/server/relationship/repository.server.ts:213-236`), com UPDATE condicional `status='PENDING'` (reserva atômica) e `upsert onConflict (scope,run_id,lead_id,step)` — esses sim são idempotentes.
41. **Forma mais segura**: no "SIM", além do log, marcar o item da fila via `updateQueueItem` (status executado + `executed_at` + `result`), reutilizando a mesma reserva atômica. No "NÃO", apenas registrar a tentativa e deixar o item PENDING.

## 7. Jornada / histórico / notas

42/43. Observações e pulos vão para `relationship_engine_log` + `crm_timeline`; **não há mais `localStorage`** em `src/components/crm/*`.
44/45/46. O Workspace lê a Jornada por `jornadaDoLead` → `loadLeadJourney` (`src/server/relationship/journey.server.ts:140`), cruzando `crm_timeline`, `crm_messages`, `relationship_message_sends`, `crm_cadence_tasks`, `portal_meetings`, `portal_journey_events`; o ID de ligação é `investor_id`.
47/48/49. **Divergência encontrada**: `RELATIONAL_TIMELINE_EVENTS` (`journey.server.ts:90-98`) lista apenas `lead_criado, contato_recebido, atividade_portal, nota_executivo, mudanca_coluna, oportunidade, primeiro_contato`. Os eventos `acao_do_dia_*` **não estão nessa lista**, então são classificados como "técnico" e não aparecem na aba relacional ("Notas do Executivo"). É por isso que o executivo sente que a Ação do Dia e o Workspace divergem.
50. **Menor alteração**: incluir os eventos `acao_do_dia_*` na whitelist relacional (uma linha), ou gravar a confirmação como `nota_executivo`/`primeiro_contato` conforme o caso.
51. **Confirmado**: a gravação já usa o ID real do card/lead.

## 8. E1 → próxima etapa

52. Fluxo `sem_resposta`: depois de E1 vem **E3** (2 dias úteis), depois E4 (3), depois E12 (5).
53. Cálculo em `src/lib/relationship/decide.ts` (`decideNextAction`/`referenceMoment`) + calendário operacional.
54. **Sim**, o motor agenda automaticamente em `relationship_queue` no próximo tique após a execução ser registrada.
55/56. **Confirmado**: a Ação do Dia deve apenas refletir a fila. Nenhuma sequência, fila ou relógio paralelo deve ser criado.

## 9. KPI Manager

57. `src/routes/f.executivo.kpi.tsx` (`KpiManagerPage`).
58/59. `kpiCollaborators()` (linha 101) → `visibleCollaborators()` (`src/lib/teams.ts:49`): para admin/diretora devolve `OPERATIONAL_EXECUTIVE_IDS` **filtrados por `status === "ativo"`**.
60. **Causa comprovada em dados, não em código**: `executive_user_status` tem `usr_thiago = ativo` e `usr_carlos, usr_larissa, usr_marton, usr_milton, usr_paulo, usr_talita = inativo` (todos marcados em 29/08 por Thiago Rodrigues). A aba "Geral" é fixa por role. Ou seja, o Administrador vê "Geral + Thiago" porque só Thiago está ativo.
61. Colaborador: `users.filter(u => u.id === session.userId)` — só o próprio.
62/63. Não há autorização de servidor: os dados de KPI vivem em `localStorage` (`src/lib/kpi-manager.ts:137-178`). A única regra de leitura ampla é `canAccessKpiOf` (`kpi-manager.ts:350`), usada pela IA, e o bloqueio de escrita na tela é apenas `isConsolidated`.
64/65/66. **Sim, dá para separar** — hoje elas nem existem separadamente.
67. **Menor alteração**: (a) reativar os executivos em `executive_user_status` ou permitir que a lista de leitura inclua inativos marcados como tal; (b) introduzir `canEditKpiOf(actor, target)` (só o próprio) chamada antes de gravar célula/reset/seed, mantendo `visibleCollaborators` para leitura.

## 10. Painel de Campanha

68. `src/routes/f.executivo.campanhas.tsx` + `src/components/executive/kpi/painel-campanhas.tsx`.
69. `collaborators` montado na própria rota (linhas 64-70) a partir de `OPERATIONAL_EXECUTIVE_IDS` filtrados por `status === "ativo"`.
70/71. **Mesma causa do KPI**: não há restrição por role (o código diz explicitamente que todos veem o mesmo ranking) — só Thiago aparece porque os demais estão `inativo` no banco.
72/73. Leitura: sem restrição de role. Gravação: só `personalSales` do próprio `session.userId`; o painel é somente leitura.
74. **Confirmado**: ampliar a leitura não amplia gravação nenhuma.
75. **Menor alteração**: corrigir o status dos executivos (dado) ou, se a intenção é manter inativos, incluir na lista do ranking os executivos operacionais independentemente do `status`, marcando visualmente os inativos.

## 11. Remarketing

76. `src/routes/f.remarketing.index.tsx`.
77. Layout limitado no próprio arquivo: header `max-w-6xl` (linha 49) e `<main className="mx-auto max-w-7xl px-6 pt-24 pb-16">` (linha 85); `remarketing-workspace.tsx` não impõe largura própria.
78. **Sim, é só visual.**
79. Trocar/remover os `max-w-*` (ex.: `max-w-screen-2xl` ou largura total com padding) e dar destaque ao cabeçalho "Ambiente de Remarketing — CRM operacional independente".
80. **Confirmado**: nenhuma regra de Remarketing é tocada.

## 12. Cenários (conceituais)

- **A** — E0 automática, lead em NOVOS: nada deve aparecer (hoje aparece a E0 órfã, causa da 1ª bateria). Cadência não conta.
- **B** — saiu de NOVOS, E1 não venceu: nada aparece; o item existe em `relationship_queue` com `due_at` futuro.
- **C** — E1 venceu: aparece um card de mensagem — hoje "Mensagem E1", desejado "Etapa 1 — Copiar mensagem".
- **D** — copiou e confirmou SIM: registro em `relationship_engine_log` + `crm_timeline` (e, corretamente, conclusão do item da fila); o motor então agenda E3 no próximo tique.
- **E** — confirmou NÃO: a etapa **não** é concluída; o item permanece PENDING e reaparece conforme as regras de janela/dia operacional.

## 13. Conclusão

- **A)** Fonte oficial: `relationship_message_library` (texto ativo) + `relationship_contents` via `relationship_step_content_bindings`.
- **B)** Erro E1: seis vínculos ativos na etapa e um resolvedor que só aceita um — `step-media.server.ts:75` devolve vazio e `messages.ts:475` bloqueia.
- **C)** Função a reutilizar: `prepareStepMessage` / `renderFromLibrary`, com a mídia resolvida por `selectFromPool`.
- **D)** Atualização automática: já é nativa (sem cache); resolvido o item B, publicar na Biblioteca basta.
- **E)** "Copiar mensagem — Etapa X": rótulo em `step-labels.ts` + título da fila em `daily-actions.server.ts:242,250` + botão/clipboard em `daily-actions-overlay.tsx`.
- **F)** "Mensagem enviada? SIM": `registerDailyActionMessage` + conclusão do item via `updateQueueItem` (reserva atômica já existente).
- **G)** Jornada: incluir `acao_do_dia_*` na whitelist relacional de `journey.server.ts:90-98`.
- **H)** KPI só com Thiago: `executive_user_status` com os outros seis `inativo`.
- **I)** Painel de Campanha: mesma causa de dados, não de permissão.
- **J)** Remarketing: `max-w-6xl`/`max-w-7xl` em `f.remarketing.index.tsx:49,85`.
- **K)** Arquivos numa entrega futura: `step-message.server.ts`, `step-media.server.ts` (ou uso de `selectFromPool`), `daily-actions.server.ts`, `daily-actions-overlay.tsx`, `step-labels.ts`, `daily-actions-log.server.ts`, `journey.server.ts`, `f.executivo.kpi.tsx`/`teams.ts`, `f.remarketing.index.tsx`.
- **L)** Riscos: baixos e localizados; o maior é confundir rótulo apresentado com chave técnica — a chave nunca deve mudar.
- **M)** **E0 permanece intocado.**
- **N)** **Nenhum novo motor, fila ou relógio.**
- **O)** **Não é necessário importar Word** para atualizar mensagens.
- **P)** Sequência recomendada: (1) rotação de mídia na leitura da mensagem; (2) filtro defensivo da E0 órfã; (3) rótulos "Etapa N — Copiar mensagem" + clipboard; (4) confirmação SIM/NÃO com conclusão da fila; (5) whitelist da Jornada; (6) visibilidade de KPI/Campanha; (7) layout do Remarketing.

Nenhuma implementação foi feita.

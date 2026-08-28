# Auditoria de Refino — E20 / Biblioteca / Word / Relacionamento

Somente leitura de código e banco. Nada foi alterado.

## 1 — E20 / Apresentação Digital (1–24)

1. **JÁ IMPLEMENTADO** — servidor completo.
2. `issueE20` em `src/server/relationship/e20.server.ts` (ponte: `emitirE20` em `src/lib/relationship/e20.functions.ts`).
3. `relationship_e20_occurrences` (acessos em `relationship_e20_accesses`). Hoje com **0 linhas**.
4. **JÁ IMPLEMENTADO** — 24 bytes de `crypto.getRandomValues` em base64url; coluna `token` única na prática por aleatoriedade.
5. **JÁ IMPLEMENTADO** — `expires_at = generated_at + 7 dias` calculado no servidor; validade conferida em `redeemE20`.
6. **PARCIAL** — a rota `src/routes/portal.convite.$token.tsx` existe e chama `resgatarConviteE20`; **NÃO FOI POSSÍVEL CONFIRMAR** por execução real porque não há nenhuma ocorrência emitida.
7. **JÁ IMPLEMENTADO** — o token sozinho resgata (sem login), devolvendo `leadId`.
8. **JÁ IMPLEMENTADO** — expirado marca `status='expirada'` e retorna motivo legível.
9. **JÁ IMPLEMENTADO** — anterior recebe `status='encerrada'`, `close_reason='encerrada_por_nova'`.
10. **JÁ IMPLEMENTADO** — nada é apagado; ocorrência antiga permanece com histórico e acessos.
11. **PARCIAL** — não há trava de concorrência (dois cliques simultâneos podem criar duas), mas há substituição determinística e a trava de instância em `openInstance`.
12. **JÁ IMPLEMENTADO** — `openInstance` bloqueia após OPORTUNIDADE (terminal).
13. **JÁ IMPLEMENTADO** — a E20 abre uma NOVA instância de cadência (`openedReason='e20_emitida'`), encerrando a anterior.
14. Ocorrência independente com chave de conteúdo `E20` na Biblioteca — não é etapa da `FLOW_SEQUENCE` do motor.
15. **PENDENTE** — não há teste automatizado de E20 (testes existentes: `auth-bearer`, `investor-profile`, `lead-state`, `sync-bus`, `whatsapp-number`, `workspace-permissions`).
16. **PENDENTE** — nenhum componente chama `emitirE20`.
17. `src/components/executive/workspace/investor-profile-view.tsx` (ficha do investidor); secundariamente a ficha canônica `src/routes/f.executivo.investidores.$id.tsx`.
18. **PENDENTE** (depende do botão) — a server fn já exige `leadId`.
19. **JÁ IMPLEMENTADO** — emissão só no servidor, autenticada (`requireSupabaseAuth`).
20/21/22/23/24. **PENDENTE** — não há exibição de E20 ativa, cópia de URL, cópia da mensagem, nem distinção visual ativa/expirada/substituída. O servidor já devolve tudo isso (`occurrence.linkUrl`, `message.body`, `status`, `close_reason`) por `listarOcorrenciasE20`.

## 2 — Acesso / rastreamento (25–36)

25. **JÁ IMPLEMENTADO** — `first_opened_at`.
26. **JÁ IMPLEMENTADO** — toda tentativa entra em `relationship_e20_accesses` com `outcome` (ok/expirado/substituido).
27. **JÁ IMPLEMENTADO** — `open_count`.
28. **JÁ IMPLEMENTADO** — `first_opened_at`.
29. **PARCIAL** — não existe coluna "último acesso"; é derivável de `max(accessed_at)` em `relationship_e20_accesses`.
30. **PENDENTE** na interface; os dados já saem na jornada (`journey.server.ts`, entradas `kind:"e20"` e `kind:"acesso_link"`).
31. **PENDENTE** — não há presença do investidor no Portal. `src/lib/crm/presence.ts` só reflete presença informada pela integração de WhatsApp (hoje sempre offline).
32. **PENDENTE** — sem timeout de inatividade/online.
33. **JÁ IMPLEMENTADO** — abertura aparece na jornada como "Acesso ao link do convite", camada `relacional`.
34. **PARCIAL** — a abertura NÃO consta na lista branca `INVESTOR_ACTIVITY_EVENTS` (`src/lib/events/investor-activity.ts`), logo hoje não conta como atividade real.
35. Hoje **não** altera NOVO/EM ANDAMENTO (consequência do item 34).
36. Risco baixo hoje; passa a existir se a abertura for adicionada ao barramento de eventos sem entrar deliberadamente na lista branca.

## 3 — Nome / personalização (37–44)

37. **JÁ IMPLEMENTADO** — `issueE20` lê `portal_leads.name` e passa como `rawInvestorName`.
38. `portal_leads.name`.
39. **JÁ IMPLEMENTADO** — `normalizeName`/`firstName`/`displayName` em `src/lib/relationship/names.ts`, com validação por base de nomes (`name-base.ts`).
40. **JÁ IMPLEMENTADO** — tokens inválidos ("lead", "teste", "contato", números) são descartados.
41. Fallback: `NEUTRAL_TREATMENT = "caro investidor"`.
42. **JÁ IMPLEMENTADO** — renderização 100% no servidor (`renderFromLibrary` + `renderMessageSpec`).
43. **JÁ IMPLEMENTADO** — `recordMessageSnapshot` grava `rendered_body`, `template_body`, `library_version`, `investor_name_used`.
44. **Não** — snapshot é imutável.

## 4 — Executivo responsável (45–55)

45. **JÁ IMPLEMENTADO** na E20 e no dispatcher.
46. `resolveLeadExecutive` em `src/server/relationship/executive-identity.server.ts` (contato público: `resolveExecutiveContact`).
47/48/49. **JÁ IMPLEMENTADO** — `executive_profiles.name`, `role_title`, `whatsapp`.
50. **PENDENTE (bloqueador)** — 7 perfis, **0** com WhatsApp preenchido.
51. **JÁ IMPLEMENTADO** — `src/lib/whatsapp-number.ts` (`normalizeWhatsappNumber`, com teste próprio).
52/53. **PARCIAL** — o motor e a E20 não usam fallback; componentes públicos ainda usam `WHATSAPP_NUMBER = 5517997727337` de `src/lib/journey-data.ts` em `components/journey/contact-form.tsx`, `components/portal/portal-final-cta.tsx`, `components/simulator/simulator-modal.tsx`, `components/shared/executive-contact-dialog.tsx`, `routes/manual/$chapter.tsx`.
54. **JÁ IMPLEMENTADO** — snapshot da E20 grava assinatura do responsável e, à parte, quem emitiu.
55. **Sim, fora da E20**: a E0 (`src/server/crm/first-contact.server.ts` + `automation.server.buildWelcomeMessage`) não consulta `resolveLeadExecutive`; sem nome informado no cadastro, sai com o padrão.

## 5 — Biblioteca / Word (56–76)

56. `relationship_message_library` (escopo `production`, 20 linhas, todas versão 1).
57. `getActiveLibraryMessage` → `renderFromLibrary` (`src/server/relationship/message-library.server.ts`).
58. **PENDENTE** — E20 existe como slot, `active=false`, `body` vazio.
59. **Sim** — E20, E27, FINALIZACAO são slots vazios/inativos (por desenho, `PENDING_TEXT_STEPS`).
60/61. **PENDENTE** — sem conteúdo.
62. **NÃO** — não há texto E20/E27/FINALIZACAO hardcoded; `HOMOLOGATION_MESSAGES` não os define.
63. **PENDENTE** — não há importação de Word; só `publishLibraryVersion` (texto a texto, via `message-library-panel.tsx`).
64. **PARCIAL** — existem `notes`, `code`, `created_by_name`; não há campo de origem/hash do documento.
65. **PENDENTE** — sem controle de lote/versão de importação.
66. Cria nova versão (`version+1`), nunca sobrescreve.
67. **JÁ IMPLEMENTADO** — 9 snapshots em `relationship_message_sends` permanecem intactos.
68. **PARCIAL** — a versão ativa anterior é desativada sem comparação de conteúdo; reimportar o mesmo texto gera versão duplicada silenciosa.
69. **JÁ IMPLEMENTADO** — uma versão ativa por etapa.
70. Índices: `relationship_message_library_active_step` (scope, step_key) WHERE active e `relationship_message_library_active_idx` (scope, purpose) WHERE active.
71. **Sim** — `relationship_content_groups` (22 linhas) e `relationship_step_content_bindings` (22 linhas).
72. **NÃO** em leitura — tratada como legado congelado.
73. **Sim** — fonte real (`loadStepContentMap`/`loadStepContentBindings` em `step-media.server.ts`).
74. `relationship_step_content_bindings`.
75. **NÃO FOI POSSÍVEL CONFIRMAR** equivalência linha a linha; a duplicidade relevante é OUTRA: há múltiplos vínculos ativos na MESMA etapa com `position=0` (E1×5, E3×6, R2×4, V3×2) e `loadStepContentBindings` só resolve etapas com um único conteúdo — hoje essas quatro etapas ficam sem conteúdo explícito.
76. Preservar `relationship_step_content_bindings`.

## 6 — E0/E1/E2/E3/E4 (77–89)

77. Biblioteca: E0, E0_V1, E1, E3, E4, E12 (+ V3, V4, R1–R3, RE0–RE3, RF0, RF1, E20, E27, FINALIZACAO).
78. Motor (`STEPS` em `src/lib/relationship/config.ts`): E0, E0_V1, E1, E3, E4, E12, E30, V3, V4, R1–R3, RE0–RE3, RF0, RF1.
79. **Sim** — E30 só no motor (desativada); E20/E27/FINALIZACAO só na Biblioteca.
80. `E0 → E1 → E3 → E4 → E12 (→ E30)`. **E2 não existe.**
81. Somente a cadência de LIGAÇÕES (`crm_cadence_tasks.step_day`, `src/lib/crm/cadence.ts`).
82. **Sim** — `step_key` é a chave do motor, da Biblioteca e dos vínculos.
83. **Sim, um caso**: o texto real da E0 enviada vem de `buildWelcomeMessage` (`src/server/crm/automation.server.ts`), não da Biblioteca.
84. **Sim** — `registerFirstContact` é a única função, mas é chamada por `lead-intake.server.ts`, `portal-first-contact.server.ts` e `first-contact-queue.server.ts`; além disso o motor tem a etapa E0 própria.
85. **NÃO** — `E0_SIMULATION_ENABLED` não existe mais em código; permanece só o rótulo histórico `LEGACY_E0_SIMULATION_LABEL` (`src/lib/crm/e0-simulation.ts`).
86. **PARCIAL** — apenas a decisão única `executionMode()`; o `virtualTemplates` do motor deriva dela.
87. Autoridade: `resolveExecutionMode` (`src/lib/relationship/execution-mode.ts`) via `src/server/relationship/execution-mode.server.ts`, que decide pelo AMBIENTE antes das credenciais.
88. Risco baixo.
89. Idempotência por chave determinística: `crm_messages.id = msg_e0_<leadId>` (conflito 23505 tratado) e evento do motor `e0_<leadId>`.

## 7 — WhatsApp / Meta / auto-reply (90–105)

90. **PARCIAL** — mensagem comum segue o caminho único (`parseInboundMessage` → `handleInboundMessage`); antes dela o webhook trata Remarketing e confirmações (`parseWebhookReply`).
91. **JÁ IMPLEMENTADO** — `findLeadByPhone` casa pelos últimos dígitos de `portal_leads.whatsapp`.
92. **JÁ IMPLEMENTADO** — id `msg_in_<wamid>`.
93. **JÁ IMPLEMENTADO** — `decideAutoReply` chamado por `handleInboundMessage`.
94. `R1` (`AUTO_REPLY_STEP`).
95. **Sim** — R1 tem versão ativa e 1 conteúdo vinculado.
96. Sem conteúdo ativo, `renderFromLibrary` bloqueia com motivo; a mensagem recebida é registrada e nada é respondido.
97. **JÁ IMPLEMENTADO** — `resolveMetaWindow` (`src/lib/relationship/meta-window.ts`).
98. **JÁ IMPLEMENTADO** — fora da janela o texto livre é bloqueado.
99. **PARCIAL** — existe a distinção (`templatePurpose`, `requireOfficialTemplate`, `virtualTemplates`), mas `relationship_template_bindings` está **vazia**: em produção, etapa fora da janela é bloqueada em vez de sair por template.
100. **Sim** — `src/routes/f.crm.index.tsx` envia texto livre via `sendWhatsappText`.
101. **Sim** — `src/lib/whatsapp.functions.ts` (`sendWhatsappText`, `dispatchWhatsappTemplate`, `sendWhatsappMedia`), `src/lib/crm/whatsapp-official.ts` e o motor de Remarketing.
102. Hoje: apenas PREPARADA. `issueE20` gera ocorrência + snapshot, mas **não chama o canal**. Decisão de produto pendente (recomendação: manter cópia manual nesta etapa).
103. Hoje sim no texto devolvido: `body = texto + "\n\n" + link`.
104. **PARCIAL** — o registro existe como snapshot (`relationship_message_sends`, `origin='executivo'`) e como entrada de jornada; não há confirmação de "enviei" pelo executivo.
105. **NÃO** — a E20 não aciona a Meta em nenhum caminho atual.

## 8 — E27 / finalização (106–112)

106. **PARCIAL** — existe o dado `checkpoint_due_at`, não existe executor.
107. Sim, por definição: `checkpoint_due_at = expires_at` (7 dias).
108. **PARCIAL** — existe `finalization_due_on`; sem executor.
109. Hoje só vencimento; resposta/abertura não entram na regra.
110. **JÁ IMPLEMENTADO** no cálculo — `nextBusinessDay` pula sábado e domingo; janelas gerais em `RELATIONSHIP_CONFIG`.
111. **JÁ IMPLEMENTADO** — sem versão ativa na Biblioteca nada é enviado.
112. **NÃO** — OPORTUNIDADE é terminal (`openInstance` bloqueia).

## 9 — Ação do Dia / CRM / Workspace (113–124)

113. **PENDENTE** — o agregador (`src/server/crm/daily-actions.server.ts`) lê apenas `portal_meetings`, `workspace_agenda_events`, `relationship_queue` e a cadência de ligações.
114. Sim — E20 vencendo/expirada é ação legítima, respeitando a precedência AGENDA > REUNIÃO > MENSAGEM > LIGAÇÃO.
115/116/117. **PENDENTE** — nenhuma dessas gera ação hoje.
118. **JÁ IMPLEMENTADO** — geração, encerramento e acessos aparecem na jornada (camada relacional).
119. Baixo — a lista branca de atividade real já isola eventos administrativos.
120. Sim, de forma legítima: a E20 abre nova instância de cadência e encerra a anterior. Não altera NOVO/EM ANDAMENTO.
121/122. **PENDENTE** na interface (dados prontos no servidor).
123. **NÃO** — não há segunda implementação dessas informações.
124. **PARCIAL** — o CRM legado (`f.crm.index.tsx`), a cadência de ligações e o primeiro contato legado ainda operam fora do motor.

## 10 — Regressão / próximo comando (125–141)

125. Alterar: `src/server/relationship/message-library.server.ts` (importação/versionamento do Word), `src/lib/relationship/library.functions.ts`, `src/components/executive/message-library-panel.tsx`, `src/components/executive/workspace/investor-profile-view.tsx` (UI da E20), `src/server/crm/daily-actions.server.ts` + `src/lib/crm/daily-actions.ts` (ações de E20), `src/components/crm/daily-actions-overlay.tsx`, `src/server/relationship/step-media.server.ts` (higiene de vínculos), `src/server/crm/first-contact.server.ts` (E0 pela Biblioteca).
126. Não alterar: `src/lib/relationship/{machine,engine,decide,calendar,meta-window,execution-mode,names}.ts`, `src/server/relationship/{dispatch,repository,scheduler,e20,inbound,auto-reply,executive-identity}.server.ts`, `src/server/greensales.server.ts`, `src/server/lead-guard.server.ts`, `src/routes/api/public/whatsapp/webhook.ts`, `src/integrations/supabase/*`, e todo o Portal dos Leads.
127. Nenhuma obrigatória. Opcionais: coluna de origem/hash do conteúdo importado em `relationship_message_library`; ajuste de `position`/desativação dos vínculos duplicados; preenchimento de `executive_profiles.whatsapp` (dado, não schema).
128. Não modificar: `relationship_message_sends` (9 snapshots), `crm_messages`/`crm_timeline` históricos, `portal_leads` reais, `relationship_cadences` (59) e `relationship_queue` (26), logs de guarda.
129. Sem regressão: idempotência da E0, blindagem de delete do Portal, janela operacional §16, isolamento homologação x produção, jornada relacional x auditoria técnica, semântica NOVO/EM ANDAMENTO, precedência da Ação do Dia.
130. **Sim, por desenho** — E20 encerra a instância vigente e abre outra; precisa estar explícito na UI.
131. Hoje não há conflito (E20 nem aparece); ao entrar, precisa respeitar "um lead = uma ação visível".
132. Não hoje; passaria a existir se a abertura do convite for adicionada à atividade real sem decisão explícita.
133. Não — OPORTUNIDADE bloqueia a emissão.
134. Não — snapshots são independentes da Biblioteca.
135. **Sim** — reimportar sem comparação cria versões repetidas e ATIVA automaticamente E20/E27/FINALIZACAO (`active = body não vazio`).
136. Baixo no motor; o risco real está nos caminhos paralelos (CRM manual + motor sobre o mesmo lead).
137. **Sim, na E0** (item 55).
138. **Sim** — componentes públicos com número fixo e perfis sem WhatsApp.
139. **Não** — `executionMode` decide pelo ambiente antes das credenciais; homologação nunca chama a Meta.
140. Baixo — guardas de DELETE/TRUNCATE ativas; risco só existiria em migração de limpeza.
141. **Sim**, se a importação do Word criar tabela/arquivo próprio em vez de publicar em `relationship_message_library`, ou se a UI da E20 montar texto próprio em vez de usar `issueE20`.

---

## Resumo

**A) Pronto (não reconstruir):** motor puro e máquina de estados; `config.ts`; fila + tick por cron; Biblioteca versionada com índice de versão ativa; snapshot imutável; backend completo da E20 (token, 7 dias, substituição, acessos, contadores); janela de 24h da Meta; identidade do executivo; execution-mode; webhook inbound com idempotência; jornada relacional x auditoria técnica; normalização de nome e de WhatsApp.

**B) Parcial:** vínculo etapa↔conteúdo (duplicidade que anula E1/E3/R2/V3); E0 com texto fora da Biblioteca e sem identidade do responsável; distinção texto livre x template (tabela de templates vazia); registro do envio manual; "último acesso" derivável mas não exposto.

**C) Pendente:** UI da E20 (gerar, copiar link, copiar mensagem, estados); E20 na Ação do Dia; executor de E27 e FINALIZACAO; importação do Word; WhatsApp dos executivos; presença/online do investidor; testes de E20.

**D) Decidir antes de implantar:** E20 é sempre cópia manual ou pode ser enviada pelo motor? E0/E0_V1 passam a ler a Biblioteca? FINALIZACAO é etapa ou só grupo de conteúdo? Abrir o convite conta como atividade real do investidor? Importar o Word ativa a etapa ou publica inativa para aprovação?

**E) O Word precisa fornecer:** por etapa — `step_key` exato, título, texto integral com variáveis (`{{nome_investidor}}`, `{{nome_executivo}}`, `{{link_portal}}`, `{{conteudo_*}}`), tipo de botão (`portal`/`content`/nenhum), grupo de conteúdo e se usa o nome do investidor. Cobertura: E0, E0_V1, E1, E3, E4, E12, V3, V4, R1, R2, R3, RE0–RE3, RF0, RF1, E20, E27, FINALIZACAO (E30 se for ativada).

**F) Fonte única das mensagens:** `relationship_message_library`, sempre por `publishLibraryVersion`.

**G) Fonte única do vínculo etapa↔conteúdo:** `relationship_step_content_bindings` (com no máximo um conteúdo ativo por etapa, ou rotação explícita por `position`).

**H) Fluxo definitivo da E20:** botão na ficha → `emitirE20` (servidor) → encerra a anterior, cria ocorrência de 7 dias, renderiza da Biblioteca com o responsável e grava snapshot → UI mostra status, link e mensagem para cópia → abertura registrada em `relationship_e20_accesses` e visível na jornada → checkpoint E27 no vencimento → finalização no dia útil seguinte.

**I) Fluxo definitivo do WhatsApp:** um único ponto de saída (`dispatch.server.ts`), precedido por ambiente (`executionMode`) → identidade do responsável → Biblioteca → janela de 24h → texto livre ou template oficial → snapshot. Envio manual do CRM deve convergir para esse mesmo registro.

**J) Fluxo definitivo do auto-reply:** webhook → identificação por telefone → idempotência por `wamid` → `decideAutoReply` → R1 pela Biblioteca dentro da janela de 24h → snapshot; sem conteúdo ativo, apenas registra a entrada.

**K) Riscos de regressão:** reimportação criando versões duplicadas e ativando E20/E27/FINALIZACAO sem decisão; trocar a fonte de texto da E0 e mudar a mensagem em produção; higienizar vínculos e deixar etapas sem conteúdo; E20 concorrendo com a cadência na Ação do Dia; renomear `step_key` e quebrar snapshots; envio duplo pelo CRM manual e pelo motor.

**L) Ordem técnica ideal do próximo comando:**
1. Preencher `executive_profiles.whatsapp` (destrava identidade).
2. Higienizar `relationship_step_content_bindings` (um conteúdo ativo por etapa).
3. Importação do Word em `publishLibraryVersion` com comparação de conteúdo e política explícita de ativação.
4. E0/E0_V1 passam a ler a Biblioteca e a assinar com o responsável real.
5. UI da E20 na ficha (gerar, copiar link, copiar mensagem, estados, primeira abertura e último acesso).
6. E20/E27 na Ação do Dia respeitando a precedência.
7. Executor de E27/FINALIZACAO, somente com texto oficial ativo.
8. Testes de E20 (emissão, expiração, reemissão) e de importação do Word.

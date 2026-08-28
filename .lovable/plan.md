# Auditoria Final — Etapa 2 — Motor de Relacionamento

Levantamento do estado REAL do código e do banco. Nada foi alterado. Legenda: **[EXISTE]**, **[PARCIAL]**, **[NÃO EXISTE]**, **[NÃO CONFIRMADO]**.

## Bloco 1 — Arquitetura atual (1–15)

1. Motor oficial **[EXISTE]**: `src/lib/relationship/engine.ts` + `machine.ts` (puros), montado em produção por `src/server/relationship/engine.server.ts` (`productionEngine()`).
2. Participam: `lib/relationship/{engine,machine,config,decide,calendar,content,messages,names,origin,ports,types,meta-window,execution-mode}.ts` e `server/relationship/{engine,repository,dispatch,scheduler,lead-context,guard,execution-mode,message-library,step-media,step-message,instances,inbound,auto-reply,e20,journey,audit}.server.ts`.
3. Fonte oficial de tarefas do motor: `relationship_queue` (26 linhas) + estado em `relationship_cadences` (59). Ligações manuais vivem em paralelo em `crm_cadence_tasks` (5 linhas) — fonte distinta, não é o motor.
4. Fonte oficial das mensagens: `relationship_message_library` (versão ativa por `step_key`), lida por `renderFromLibrary`. Semente vem de `HOMOLOGATION_MESSAGES` (`lib/relationship/messages.ts`) apenas na criação da versão 1.
5. Mecanismos paralelos **[EXISTE]**: (a) cadência de ligações `lib/crm/cadence.ts` + `server/crm/cadence.server.ts`; (b) primeiro contato `server/crm/first-contact.server.ts` (texto de `automation.server.buildWelcomeMessage`, NÃO da Biblioteca); (c) motor de Remarketing (`server/remarketing/*`, isolado); (d) envio manual pelo CRM.
6. Sim **[EXISTE]**: `src/routes/f.crm.index.tsx:726` chama `sendWhatsappText` (server fn de `lib/whatsapp.functions.ts`) direto ao canal; `lib/crm/whatsapp-official.ts` chama `dispatchWhatsappTemplate`; `automation.server.ts:144` envia boas-vindas legadas.
7. Arquivos legados: `lib/whatsapp.functions.ts`, `lib/crm/whatsapp-official.ts`, `lib/crm/messages.ts` (histórico local), `server/crm/automation.server.ts`, `lib/crm/e0-simulation.ts` (rótulo histórico), `server/crm/first-contact.server.ts`.
8. Duplicidade real: E0 é gerada FORA do motor (first-contact) e só depois "avisada" ao motor via evento `FIRST_CONTACT_SENT`; o texto da E0 enviada vem de `automation.server`, enquanto E0 na Biblioteca tem versão ativa própria — dois textos possíveis para a mesma etapa.
9. Dispatch único do motor: `productionDispatcher.send` em `dispatch.server.ts`. Não é único do sistema.
10. Sim (ver 6): CRM manual, template oficial, boas-vindas legadas e Remarketing não passam por `dispatch.server.ts`.
11. Scheduler **[EXISTE]**: `cron.job` roda `POST /api/public/crm/sync` a cada minuto → `runScheduledLeadSync` → `runRelationshipTick()` (`scheduler.server.ts`). Também `remarketing-engine`, `portal-backup-*`.
12. Sim: `/api/public/whatsapp/webhook` → `handleInboundMessage` pode gerar resposta automática (etapa R1) e alterar contadores da cadência.
13. Triggers relacionados a mensagens **[NÃO EXISTE]**. Só triggers `updated_at` e as guardas de DELETE/TRUNCATE em `portal_leads`/`crm_leads`.
14. Sim: server fns `sendWhatsappText`, `dispatchWhatsappTemplate`, `sendWhatsappMedia`, `simulateWhatsappReply` (`lib/whatsapp.functions.ts`) enviam sem passar pelo motor. Sem Edge Functions.
15. Arquitetura sugerida: motor puro (decide) + repositório + dispatcher único + Biblioteca versionada + snapshot imutável, com cron por tick. Falta consolidar E0 e o envio manual do CRM dentro dessa arquitetura.

## Bloco 2 — Mapa das etapas (16–35)

16. Biblioteca (banco, 20 linhas, todas versão 1): E0, E0_V1, E1, E3, E4, E12, V3, V4, R1, R2, R3, RE0, RE1, RE2, RE3, RF0, RF1 (ativas) + E20, E27, FINALIZACAO (inativas, corpo vazio).
17. Motor (`STEPS` em `config.ts`): E0, E0_V1, E1, E3, E4, E12, E30, V3, V4, R1, R2, R3, RE0, RE1, RE2, RE3, RF0, RF1.
18. Tarefas de cadência (`crm_cadence_tasks`): L1–L4 (ligações) e M1+ via `stepKey(channel, step)`; coluna `step_key` existe e é preenchida desde a última migração.
19. Banco: `relationship_message_library.step_key`, `relationship_step_content_bindings.step_key`, `relationship_queue.step`, `relationship_message_sends.step`, `crm_cadence_tasks.step_key/step_day`.
20. Diferenças: E30 existe no motor e NÃO na Biblioteca (proposital, `E30_ENABLED=false`); E20/E27/FINALIZACAO existem na Biblioteca e NÃO como etapa do motor (E20 é ocorrência, FINALIZACAO é `contentGroup`); L*/M* só na cadência de ligações.
21. `step_day` **[EXISTE]** em `crm_cadence_tasks`.
22. `step_key` **[EXISTE]** em `crm_cadence_tasks`, `relationship_message_library`, `relationship_step_content_bindings`.
23. Autoridade: `step_key` (textual) para relacionamento; `step_day` permanece só como histórico/ordenação das ligações.
24. Sim — L1 manual, L2–L4 automáticas (`lib/crm/cadence.ts`).
25. Sim — prefixo `M` para canal mensagem no mesmo helper `stepKey`.
26. Sim — E0, E0_V1, E1, E3, E4, E12 (não existem E2 nem E5–E11).
27. Significados no código: E0 primeiro contato; E0_V1 primeiro contato de quem veio do Portal; E1 segundo contato (conteúdo E1); E3 terceiro contato (conteúdo E3); E4 quarto contato, objetivo, sem conteúdo; E12 encerramento (conteúdo FINALIZACAO); E30 recontato tardio (desativado); V3/V4 fluxo de visualização; R1–R3 reengajamento; RE0–RE3 reentrada; RF0/RF1 relacionamento frio; E20 convite ao Portal; E27 checkpoint de 7 dias.
28. Divergência: Biblioteca usa `FINALIZACAO` como etapa, o motor usa `FINALIZACAO` como grupo de conteúdo de E12/RE3/RF1. Interface chama E20 de "convite/Apresentação Digital".
29. Etapa duplicada **[NÃO EXISTE]** (índice de versão ativa por `step_key`).
30/31. Sem conteúdo/corpo vazio: E20, E27, FINALIZACAO (`body` = 0 caracteres, `active=false`).
32. Inativas: as três acima. E30 sem linha na Biblioteca.
33. **[NÃO CONFIRMADO]** — todas as 17 ativas correspondem a etapas do fluxo; não há indicação no código de etapa ativa indevida.
34. Sim: `step_key` já usado em 9 snapshots (`relationship_message_sends`) e nos vínculos — renomear quebraria histórico.
35. Chave estável oficial: `step_key` textual (E0, E0_V1, E1, E3, E4, E12, V3, V4, R1–R3, RE0–RE3, RF0/RF1, E20, E27, FINALIZACAO).

## Bloco 3 — E0 (36–50)

36. E0 é registrada por `registerFirstContact` (`server/crm/first-contact.server.ts`): valida cutover, valida janela `isE0NightWindow`, insere `crm_messages` id `msg_e0_<lead>`, grava timeline e depois avisa o motor (`FIRST_CONTACT_SENT`).
37. Sim, automática na entrada do lead.
38. Disparada por: `lead-intake.server.ts` (entrada GreenSales/canais), `portal-first-contact.server.ts` (Portal) e `first-contact-queue.server.ts` (retomada de fila).
39. Sim — três chamadores, mas todos usam a MESMA função (sem lógica paralela).
40. **[PARCIAL]** — a decisão é única (`execution-mode`), mas o rótulo legado `LEGACY_E0_SIMULATION_LABEL` continua existindo para ler histórico e comentários antigos ainda citam `E0_SIMULATION_ENABLED`.
41. `executionMode()` → `isProductionRequest()` (host) + `isTestLead`.
42. `E0_SIMULATION_ENABLED` **[NÃO EXISTE]** como constante em uso; só menções em comentários.
43. Sim: host de homologação (`lib/environment.ts` / `environment.server.ts`) e flag `portal_leads.is_test`.
44. Autoridade: `resolveExecutionMode` (`lib/relationship/execution-mode.ts`) via `execution-mode.server.ts`.
45. Risco baixo: id determinístico `msg_e0_<lead>` com conflito 23505 tratado.
46/47. Idempotência atômica pela PK de `crm_messages` (`msg_e0_<leadId>`) e evento do motor `e0_<leadId>`.
48/49. **[PARCIAL]** — `registerFirstContact` recebe `executiveName/executiveSlug` de quem chama (cadastro do lead), mas NÃO usa `resolveLeadExecutive`, ao contrário do dispatcher e da E20. Sem nome informado, o texto de `buildWelcomeMessage` cai no padrão do `automation.server`.
50. Resolvido em `server/crm/automation.server.ts` (`buildWelcomeMessage`), não em `executive-identity.server.ts`.

## Bloco 4 — E1/E2/E3/E4 e demais (51–65)

51. `FLOW_SEQUENCE.sem_resposta = E0 → E1 → E3 → E4 → E12 → E30`. Não existe E2.
52. Sim, texto próprio por `step_key` na Biblioteca (E1 468, E3 482, E4 444, E12 906 caracteres).
53. **[PARCIAL]** — mídia vem de `relationship_step_content_bindings`; hoje há 22 vínculos ativos, com MÚLTIPLOS por etapa (E1×5, E3×6, R2×4, V3×2) e todos com `position = 0`. `loadStepContentBindings()` só resolve etapa com UM conteúdo, então E1, E3, R2 e V3 hoje ficam sem conteúdo explícito.
54. URL própria: sim, via `relationship_contents.url` do vínculo (17 conteúdos cadastrados).
55/56/57. Regra e intervalo por etapa em `STEPS` (`businessDaysAfterReference`) + janelas em `RELATIONSHIP_CONFIG` (Seg–Sex 07–22, Sáb 07–12, E0 até 22:30). Fonte única em `lib/relationship/config.ts`.
58. Sim, apenas nas LIGAÇÕES (`crm_cadence_tasks.step_day` / `CADENCE_CONFIG.offsets`).
59. Sim, todo o motor de relacionamento é por `step_key`.
60. **[PARCIAL]** — E27 e FINALIZACAO aparecem na Biblioteca mas não são etapas executáveis do motor.
61. Sim — E30 é executável (se ativada) e não tem linha na Biblioteca; E0_V1 é executável e não tem UI própria.
62. Sim — o texto real da E0 enviada vem de `automation.server.buildWelcomeMessage` (código), não da Biblioteca.
63/64. `lib/relationship/messages.ts` **[EXISTE]** e é usado como semente da Biblioteca e pelo simulador de homologação; `lib/crm/messages.ts` é histórico local do CRM. Nenhuma etapa depende de `messages.ts` em envio real, exceto o caminho da E0 (via `automation.server`).
65. Sim, a Biblioteca já substitui — falta apenas migrar a E0 e desativar o texto legado.

## Bloco 5 — Word oficial (66–80)

66. Ponto de entrada: `publishLibraryVersion` (`message-library.server.ts`), exposto por `lib/relationship/library.functions.ts` e pelo painel `message-library-panel.tsx`.
67. Importação de arquivo Word **[NÃO EXISTE]** — só publicação texto a texto.
68. **[NÃO EXISTE]** atualização a partir de fonte externa.
69/70. Campo de origem **[PARCIAL]** — existem `notes`, `created_by_name` e `code`; não há campo `source`/`origin` dedicado ao Word.
71. Controle de versão de importação **[NÃO EXISTE]**; existe versionamento por mensagem (`version`, `supersedes_id`).
72/73. Nova versão: insere linha nova com `version+1`, desativa a anterior, nunca sobrescreve.
74/75. Sim — o histórico usa `relationship_message_sends` (snapshot com `rendered_body`, `template_body`, `library_version`); publicar nova versão não toca nesses 9 registros.
76. Sim: `publishLibraryVersion` não compara conteúdo — reimportar o mesmo Word cria versões idênticas repetidas.
77. Proteção contra duplicação **[NÃO EXISTE]**.
78. Sim, uma versão ativa por etapa (`active=true`), garantida pelo fluxo e por índice.
79. **[NÃO CONFIRMADO]** — o nome do índice único não foi verificado nesta rodada; o comportamento está garantido em código.
80. Sim: E20, E27 e FINALIZACAO com `body` vazio.

## Bloco 6 — Etapa ↔ conteúdo (81–92)

81. `relationship_step_content_bindings` (colunas: `scope, step_key, content_id, active, position`).
82. `relationship_content_groups` **[PARCIAL]** — 22 linhas no banco, citada apenas como legado congelado em `step-media.server.ts`/`homologation.server.ts` e na lista de reset; nenhuma leitura ativa encontrada.
83. Sim, é a fonte usada por `loadStepContentMap`, `loadStepContentBindings`, `prepareStepMessage` e o dispatcher.
84. Simultaneamente **[NÃO]** em leitura; as duas apenas coexistem com dados.
85. Autoridade: `relationship_step_content_bindings`.
86. Sim: 22 vínculos e 22 grupos.
87. **[NÃO CONFIRMADO]** sem comparar `content_id` linha a linha (não feito para não induzir conclusão errada).
88. Não há código que leia as duas para decidir envio.
89. Impacto: baixo em leitura; alto em higiene — a duplicidade de vínculos por etapa (E1, E3, R2, V3) é o que hoje anula o conteúdo dessas etapas.
90. `relationship_step_content_bindings`.
91. Migration de consolidação **[NÃO É OBRIGATÓRIA]** para funcionar; é recomendável desativar vínculos redundantes e/ou definir `position` distinta.
92. Histórico depende de `relationship_message_sends.content_id`, não das tabelas de vínculo.

## Bloco 7 — E20 (93–112)

93. Backend completo, UI ausente, zero ocorrências emitidas (`relationship_e20_occurrences` = 0 linhas) e texto da Biblioteca inativo.
94/95. Sim: `issueE20` (`server/relationship/e20.server.ts`), exposta como server fn `emitirE20` (`lib/relationship/e20.functions.ts`).
96. Sim: `redeemE20` / `resgatarConviteE20`.
97. Sim, 7 dias corridos por emissão (`SEVEN_DAYS_MS`, `expires_at`).
98. Sim: 24 bytes de `crypto.getRandomValues` em base64url.
99. Reutilizável durante os 7 dias (não é uso único).
100/101. Sim: `first_opened_at` na primeira abertura e `open_count` incrementado; todos os acessos ficam em `relationship_e20_accesses` com `outcome`.
102. Sim: emissão nova encerra a anterior com `close_reason = 'encerrada_por_nova'`.
103. Bloqueio de simultaneidade **[PARCIAL]** — não há trava de concorrência; há substituição determinística e a trava de OPORTUNIDADE em `openInstance`.
104/105/106/107/108/109. **[NÃO EXISTE]** — nenhuma tela chama `emitirE20`/`listarOcorrenciasE20`; não há botão gerar, botão copiar, nem estados visuais de gerada/válida/expirada. Só `contatoDoExecutivo` é consumido (`executive-contact-dialog.tsx`).
110. Rota `/portal/convite/$token` **[EXISTE]** e resgata via server fn; sem ocorrência emitida ainda, não foi possível confirmar por execução real.
111. Sim — `E20` deve continuar como chave técnica (usada em Biblioteca, snapshot e ocorrências).
112. Sim — rótulo de interface é livre ("Apresentação Digital").

## Bloco 8 — E27 e finalização (113–120)

113. E27 sem conteúdo (`body` vazio, `active=false`).
114. Regra de disparo **[PARCIAL]** — existe `checkpoint_due_at` na ocorrência E20 e `finalization_due_on`, mas nenhum executor lê esses campos.
115. Sem versão ativa.
116/117/118. FINALIZACAO: sem conteúdo, sem versão ativa; funciona hoje como `contentGroup` de E12/RE3/RF1, não como etapa disparável.
119. Sim: `renderFromLibrary` bloqueia com motivo legível quando não há versão ativa; `dispatch.server.ts` e `prepareStepMessage` propagam o bloqueio.
120. Sim — `publishLibraryVersion` marca `active = body.trim().length > 0`, então importar o Word ATIVA automaticamente E27 e FINALIZACAO. Como não há executor para elas, não haveria disparo imediato, mas o estado passaria a "ativo" sem decisão explícita.

## Bloco 9 — Executivo responsável (121–135)

121. `resolveLeadExecutive` (`executive-identity.server.ts`), a partir de `portal_leads.responsible_executive_id` → `executive_profiles`.
122. `resolveExecutiveContact` é usada pela server fn `contatoDoExecutivo` e pelo `executive-contact-dialog.tsx` (Portal/jornada).
123/124/125. Nome, `role_title` e WhatsApp são lidos do perfil dinamicamente.
126/127. **[NÃO EXISTE dado]** — `executive_profiles` tem 7 linhas e **0** com `whatsapp` preenchido. Na prática, hoje todo contato direto por WhatsApp do executivo fica indisponível.
128/129/130. Fallback fixo **[EXISTE]** em componentes públicos: `WHATSAPP_NUMBER = "5517997727337"` (`lib/journey-data.ts`) usado em `components/journey/contact-form.tsx`, `routes/manual/$chapter.tsx`, `components/portal/portal-final-cta.tsx`, `components/simulator/simulator-modal.tsx`, `components/shared/executive-contact-dialog.tsx`. O motor e a E20 NÃO usam fallback.
131. Sim no caminho oficial (`normalizeWhatsappNumber` → `waLink`); não nos componentes acima.
132. Sim, `lib/whatsapp-number.ts` valida e recusa números impossíveis.
133. Sim: `relationship_message_sends` grava `actor_name`, `investor_name_used`, `library_version`; a assinatura fica embutida em `rendered_body`.
134. Sim no motor e na E20.
135. **[SIM, na E0]** — E0 é o único caminho que não passa por `resolveLeadExecutive`; se o cadastro não informar o executivo, o texto sai com o padrão de `automation.server`.

## Bloco 10 — WhatsApp / Meta (136–150)

136. `POST /api/public/whatsapp/webhook` → 1) Remarketing (isolado por telefone) → 2) `parseWebhookReply` (confirmações) → 3) `parseInboundMessage` + `handleInboundMessage`.
137. **[PARCIAL]** — mensagem comum passa pelo caminho único; confirmações e Remarketing têm caminhos próprios antes.
138. Sim, por telefone real (`findLeadByPhone`, casamento pelos últimos 8 dígitos em `portal_leads.whatsapp`).
139. Sim: id da mensagem = `msg_in_<wamid>`, conflito 23505 tratado como reentrega.
140. Sim, `decideAutoReply` é chamado por `handleInboundMessage`.
141. `AUTO_REPLY_STEP = "R1"`.
142. Sim, R1 tem versão ativa (596 caracteres) e vínculo de conteúdo (1 ativo).
143. Sem conteúdo ativo, retorna `sent: false` com motivo — nada é inventado.
144/145. Sim: `resolveMetaWindow` (`lib/relationship/meta-window.ts`) é avaliado antes; fora da janela nada é enviado (bloqueia texto livre e não substitui por template).
146. **[PARCIAL]** — a distinção existe conceitualmente (`requireOfficialTemplate`, `virtualTemplates`, `templatePurpose`), mas fora da janela o sistema apenas bloqueia; não há envio por template.
147. **[PARCIAL]** — existe `relationship_template_bindings` (finalidade → template aprovado), porém a tabela está VAZIA; `readEngineStatus` reporta todas as finalidades como faltantes. Em produção real, `virtualTemplates=false` + `requireOfficialTemplate=true` bloqueia etapas fora da janela.
148. Sim: `crm_meta_templates` / `meta_templates` e `lib/crm/whatsapp-official.ts` (`dispatchWhatsappTemplate`) formam uma central paralela.
149. Sim: `routes/f.crm.index.tsx:726` envia texto livre direto pelo canal, sem motor, sem Biblioteca e sem snapshot.
150. Arquitetura recomendada a preservar: motor puro (`machine.ts`/`engine.ts`) + `config.ts` como única fonte de regra e intervalo + `relationship_message_library` como única fonte de texto (chave `step_key`) + `relationship_step_content_bindings` como única fonte de mídia + `dispatch.server.ts` como único ponto de saída + `relationship_message_sends` como histórico imutável + `execution-mode` decidindo ambiente antes de credencial. O Word deve entrar SOMENTE por `publishLibraryVersion`, criando novas versões.

---

## 1. Bloqueadores para o próximo comando
- `executive_profiles.whatsapp` vazio nos 7 perfis: qualquer envio/contato real fica bloqueado por identidade.
- `relationship_template_bindings` vazio: em produção, etapas fora da janela de 24h são bloqueadas por falta de template oficial.
- Vínculos de conteúdo duplicados (E1, E3, R2, V3, todos `position=0`): essas etapas hoje saem sem conteúdo.
- E0 real ainda usa texto de `automation.server`, não a Biblioteca.
- E20 sem UI: nada pode ser emitido pela operação.

## 2. Decisões pendentes
- E0 passa a ser renderizada pela Biblioteca (e E0_V1 idem)? Se sim, `automation.server.buildWelcomeMessage` vira legado.
- FINALIZACAO é etapa disparável ou permanece apenas grupo de conteúdo?
- E27 tem executor (checkpoint dos 7 dias) nesta etapa ou fica como slot?
- Envio manual do CRM passa a exigir a Biblioteca/snapshot?
- Importar o Word ativa a etapa automaticamente ou publica como rascunho inativo?

## 3. O que o Word precisa fornecer
Para cada etapa: `step_key` exato, título, texto integral com variáveis (`{{nome_investidor}}`, `{{nome_executivo}}`, `{{link_portal}}`, `{{conteudo_*}}`), tipo de botão (`portal`/`content`/nenhum), grupo de conteúdo e se usa nome do investidor. Cobertura mínima: E0, E0_V1, E1, E3, E4, E12, V3, V4, R1, R2, R3, RE0–RE3, RF0, RF1, E20, E27, FINALIZACAO (e E30 se for ativada).

## 4. Pronto — não reconstruir
Motor puro e máquina de estados; `config.ts`; fila e tick do cron; Biblioteca versionada + snapshot imutável; janela de 24h; identidade do executivo; execution-mode; backend completo da E20; webhook inbound; jornada/auditoria.

## 5. A implantar no próximo comando
Importação do Word por versão; E0/E0_V1 lendo a Biblioteca; higienização dos vínculos de conteúdo; UI da E20 (gerar/copiar/estados); preenchimento dos WhatsApp dos executivos; vínculos de template oficial; decisão sobre E27/FINALIZACAO.

## 6. Riscos de regressão
Reimportação criando versões duplicadas; ativação silenciosa de E27/FINALIZACAO; troca da fonte de texto da E0 alterando a mensagem em produção; desativar vínculos e deixar etapas sem conteúdo; renomear `step_key` quebrando snapshots.

## 7. Arquivos que deverão ser alterados
`server/relationship/message-library.server.ts`, `lib/relationship/library.functions.ts`, `components/executive/message-library-panel.tsx`, `server/crm/first-contact.server.ts`, `server/relationship/step-media.server.ts`, `components/executive/workspace/investor-profile-view.tsx` (UI E20).

## 8. Arquivos que NÃO deverão ser alterados
`lib/relationship/machine.ts`, `engine.ts`, `decide.ts`, `calendar.ts`, `meta-window.ts`, `execution-mode.ts`, `server/relationship/{dispatch,repository,scheduler,e20,inbound,auto-reply}.server.ts`, `server/greensales.server.ts`, `server/lead-guard.server.ts` e todo o Portal dos Leads.

## 9. Migrations necessárias
Nenhuma obrigatória. Opcionais: campo de origem/hash do conteúdo importado em `relationship_message_library`; limpeza/`position` dos vínculos duplicados; remoção formal de `relationship_content_groups`.

## 10. Critérios objetivos de aceite
Toda etapa ativa tem exatamente 1 versão ativa e ≤1 conteúdo ativo; reimportar o mesmo Word não cria versão nova; snapshots anteriores inalterados; E0 real com texto idêntico ao da Biblioteca e assinada pelo responsável; E20 emitida, copiada, aberta e expirada com estados visíveis; nenhuma etapa dispara sem texto oficial; nenhuma entrega externa em homologação ou lead de teste.

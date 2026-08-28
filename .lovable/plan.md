# Auditoria 2/5 — Fechamento das decisões para a próxima construção

Somente análise. Nenhum código, banco, rota ou tela foi alterado.

---

## 1. Estrutura de rotas — Grupo Velox (itens 1–9)

**COMO ESTÁ HOJE.** O domínio raiz abre **`src/routes/index.tsx`** (`createFileRoute("/")`), que É o Portal do Investidor da Velox Financeira. `src/routes/f.tsx` é apenas `<Outlet />` neutro; os links personalizados `f.$slug.tsx`, `e.$slug.tsx`, `s.$slug.tsx`, `seg.$slug.tsx` fazem `redirect({ to: "/" })` preservando `search.e`.

**ONDE ESTÁ IMPLEMENTADO.** `src/routes/index.tsx`, `src/routes/f.tsx`, os quatro stubs `*.$slug.tsx`, `src/lib/business-unit.ts` (prefixos + validação de slugs reservados), `src/lib/portal-brands.ts` (`investorPortalPath`/`investorPortalUrl`, com fallback fixo `https://velox-pathfinder-hub.lovable.app`), `src/config/modules.ts` (módulo "Portal do Investidor" com `href: "/"`).

**O QUE ESTÁ FALTANDO (item 2 — sim, é tecnicamente possível).** Mover o Portal Financeiro para `src/routes/f.index.tsx`; reescrever `/` como Home institucional; trocar os stubs de redirect por resolução local de slug; apontar `investorPortalPath` para `/f/...`.

**Referências que hoje esperam o Portal em `/` (itens 3 e 4).** `src/routes/__root.tsx:45,83`; `src/routes/index.tsx:536`; `src/components/editorial/module-chrome.tsx:66`; `src/components/journey/journey-chrome.tsx:41`; `src/config/modules.ts:47-56`; `src/lib/portal-brands.ts:69-91` e seus consumidores (`src/server/relationship/dispatch.server.ts:30,66-72`, `src/lib/journey/campaigns.ts`, `src/lib/portal-session.ts`, `src/routes/f.executivo.dashboard.tsx:576`, `src/server/crm/automation.server.ts`); os quatro stubs `*.$slug.tsx`; e **~153 literais `"/f/..."`** espalhados, já que `unitPath()` tem **zero uso**.

**Item 5 — `/s` x `/sol`.** Tecnicamente mais seguro: **manter `s`**. Já existe `src/routes/s.$slug.tsx`, o prefixo já está reservado em `business-unit.ts` e é simétrico a `f`/`seg`. `/sol` obriga a criar rota, alterar validação e migrar links.

**Item 6.** Sim — a arquitetura é multi-unidade por prefixo; adicionar unidades não reconstrói `/f`.

**Item 7.** Sim. As áreas autenticadas vivem em `f.executivo.*`, `f.crm.*`, `f.remarketing.*`, todas sob `OperationalGuard`. Uma Home institucional em `/` não concede acesso algum.

**Item 8.** Hoje o fallback é o **inverso**: `/f/{slug}` cai em `/`. Não existe redirect de `/` para `/f`.

**Item 9 — riscos de conflito.** (a) `f.$slug` colide conceitualmente com os filhos `/f/executivo`, `/f/crm`, `/f/remarketing` — por isso existe a lista de slugs reservados; qualquer executivo com slug `crm`, `executivo` ou `remarketing` quebraria o roteamento. (b) Ao criar `f.index.tsx`, `f.tsx` deixa de ser neutro e precisa continuar **sem guard**, senão o Portal público passa a exigir sessão. (c) As rotas legadas de topo (`crm.tsx`, `remarketing.tsx`, `portal-leads.tsx`, `executivo.*`) redirecionam para `/f/*` e precisam sobreviver à mudança.

**RISCO/IMPACTO.** Alto se feito sem `unitPath()`: links E0/E20 já entregues a investidores deixam de resolver.

**RECOMENDAÇÃO.** Migrar literais para `unitPath()` primeiro, depois inverter as rotas em um único passo, com `portal-brands.ts` como ponto único de verdade dos links.

**DECISÃO PENDENTE.** Nomenclatura Solar (`s` ou `/sol`).

---

## 2. Apresentação Digital (itens 10–27)

**Item 10 — COMO ESTÁ HOJE.** A funcionalidade **não existe** com esse nome. O que existe, completo no backend, é o **E20 — Convite ao Portal**: `src/server/relationship/e20.server.ts` (`issueE20`, `redeemE20`, `listE20Occurrences`), fachada `src/lib/relationship/e20.functions.ts`, rota pública `src/routes/portal.convite.$token.tsx`, tabelas `relationship_e20_occurrences` e `relationship_e20_accesses`. **Nenhum consumidor `.tsx`.**

**Item 11 — o que falta.** Botão na ficha/card (`src/components/crm/crm-lead-ficha.tsx`, `LeadCard` em `src/components/crm/portal-leads-board.tsx:80`); leitura do estado da ocorrência ativa; exibição de prazo/status; texto oficial na Biblioteca; tela administrativa; RLS restritiva.

**Item 12.** **Reutilizar E20 como base**, não criar entidade independente. Tudo o que a Apresentação Digital precisa já está modelado: token, TTL, acessos, `open_count`, `first_opened_at`, `instance_seq`. Manter `E20` como chave interna e exibir "E6 — Apresentação Digital" como rótulo (existe `STEP_LABEL` em `message-library.server.ts`). Renomear a chave invalidaria `relationship_message_library.step_key = 'E20'`, `PENDING_TEXT_STEPS`, `LIBRARY_STEP_ORDER`, a badge `e20` em `crm-lead-journey.tsx:54` e os snapshots já gravados.

**Item 13 — o conflito.** `src/server/relationship/dispatch.server.ts:29,65-66` resolve o portal por `card?.responsible_executive_slug ?? fallback?.slug`, com `fallback = getDefaultExecutive()`. Ou seja, lead sem responsável recebe o Portal de **outro** executivo — em contradição direta com `src/lib/crm/post-presentation.ts:8-9` ("nunca há fallback para o link de outro executivo").

**Item 14 — RECOMENDAÇÃO.** **Sim: a apresentação deve SEMPRE pertencer ao executivo responsável pelo lead.** Sem responsável, a geração deve ser **bloqueada** com mensagem clara, nunca substituída por executivo padrão.

**Itens 15–16 — redistribuição.** Hoje a ocorrência guarda `generated_by`/`generated_by_executive_id` e não é reavaliada em redistribuição — o link antigo continua apontando para o portal do executivo original. **Recomendação:** ao redistribuir, **encerrar a ocorrência ativa** (`status = 'encerrada'`) e deixar o novo responsável gerar a sua. O link não deve trocar de dono no meio do caminho: o investidor abriria uma página assinada por quem não o atende mais.

**Itens 17–18 — validade.** Hoje: exatamente **7 dias corridos a partir da geração** (`SEVEN_DAYS_MS`, `e20.server.ts:23`, aplicado em `:130`), validado no servidor por `redeemE20` (`:219-265`), que marca `status = 'expirada'`. **Recomendação: manter a contagem a partir da geração.** Contar do primeiro acesso torna o prazo indeterminado e contradiz a mensagem oficial ("sete dias" a partir do envio).

**Itens 19–20 — quantos links.** Hoje `issueE20` **encerra a anterior e cria nova**: só um ativo, com histórico preservado em linhas anteriores. **Recomendação: manter exatamente isso** — um ativo por lead, histórico completo, regeração explícita e avisada. Dois links válidos criariam duas contagens de acesso para a mesma apresentação.

**Item 21 — dados do lead necessários:** `id`, nome tratado (`resolveTreatment`/`firstName`), e o vínculo com o executivo responsável. Nada além disso deve trafegar na URL.

**Item 22 — dados do executivo necessários:** nome, cargo, foto, telefone/WhatsApp, slug do portal e, futuramente, vídeo.

**Item 23 — CONFIRMADO.** `executive_profiles` tem apenas `user_id`, `executive_id`, `email`, `name`, `whatsapp`, `created_at`, `updated_at`. **Slug, cargo (`title`), foto (`photoUrl`), vídeo (`postPresentationVideoUrl`), telefone, datas: só no seed** `SEED_USERS` de `src/lib/executive-auth.ts:170,193-283`.

**Item 24 — migrar para o banco:** `slug` (único, validado contra os slugs reservados), `title`, `photo_url` e `phone`. O seed passa a ser apenas bootstrap.

**Item 25.** **Sim**, deve existir listagem administrativa — os dados já existem (`generated_at`, `generated_by_name`, `expires_at`, `first_opened_at`, `open_count`, `status`) e `listE20Occurrences` está pronta.

**Item 26 — quem enxerga.** Visão global: **Tiago administrador** e **Larissa gestora** (dentro do escopo `central_unica` que ela já possui). **Demais executivos:** somente as próprias apresentações. **Tiago colaborador híbrido:** enquanto atuar como colaborador, escopo de executivo — hoje o código não respeita isso (ver item 33).

**Item 27 — alteração de RLS necessária.** Hoje as duas tabelas E20 têm `SELECT` com `is_portal_member()` — **qualquer colaborador vê tudo**. A alteração mínima é substituir por `can_access_investor(lead_id)` (função já existente, que autoriza admin, manager e executivo responsável). Isso resolve o isolamento sem criar nova função.

---

## 3. Perfis e permissões (itens 28–35)

**Item 28 — papéis existentes.** Aplicação: `super_admin | diretora | executivo` (`src/lib/executive-auth.ts:9`). Banco: enum `app_role = admin | manager | user` em `user_roles`, consumido por `has_role()`, `is_portal_member()`, `can_access_investor()`, `current_executive_id()`.

**Item 29 — divergência.** São dois vocabulários independentes, sem sincronização por código. A única ponte é o trigger `grant_admin_for_official_executive`, que concede `admin` quando `executive_id = 'usr_thiago'`. Consequência: o papel exibido na UI e o papel que governa a RLS podem divergir.

**Item 30 — normalização recomendada.** Não renomear nada. Criar um **mapa único explícito** (`super_admin → admin`, `diretora → manager`, `executivo → user`) em um módulo só, e um gatilho/rotina que garanta a linha correspondente em `user_roles` a cada criação/alteração de executivo. A RLS continua sendo a autoridade; a UI passa a ser derivada dela.

**Item 31 — permissões por módulo hoje.** `workspace_module_permissions` com `module_key ∈ {crm, portal_leads}` (`src/lib/workspace-permissions.ts:21`), RLS: `admin` escreve, membro do portal lê. Além disso, `requiresRole: ["super_admin"]` no módulo `greensales-sync` (`src/config/modules.ts:57-66`). **Remarketing não tem permissão individual** — é item de navegação condicional em `src/components/executive/executive-shell.tsx:135-142`.

**Item 32 — como implementar as três novas.** Ampliar a union `WorkspaceModuleKey` para incluir `remarketing`, `apresentacoes` e `admin_global`, reutilizando integralmente `workspace_module_permissions` (a tabela é genérica por `module_key`). Nenhuma estrutura nova. A autorização definitiva vai na RLS da tabela de dados, não no menu.

**Item 33 — diferenciação técnica.** Tiago administrador: `executive_id = 'usr_thiago'` + `admin` em `user_roles`. Larissa gestora: `manager`, escopo `central_unica` em `workspaceScopesFor` (`src/lib/portal-workspace.ts:115-141`). Demais executivos: `user`, escopos `green_sales` + `redistribuicao`. **Tiago colaborador híbrido: hoje NÃO é diferenciado corretamente** — `canAccessPortalWorkspace:30-35` e `canViewFullWorkspace:42-49` concedem por **ID de usuário** (`HYBRID_WORKSPACE_USER_IDS`, `:19`), ignorando o papel ativo, contra o próprio comentário em `:130-133`.

**Item 34 — DECISÃO.** Recomendação: **não**. Ver tudo enquanto opera como executivo destrói o sentido do papel híbrido e polui os contadores de carteira. O correto é alternar papel explicitamente, e o acesso seguir o **papel ativo**, não o ID.

**Item 35 — acesso por URL.** **Não existe guard server-side por módulo.** `OperationalGuard` exige apenas sessão operacional; `requiresRole` governa navegação, não rota. Digitar `/f/executivo/templates` ou `/f/remarketing` abre a tela. O dado por trás continua protegido por RLS — exceto nas tabelas com `is_portal_member()` amplo (E20 é o caso mais relevante).

---

## 4. Ações do Dia (itens 36–49)

**Itens 36–37.** O Portal dos Leads é `src/components/crm/portal-leads-board.tsx` (Kanban). "Ligações do Dia" é o overlay `src/components/crm/daily-calls-overlay.tsx`, alimentado por `listCadenceQueue({ channel: "call" })` (`src/lib/crm/cadence.functions.ts` → `src/server/crm/cadence.server.ts`) sobre **`crm_cadence_tasks`** — hoje com 5 linhas, todas `DONE`, nenhuma pendente.

**Item 38 — os dois motores.** `crm_cadence_tasks` (ligações, legado) e `relationship_queue` (mensagens, oficial — **26 itens: E1×11, E3×9, E4×6**), com `relationship_message_sends` guardando os envios (E1×3, E3×6). A Agenda é uma terceira fonte: `workspace_agenda_events`.

**Item 39 — RECOMENDAÇÃO.** Não eleger uma tabela como "fonte única", e sim criar um **agregador de leitura** (ex.: `src/server/crm/daily-actions.server.ts`) que consulta as três e normaliza. `relationship_queue` continua a fonte oficial de mensagens; `crm_cadence_tasks` continua a de ligações; `workspace_agenda_events`, a de compromissos. **Zero escrita, zero cópia, nenhum terceiro motor.**

**Item 40 — integrar sem duplicar.** Cada leitor produz um `DailyAction` com `action_key`; o agregador materializa `Map<action_key, DailyAction>` com precedência Agenda > fila oficial > legado.

**Itens 41–42 — chave idempotente.** **Sim, deve considerar lead + etapa + instância.** Formato recomendado: `action_key = ${source}:${leadId}:${step ?? kind}:${instanceSeq ?? occurrenceDate}`. Calculável em leitura, sem coluna nova no primeiro momento. Aplicada na normalização de cada leitor e no handler de conclusão (que a resolve de volta para a tabela de origem).

**Item 43 — E1/E2/E3/E4 na tela.** Como ação de tipo `mensagem`, exibindo o rótulo da etapa e o **texto já renderizado**, em modo leitura, com botão Copiar. Sem seletor: a etapa decide a mensagem. **E2 não existe** hoje (ver item 61).

**Item 44 — o que o sistema já identifica automaticamente.** Lead: sim. Executivo: sim (`responsible_executive_id`). Etapa: sim (`relationship_queue`). Mensagem: sim, via `renderFromLibrary(step, vars)`. **URL/material: NÃO** — `relationship_step_content_bindings` está **vazia (0 linhas)**.

**Item 45 — o que falta.** Cadastrar os bindings etapa → conteúdo e ligar o Portal dos Leads ao agregador.

**Itens 46–48 — prioridade e ordenação.** Sim, compromisso de prioridade máxima próximo deve ir ao topo. Regra determinística por blocos, calculados **antes** do horário: bloco 0 = agenda `priority = 'maxima'` com `startsAt` na janela (−15min até `endsAt`); bloco 1 = atrasadas; bloco 2 = do momento; bloco 3 = futuras (inclui reengajamento agendado). Dentro do bloco: horário crescente; sem horário, vencimento mais antigo; empate pelo `action_key`. Assim uma mensagem futura **nunca** ultrapassa uma reunião chegando. Relógio em America/São_Paulo, como já feito em `src/lib/crm/e0-window.ts`.

**Item 49.** **Sim** — a ordenação é 100% leitura. O motor de Agenda não é alterado. `src/lib/agenda-types.ts` já expõe `priority` (`maxima|media|minima`), `startsAt`, `endsAt` e `kind` (`compromisso|reuniao|acao`).

**RISCO.** ALTO se a Agenda for copiada para outra tabela: gera duas conclusões independentes do mesmo compromisso.

---

## 5. "Ver ficha completa" (itens 50–55)

**Item 50.** Botão em `src/components/crm/daily-calls-overlay.tsx:246`, que chama a prop `onOpenLead`.

**Item 51 — por que falha.** `onOpenLead` em `src/components/crm/portal-leads-board.tsx:620-623` executa apenas `setCallsOpen(false)` e `setSelectedId(leadId)`: fecha o overlay e seleciona o card no board. **Não há navegação nenhuma** — e não existe rota de ficha para navegar (`/f/executivo/investidores` é lista, sem `validateSearch` e sem `$id`).

**Item 52 — RECOMENDAÇÃO.** Criar `src/routes/f.executivo.investidores.$id.tsx` que resolve o lead por `leadId` e monta a ficha existente (`crm-lead-ficha.tsx` / `investor-profile-view.tsx`); trocar o corpo de `onOpenLead` por `navigate({ to: ..., params: { id: leadId } })`.

**Item 53.** A origem/carteira **não é segmento de rota** hoje — é filtro de listagem (`workspaceScopesFor`). Pode ser preservada como `search.origem`, informativa, sem alterar o contexto de carteira do executivo.

**Item 54.** Recomendo **nova aba** neste caso específico: a Ação do Dia é uma fila de trabalho e perder o contexto dela a cada consulta é pior do que a troca de aba.

**Item 55.** O lead é identificado pelo **`portal_leads.id`, que é o ID original da GreenSales**. Usá-lo como parâmetro de rota não cria identidade nova nem altera a existente.

---

## 6. Biblioteca de Conteúdo (itens 56–67)

**Itens 56–57 — COMO ESTÁ HOJE.** `relationship_message_library`, **21 linhas**, uma versão ativa por etapa: `E0, E0_V1, E1, E3, E4, E12, V3, V4, R1, R2, R3, RE0, RE1, RE2, RE3, RF0, RF1, E20, E27, FINALIZACAO`. A aparência "desorganizada" tem causa objetiva: **os códigos não são uma sequência** — são identificadores herdados de comandos diferentes (E12 dos templates D1–D12, E20 do convite, E27 da finalização), exibidos na ordem de `LIBRARY_STEP_ORDER` (`src/server/relationship/message-library.server.ts`).

**Item 58.** **Sim.** O Word deve ser a fonte oficial. Evidência de que nunca foi importado: `PENDING_TEXT_STEPS = ["E20","E27","FINALIZACAO"]` (`:47`) são slots vazios declarados em código, e as etapas presentes espelham exatamente `LIBRARY_STEP_ORDER`.

**Item 59 — o que a Biblioteca armazena.** `step_key`, `code`, `title`, `purpose`, `body`, `version`, `active`, `content_group`, `button_kind` (`portal|content`), `uses_investor_name`, `created_at`, `created_by_name`, `notes`.

**Item 60 — estrutura definitiva recomendada.** Separar **chave técnica** de **rótulo funcional**: `step_key` permanece imutável (E20, E12…) e um campo/mapa de exibição fornece o nome funcional e a **ordem explícita** (`display_order`). Assim ninguém lê "E12" como décima segunda etapa.

**Item 61 — como representar as etapas.** E0–E7 e R0–R3 como **rótulos funcionais**; E20 e as demais como **chaves internas**. Estado real: **E2, E5, E6, E7 e R0 NÃO EXISTEM** — nem no banco, nem em `LIBRARY_STEP_ORDER`, nem em `src/lib/relationship/messages.ts`.

**Itens 62–63 — divergências identificáveis pelo código.**
- E20, E27 e FINALIZACAO: existem como linha, **sem texto oficial**.
- E2, E5, E6, E7, R0: **ausentes**.
- `src/lib/relationship/messages.ts` mantém textos paralelos para E0, E0_V1, E1, E3, E4, E12, V3, V4, R1–R3, RE0–RE3, RF0, RF1 — **segunda fonte de verdade**.
- `relationship_step_content_bindings`: **vazia**, nenhuma etapa tem material vinculado.
- A comparação linha a linha com o Word **NÃO É POSSÍVEL DETERMINAR PELO CÓDIGO ATUAL** — depende do documento importado.

**Itens 64–65.** **Sim** para ambos, e já é assim: editar cria **nova versão** (versionamento imutável) e `recordMessageSnapshot` congela template, versão e texto renderizado em `relationship_message_sends`. Alterar a Biblioteca não reescreve nada já enviado.

**Item 66 — Central de Templates.** `crm_meta_templates` está **VAZIA (0 linhas)**. Portanto **não possui função real hoje**. A ressalva é de negócio: sem template aprovado, o E0 real (janela fechada) não pode ser ativado.

**Item 67 — removíveis sem quebrar o CRM.** `src/routes/f.executivo.templates.tsx`, o item correspondente em `src/components/executive/executive-shell.tsx`, e `src/lib/crm/templates.ts` caso nenhum envio real dependa dele. `relationship_message_library` e `relationship_contents` **não** são afetadas.

---

## 7. E0 e comunicação automática (itens 68–78)

**Itens 68–69.** E0 é o **único disparo automático previsto** e hoje está **em simulação**. A entrada é condicionada em `src/server/crm/lead-intake.server.ts:160` por `E0_SIMULATION_ENABLED || isTest`.

**Item 70 — pontos de disparo.** `src/server/crm/lead-intake.server.ts`, `src/server/crm/first-contact-queue.server.ts`, `src/server/crm/portal-first-contact.server.ts`, `src/server/crm/first-contact.server.ts`, com o motor em `src/server/relationship/engine.server.ts`.

**Item 71.** Sim: o campo `simulated: E0_SIMULATION_ENABLED` é gravado no registro (`portal-first-contact.server.ts:72`, `first-contact-queue.server.ts:90`) e o `E0_SIMULATION_LABEL` acompanha o evento na Jornada (`journey.server.ts:15`).

**Item 72 — blindagem recomendada.** Manter a decisão **no ambiente, antes das credenciais** (regra já vigente no projeto): homologação nunca chama a Meta, mesmo com token válido; destinatário real em ambiente de teste bloqueia o envio. Acrescentar um selo visual inequívoco de "SIMULADA" na ficha e na Jornada, e excluir `simulated = true` de qualquer contador de envios.

**Itens 73–74 — resposta do investidor.** A janela é rastreada por `last_inbound_at`, `last_outbound_at` e `conversation_window_opened_at`, campos operacionais de `portal_leads` (ver `src/lib/workspace-operational.functions.ts`, `src/lib/portal-leads-sync.ts`). O motor referencia a janela de 24h em `engine.server.ts:29`. **Reconhecimento por inbound real: sim, é o campo que existe para isso.** Não há evidência no código de contaminação por mensagem simulada.

**Item 75.** Sim — nome do investidor via `resolveTreatment`/`firstName` e o **executivo responsável do lead**, nunca o padrão.

**Itens 76–78 — número do executivo.** Deve vir do **perfil persistido**: `executive_profiles.whatsapp` é a única fonte no banco (existe também `whatsapp` no seed, mesclado em `executive-auth.ts:313`). **Sem número configurado, a ação deve ser bloqueada com aviso**, jamais substituída pelo número de outro executivo — mesma regra do link do portal.

---

## 8. Apresentação Digital + mensagem (itens 79–85)

**Item 79–80.** A frase oficial **não existe hoje no código** (buscas por "sete dias" e "deixei disponível" não retornam ocorrência em `src/`). Deve ser cadastrada como **conteúdo oficial da Biblioteca**, na etapa `E20` — que já é um slot vazio à espera disso. Template específico criaria uma segunda fonte de verdade.

**Item 81.** Automático, via `renderFromLibrary("E20", { rawInvestorName, executiveName, portalLink })`, já chamado em `e20.server.ts:167-171`.

**Item 82.** **Confirmado: deve existir versão sem nome.** `src/lib/relationship/names.ts` já resolve — `NEUTRAL_TREATMENT = "caro investidor"` (`:12`) quando o nome é ausente, implausível ou rejeitado (`resolveTreatment:140-169`).

**Item 83 — RECOMENDAÇÃO.** Copiar a **mensagem completa com a URL**. É o que o executivo cola no WhatsApp; copiar só a URL obriga a redigitar o texto e abre espaço para variação não oficial.

**Item 84.** **Sim** — um único controle que muda de estado: "Gerar apresentação digital" → "Copiar apresentação digital" (com prazo restante ao lado) e uma ação secundária discreta para regerar.

**Item 85.** Sim, e **deve** ser dinâmico no clique, usando dados atuais de lead e executivo. O texto congelado só entra no snapshot no momento do envio registrado.

---

## 9. CRM — preservação como visualização (itens 86–95)

**Item 86.** Visualização: dados gerais, engajamento, jornada, timeline. Operação real: envio/registro de mensagem (`crm-conversation.tsx`), conclusão de tarefa de cadência, transferência de lead (`src/lib/relationship/lead-transfer.ts`), gravação de campos operacionais (`set_lead_operational`).

**Item 87.** **Sim.** Remover `src/components/crm/crm-lead-journey.tsx` da tela do CRM não elimina a Jornada — ambas leem o mesmo agregador `src/server/relationship/journey.server.ts`.

**Item 88.** Sim, a redução para Dados Gerais / Engajamento / Relacionamento / Portal do Investidor é coerente com o papel visual do CRM.

**Item 89 — dependências da aba.** Apenas o componente e o mapa de cores por etapa (`crm-lead-journey.tsx:54`, que inclui a badge `e20`). Nenhuma escrita, nenhuma função de servidor exclusiva.

**Itens 90–92 — presença.** O CRM **pode** exibir último acesso: existe `portal_engagement.last_access_at` (mantido por `src/server/portal-engagement.server.ts`) e `portal_leads.last_activity_at`. **"Online/offline" não existe** — não há heartbeat nem tabela de presença.

**Item 93 — mecanismo necessário.** Ping do Portal a cada ~60s enquanto `document.visibilityState === "visible"`, gravando um campo próprio (`last_seen_at`), separado de `last_activity_at`.

**Item 94.** **Sim: online = atividade nos últimos 15 minutos**, calculado **na leitura**, sem coluna de status e sem job de expiração.

**Item 95.** Sim — campo único, derivado na leitura, consumido por CRM e Workspace. Dois mecanismos é exatamente o que produz divergência entre telas.

**RISCO.** O ping precisa vir apenas do Portal do investidor e **não** entrar na lista branca `src/lib/events/investor-activity.ts`; caso contrário, presença vira "atividade" e o problema do "NOVO" recorrente volta por outra porta.

---

## 10. Princípios Velox (itens 96–102)

**Item 96.** Não é rota: é overlay `src/components/portal/principios-overlay.tsx`, aberto pelo card `key: "cultura"` / `moduleKey: "principios"` da Home (`src/routes/index.tsx:214-225`, render em `:450-451`).

**Item 97.** A imagem interna é `assetUrl("portal-capa-principios")` (`:15,84`), registrada em `src/lib/assets/registry.ts:256-265` → `src/assets/portal-principios.jpg`.

**Item 98–99.** O card externo (`src/routes/index.tsx:221`) usa **outro asset**: `experienciasImg.url`. **São imagens diferentes** — remover o `<figure>` interno (`:82-91`) não afeta o card. Se a intenção for usar a capa de Princípios no card, basta trocar a referência em `index.tsx:221`.

**Item 100.** **Sim.** Os `<article>` (`:111-143`) já não têm `onClick`, `<a>` nem `<button>` — não há nada a remover. Só falta o efeito de hover, hoje inexistente.

**Item 101.** Os princípios vêm do **banco**: `portal_institutional_blocks`, via `fetchInstitutionalModule({ module: "principios" })` (`:13,62`). Sem bloco cadastrado, caem em `Princípio 0N` + `PLACEHOLDER_BODY` (`:27-28,42-44`). O cabeçalho fixo (`:76-81`) é JSX hardcoded.

**Item 102 — estrutura mais segura.** **Já é a correta.** Basta cadastrar os textos oficiais em `portal_institutional_blocks` com `module = "principios"` e a página os assume sem alteração de código.

---

## 11. Manual do Investidor (itens 103–108)

**Item 103.** **14 capítulos fixos** em `src/lib/journey-data.ts:21-272`: `recepcao` (`/manual`), `proposito`, `velox`, `modelo`, `produtos`, `personalizando-sua-jornada`, `operacao`, `investimento`, `treinamento`, `suporte`, `perfil`, `faq`, `autoavaliacao`, `proximos-passos`. Corpo em `src/components/journey/chapter-bodies.tsx`. **Sem CMS e sem versionamento**; a versão lida pelo investidor não é registrada.

**Item 104 — onde inserir.** Capítulo 3 (`velox`), função `VeloxBody`, array `timeline` em `chapter-bodies.tsx:106-132`. Hoje: "Fundação da Velox" (`:109`) → "Consolidação da operação" (`:114`) → "Expansão da rede de franquias" (`:118-120`). Inserir "Operação própria" entre `:109` e `:114`, e "Estruturação do modelo de negócio" antes da expansão — dois objetos `{ year, title, d }` no mesmo array.

**Item 105.** **Sim**, integralmente. Não há índice numérico acoplado à timeline; nenhum outro capítulo é afetado.

**Item 106.** O vídeo do capítulo 7 é a flag `hasVideo: true` em `journey-data.ts:146`, renderizada em `chapter-view.tsx:76-80` pelo `src/components/journey/video-slot.tsx` (placeholder puro, texto "Vídeo do especialista — em breve.", sem player e sem dados). Remover a flag afeta apenas o capítulo 7.

**Item 107.** **Sim, mais dois:** capítulo 1 `recepcao` (`:34`) e capítulo 14 `proximos-passos` (`:268`).

**Item 108.** **Sim.** O Manual é totalmente independente do E20/Apresentação Digital.

---

## 12. Remarketing (itens 109–115)

**Item 109–110.** Ambiente próprio: `src/routes/f.remarketing.tsx` + `src/routes/f.remarketing.index.tsx`, aberto em nova aba por `src/components/executive/executive-shell.tsx:142`. O cabeçalho é **puramente visual**: `<h1>Ambiente de Remarketing</h1>` (`f.remarketing.index.tsx:91`) e o subtítulo "CRM operacional independente — isolado do CRM de Relacionamento." (`:93`). Nenhuma função.

**Item 111.** Um `h1` em `text-2xl md:text-3xl` mais o parágrafo e o espaçamento do bloco — na prática, a faixa superior que hoje comprime a área útil do CRM.

**Item 112.** **Sim, pode ser removido** (ou reduzido a um rótulo discreto na barra), ampliando a área útil. Não há dependência.

**Item 113.** Sim. O padrão de área cheia já existe no projeto: o board em modo `standalone` usa `h-[100dvh]` com paddings responsivos (`portal-leads-board.tsx`), sem quebrar responsividade.

**Item 114.** **Sim, a alternância Campanhas/Conversas deve permanecer.**

**Item 115 — dependência a observar.** A alteração deve ficar **restrita a `f.remarketing.index.tsx`**. Os componentes de conversa são compartilhados com o CRM (`src/components/crm/crm-conversation.tsx`); alterá-los muda o CRM de Relacionamento também.

---

## 13. Backup (itens 116–125)

**Itens 116–117.** `src/server/backup.server.ts` (geração, retenção, restauração) + `src/server/backup-queue.server.ts` (fila assíncrona, `portal_backup_requests`), agendados por `pg_cron`; UI em `src/routes/f.executivo.central-backup.tsx`. Pontos em **`portal_backups`**, conteúdo deduplicado por hash em **`portal_backup_blobs`**; histórico de restaurações em `portal_restores`.

**Itens 118–120 — retenção.** Hoje: `RETENTION = { fullHours: 48, dailyDays: 7 }` (`:143-152`) — **todos os pontos horários das últimas 48h** e, depois disso, o **último ponto de cada dia** por 7 dias (`pruneBackups`, `:329+`). A regra proposta (horários só do dia corrente + um ponto de meia-noite por dia, 7 diários) **exige alteração estrutural**: reduzir a janela horária de 48h para o dia corrente e selecionar o ponto **pelo horário 00:00**, não pelo "último do dia".

**Item 119 — ponto crítico.** O agrupamento diário atual usa `Math.floor(at / day)` em **UTC** (`:362`). Como a operação é America/São_Paulo (−03:00), a meia-noite local cai no dia UTC seguinte: o rótulo do dia ficaria errado por construção. É preciso um campo explícito de **data de referência** (`reference_date = created_at − 1 dia` para o ponto das 00:00), calculado no fuso local.

**Itens 121–122.** Hoje o corte é **por idade** (7 dias corridos), não por contagem — um dia sem execução produz 6 pontos. Para garantir exatamente 7, o corte precisa ser por **ranking** (`ORDER BY reference_date DESC LIMIT 7`), descartando o oitavo.

**Item 123 — risco de exclusão errada.** Existe. `pruneBackups` não conhece restaurações em andamento e não há lock entre a fila e a restauração. Pontos `protected = true` (manuais e pré-restauração) já são preservados; o **ponto de origem de uma restauração em curso não é protegido**.

**Itens 124–125 — o que "Restaurar" realmente faz.** É restauração **real** (`restoreBackupPayload`, `:298-325`: apaga e reinsere por tabela), porém **parcial por desenho**. `BACKUP_TABLES` (`:21-44`) captura 22 tabelas, mas `NEVER_RESTORE_TABLES` (`:59-74`) **exclui da restauração** todo o núcleo operacional: `portal_leads`, `crm_leads`, `crm_pipelines`, `crm_pipeline_stages`, `crm_cadence_tasks`, `crm_sync_runs`, `crm_lead_events`, `crm_messages`, `crm_timeline`, `crm_connections`, `portal_journey_events`, `portal_engagement`, `portal_meetings`, `portal_lead_guard_log`.
Portanto, na prática o botão restaura apenas: `campaigns`, `meta_templates`, `news_posts`, `knowledge_documents`, `creative_templates`, `creative_official_model`, `executive_profiles`, `user_roles`, `whatsapp_validations`, `app_user_connections`, `magazine_editions`, `magazine_pages`, `portal_institutional_blocks`. **O "backup completo do portal" captura tudo, mas a restauração jamais toca leads, conversas, jornada, engajamento ou reuniões** — é a blindagem definitiva, e está correta.

---

## 14. Pendências de Identidade (itens 126–130)

**Item 126–127.** Tela `src/routes/f.executivo.identidade.tsx` + `src/lib/portal-identity.functions.ts`, ambas **somente leitura**. O problema real que exibe: conflitos gravados por `resolve_portal_identity` (SECURITY DEFINER, com advisory locks por telefone e e-mail) nas colunas `identity_conflict` e `identity_alternates` de `portal_leads` — telefone divergente, e-mail divergente e **identidade cruzada** (telefone aponta um lead, e-mail aponta outro).

**Item 128.** A **lógica** é necessária; a **tela** não. A deduplicação vive na função e no índice único `identity_key`.

**Item 129 — impacto da remoção da tela.** Identidade: nenhum. Deduplicação: nenhum. Sincronização GreenSales: nenhum. Ownership: nenhum. Redistribuição: nenhum. **Único efeito colateral:** conflitos continuam sendo gravados sem observador humano.

**Item 130 — componentes envolvidos.** `src/routes/f.executivo.identidade.tsx`, a entrada correspondente em `src/components/executive/executive-shell.tsx` e o consumo de `src/lib/portal-identity.functions.ts` (o módulo pode permanecer, sem consumidor). **Não remover** `resolve_portal_identity` nem as colunas.

**RECOMENDAÇÃO.** Remover a tela e prever um aviso discreto de conflito na própria ficha do lead, para que a informação não se perca.

---

## 15. Reativação (itens 131–136)

**Itens 132–133.** **Sim, ainda depende de localStorage.** Gerado exclusivamente em `src/lib/workspace-alerts.ts:132-137`, dentro de `pushAlert`, restrito a `category === "movimentacao"` (`:128-130`), acionado por `evaluateInvestorMovement()` (`:142-172`), que compara `lastActivity` com `lastSeen`.

**Item 134.** **Apenas alerta visual.** Não persiste no banco, não altera coluna, não muda estágio e não aparece na Jornada oficial — a whitelist do servidor (`RELATIONAL_TIMELINE_EVENTS`, `journey.server.ts:88-95`) não o inclui.

**Item 135 — RECOMENDAÇÃO.** **Permanecer somente como alerta** nesta etapa. Não há consumidor de negócio que justifique persistência agora.

**Item 136 — se um dia precisar.** Só quando a reativação passar a disparar cadência (RE0–RE3) automaticamente. Estrutura mínima nesse cenário: coluna `reactivated_at` em `portal_leads` (ou evento em `relationship_events`) gravada pelo servidor a partir de atividade real do investidor — nunca por heurística de navegador.

---

## 16. Notas do Executivo (itens 137–141)

**Item 138.** `portal_leads.notes` existe, é gravável com autorização correta (`set_lead_operational`, lista fechada de colunas) e está **100% vazio**. `crm_cadence_tasks.note` existe por ocorrência de tarefa. As observações que o executivo realmente escreve hoje vivem em **localStorage** (`src/lib/investor-comments.ts`).

**Item 139.** **Não existe** nenhuma estrutura que diferencie ligação, mensagem, observação, duração ou resultado. `note` é texto livre.

**Itens 140–141 — RECOMENDAÇÃO.** **Entidade própria (`lead_notes`)**, preservando `portal_leads.notes` como resumo livre atual, sem migração destrutiva. Campos: `id`, `lead_id`, `author_id`/`author_name`, `kind` (`ligacao|mensagem|observacao`), `body`, `ref_id` (tarefa ou `relationship_message_sends.id`), `duration_s`, `outcome`, `created_at`.
Impacto das alternativas: (a) **estender `notes`** → sem migration, mas concatenação destrói autoria, cronologia e tipo — inviável para notas de ligação; (b) **usar `crm_cadence_tasks.note`** → só existe onde há tarefa, e a tabela está em `NEVER_RESTORE_TABLES`, então a nota não é restaurável; (c) **`lead_notes`** → uma migration, ganha histórico auditável, tira as observações do navegador e entra no backup (lembrando de acrescentá-la a `BACKUP_TABLES`).

---

## 17. Agenda (itens 142–146)

**Item 142.** A Agenda é global: tabela `workspace_agenda_events`, dados por `src/lib/agenda.functions.ts`, UI pelo dock `src/components/agenda/agenda-dock.tsx` montado no `__root.tsx`. Há também a função `agenda_cadence_tasks` (SECURITY DEFINER), que lê **apenas o legado `crm_cadence_tasks`**.

**Item 143.** **Sim** — `AgendaPriority` (`maxima|media|minima`), `startsAt`, `endsAt`, `kind` (`compromisso|reuniao|acao`) já existem em `src/lib/agenda-types.ts:8-27`. Estrutura suficiente para a Ação do Dia, sem alteração.

**Item 144 — conflitos reais.** (a) `agenda_cadence_tasks` lê o legado e ignora `relationship_queue` — a Agenda hoje **não enxerga mensagens pendentes**. (b) `portal_meetings` (reunião com o investidor) e `workspace_agenda_events` (compromisso do executivo) são fontes distintas sem precedência definida — o mesmo encontro pode existir nas duas. (c) Sem `action_key`, a mesma etapa pode aparecer duas vezes.

**Item 145.** **Sim, precisa ser ampliada.** A constraint `EXCLUDE` atual (com `btree_gist`) cobre apenas evento × evento de prioridade `maxima` dentro de `workspace_agenda_events`. **Reuniões em `portal_meetings` não são bloqueadas.**

**Item 146 — regra recomendada.** Uma reunião confirmada deve materializar (ou ser espelhada por) um evento em `workspace_agenda_events` com `priority = 'maxima'`, para cair sob a mesma constraint — **um único calendário fisicamente restrito**. A alternativa (constraint cruzada entre duas tabelas) exige trigger e é mais frágil.

---

## 18. Consolidação final (itens 147–150)

### A) JÁ ESTÁ CORRETO — não mexer

| Item | Evidência |
| --- | --- |
| Backend E20 (token, TTL 7 dias, resgate, acessos) | `e20.server.ts`, `relationship_e20_occurrences/_accesses` |
| Versionamento imutável + snapshot de envio | `message-library.server.ts`, `recordMessageSnapshot` |
| Normalização de nome e fallback neutro | `src/lib/relationship/names.ts` |
| Blindagem de restauração (núcleo operacional intocável) | `NEVER_RESTORE_TABLES` |
| Identidade atômica do lead (ID GreenSales) | `resolve_portal_identity`, `identity_key` |
| Lista branca de atividade real do investidor | `src/lib/events/investor-activity.ts` + `executive-data.ts:121` |
| Jornada oficial com whitelist relacional | `journey.server.ts:88-98` |
| Estrutura de prioridade/horário da Agenda | `src/lib/agenda-types.ts` |
| Cards de Princípios não clicáveis, textos em banco | `principios-overlay.tsx`, `portal_institutional_blocks` |
| Motor de backup (não reabrir) | `backup.server.ts`; só registrar tabelas novas em `BACKUP_TABLES` |

### B) PRECISA SER IMPLEMENTADO — sem decisão pendente

1. `action_key` (`source:leadId:step:instância`) e agregador de leitura da Ação do Dia.
2. Agenda dentro da Ação do Dia, lendo `workspace_agenda_events`, sem cópia.
3. Ordenação por blocos (agenda máxima → atrasadas → agora → futuras), fuso São Paulo.
4. Rota `f.executivo.investidores.$id` + correção de `onOpenLead`.
5. UI da Apresentação Digital: botão com estado, prazo visível, mensagem completa no Copiar.
6. RLS das tabelas E20: trocar `is_portal_member()` por `can_access_investor(lead_id)`.
7. Migração de `slug`, `title`, `photo_url`, `phone` para `executive_profiles`.
8. Bloqueio do fallback para o Executivo Padrão em `dispatch.server.ts:66`.
9. Cadastro dos bindings etapa → conteúdo (`relationship_step_content_bindings`, hoje vazia).
10. Importação do Word na Biblioteca e aposentadoria de `src/lib/relationship/messages.ts`.
11. `display_order` / rótulo funcional separado de `step_key`.
12. Presença: ping de 60s em campo próprio + "online" derivado de 15 min.
13. Manual: nova etapa histórica no capítulo 3; remoção do `hasVideo` do capítulo 7.
14. Princípios: remover `<figure>` interno e aplicar hover.
15. Remarketing: enxugar o cabeçalho em `f.remarketing.index.tsx`.
16. Remoção da tela de Pendências de Identidade (mantendo a lógica).
17. Espelhar reunião confirmada como evento `maxima` para cair na constraint única.

### C) PRECISA DE DECISÃO ANTES DA CONSTRUÇÃO — com recomendação objetiva

| # | Decisão | Recomendação |
| --- | --- | --- |
| C1 | Prefixo da unidade Solar | **Manter `s`**; se `/sol` for exigência de marca, criar `/sol` e manter `s` como alias permanente |
| C2 | Apresentação após redistribuição | **Encerrar a ocorrência ativa** na transferência; o novo responsável gera a sua |
| C3 | Etapas E2, E5, E6, E7, R0 (inexistentes) | Criar **somente as que o Word definir**, como `step_key` novos, sem renumerar as existentes |
| C4 | Texto oficial do E20 | Cadastrar a frase fornecida como conteúdo da etapa `E20` na Biblioteca |
| C5 | Papel híbrido do Tiago | Acesso deve seguir o **papel ativo**, não o ID de usuário; corrigir `portal-workspace.ts:30-49` |
| C6 | Retenção de backup | Adotar **7 pontos diários por ranking**, com `reference_date` em fuso local |
| C7 | Remoção da Central de Templates | Remover; só reintroduzir se/quando o E0 real via Meta for ativado |
| C8 | Notas do executivo | Criar **`lead_notes`**, preservando `portal_leads.notes` |
| C9 | Vídeo pós-apresentação no perfil | Remover o campo obrigatório; o executivo cola o link no momento do envio |

### Ordem técnica recomendada (item 150)

1. **`action_key` + agregador de leitura** — vocabulário único de ação; tudo depende disso.
2. **Agenda no agregador** + espelhamento da reunião confirmada — resolve o único risco ALTO enquanto a superfície é pequena.
3. **Rota da ficha do lead** e correção do "Ver ficha completa" — isolado, sem migration, ganho imediato.
4. **Biblioteca: importar o Word**, separar rótulo de chave, cadastrar bindings, aposentar `messages.ts` — precisa vir **antes** de qualquer tela que exiba mensagem.
5. **E1–E4 na Ação do Dia** com texto renderizado + Copiar.
6. **Apresentação Digital na UI** (E20 interno, E6 no rótulo), RLS restritiva e painel administrativo.
7. **Perfil do executivo migrado para o banco** — habilita personalização real da apresentação.
8. **Presença do investidor** — isolado e reversível; depois porque toca a regra mais sensível do projeto.
9. **Manual e Princípios** — risco zero de regressão.
10. **Remarketing (layout)** — localizado em um arquivo.
11. **Backup: nova retenção** com data de referência e fuso correto.
12. **Separação `/` institucional × `/f`**, com `unitPath()` já adotado.
13. **Remoções de legado** — por último, quando os substitutos estiverem em produção.

Esta ordem prioriza a fundação compartilhada antes das telas, ataca o risco ALTO (Agenda) cedo, reutiliza integralmente `relationship_queue`, `renderFromLibrary` e E20 sem criar motores paralelos, e concentra migrations em três pontos apenas: perfil do executivo, `lead_notes` e retenção de backup.

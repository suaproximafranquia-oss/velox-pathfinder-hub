# Auditoria Técnica 2/5 — Pacote de decisões para a próxima construção

Somente mapeamento. Nada foi alterado: sem código, sem banco, sem migration, sem componente.
Itens já fechados em rodadas anteriores estão marcados **JÁ DEFINIDO** com o local da implementação, sem repetir a discussão.

---

## BLOCO 1 — Arquitetura de rotas e Portal institucional (1–15)

**1–2.** `/` é atendida por `src/routes/index.tsx` (`createFileRoute("/")`) e abre **diretamente o Portal do Investidor da Velox Financeira**. Não há ambiente institucional na raiz.

**3–4.** A tela institucional do Grupo Velox **NÃO EXISTE**. Não há componente equivalente no código. O que mais se aproxima é `src/routes/universo.tsx` (institucional da Financeira), que não representa as três unidades.

**5.** É tecnicamente seguro **desde que** `unitPath()` seja adotado antes. Hoje há **~153 literais `"/f/..."`** no código e `unitPath()` (`src/lib/business-unit.ts`) tem **zero uso** — inverter as rotas com literais espalhados é o principal vetor de quebra.

**6–7.** Links que hoje esperam o Portal Financeiro em `/`: `src/routes/__root.tsx:45,83`; `src/routes/index.tsx:536`; `src/components/editorial/module-chrome.tsx:66`; `src/components/journey/journey-chrome.tsx:41`; `src/config/modules.ts:47-56` (`href: "/"`); `src/lib/portal-brands.ts:69-91` (`investorPortalPath`/`investorPortalUrl`, com fallback fixo para o domínio publicado) e seus consumidores — `src/server/relationship/dispatch.server.ts:30,66-72`, `src/lib/journey/campaigns.ts`, `src/lib/portal-session.ts`, `src/routes/f.executivo.dashboard.tsx:576`, `src/server/crm/automation.server.ts`; e os stubs `f.$slug.tsx`, `e.$slug.tsx`, `s.$slug.tsx`, `seg.$slug.tsx`, que hoje fazem `redirect({ to: "/" })`. **Sim, todos precisam passar a apontar para `/f`** — de preferência via `unitPath()`/`portal-brands.ts`, ponto único de verdade.

**8.** Sim. O Portal Financeiro deve viver exclusivamente sob `/f`, com `src/routes/f.index.tsx` como entrada.

**9–10.** `src/routes/s.$slug.tsx` e `src/routes/seg.$slug.tsx` **existem**, mas são apenas stubs: redirecionam para `/`. Não há ambiente Solar nem Seguros — nenhuma `s.index.tsx`/`seg.index.tsx`, nenhuma tela própria.

**11.** **Zero ocorrências de "Agilize Brasil"** em `src/` (busca case-insensitive). Nada a remover.

**12.** Conflito real e único: `f.$slug` disputa espaço com os filhos `/f/executivo`, `/f/crm`, `/f/remarketing`. Isso já é mitigado pela lista de **slugs reservados** em `src/lib/business-unit.ts`. Segundo ponto: ao criar `f.index.tsx`, o layout `f.tsx` (hoje `<Outlet />` neutro, sem guard) **precisa continuar sem guard**, senão o Portal público passa a exigir sessão. Terceiro: as rotas legadas de topo (`crm.tsx`, `remarketing.tsx`, `portal-leads.tsx`, `executivo.*`) redirecionam para `/f/*` e devem sobreviver.

**13.** Sim. A arquitetura é multi-unidade por prefixo; novas unidades entram como novas rotas na mesma aplicação, sem duplicação.

**14–15.** O conceito está correto e é o alvo. **Divergência atual:** `/` = Financeira (não Grupo), `/f` = redirecionador para `/` (invertido), `/s` e `/seg` = stubs vazios. Ou seja, hoje a arquitetura é exatamente o inverso da pretendida.

**RISCO:** ALTO se feito sem `unitPath()` — links E0/E20 já entregues a investidores deixam de resolver.
**RECOMENDAÇÃO:** (1) migrar literais para `unitPath()`; (2) inverter `/` e `/f` em um único passo; (3) criar `/s` e `/seg` só quando houver conteúdo.
**DECISÃO PENDENTE:** manter `s` ou adotar `/sol` (recomendação: manter `s`, e se a marca exigir, criar `/sol` com `s` como alias permanente).

---

## BLOCO 2 — Papéis e acessos (16–25)

**16.** **JÁ DEFINIDO.** Dois vocabulários: aplicação `super_admin | diretora | executivo` (`src/lib/executive-auth.ts:9`) e banco `app_role = admin | manager | user` (`user_roles`), este último o que governa a RLS via `has_role`, `is_portal_member`, `can_access_investor`, `current_executive_id`.

**17.** Tiago administrador: `executive_id = 'usr_thiago'` + `admin` (concedido pelo trigger `grant_admin_for_official_executive`). Larissa gestora: `manager`, escopo `central_unica` em `workspaceScopesFor` (`src/lib/portal-workspace.ts:115-141`). Demais colaboradores: `user`, escopos `green_sales` + `redistribuicao`. Tiago colaborador híbrido: **não é diferenciado hoje**.

**18–19.** **Pelo ID do usuário**, não pelo papel ativo: `HYBRID_WORKSPACE_USER_IDS` (`src/lib/portal-workspace.ts:19`), consumido em `canAccessPortalWorkspace:30-35` e `canViewFullWorkspace:42-49` — contrariando o comentário do próprio arquivo (`:130-133`).

**20.** Tecnicamente sim (`user_roles` é única por `user_id + role`, permitindo várias linhas), mas **não há noção de "papel ativo"** na sessão. Alternância de papel exige um campo de sessão novo.

**21.** Menus: `src/config/modules.ts` (`requiresRole`, hoje só `["super_admin"]` no `greensales-sync`), `src/components/executive/executive-shell.tsx` (condicionais de navegação) e `workspace_module_permissions` (`module_key ∈ {crm, portal_leads}`, `src/lib/workspace-permissions.ts:21`). **Não há guard server-side por módulo**: `OperationalGuard` exige apenas sessão operacional; digitar a URL abre a tela. O dado permanece protegido pela RLS — exceto onde a política é ampla (`is_portal_member()`, caso das tabelas E20).

**22–23.** Não existe área administrativa exclusiva. Existem telas administrativas dispersas (`f.executivo.administracao`, `usuarios`, `central-backup`, `identidade`). O **mecanismo equivalente ao Remarketing existe e é reutilizável**: rota-layout própria (`f.remarketing.tsx` + `.index.tsx`) aberta em nova aba (`executive-shell.tsx:142`).

**24. RECOMENDAÇÃO.** Reproduzir exatamente o padrão do Remarketing: um subtree `/f/admin` com layout próprio, entrada condicionada ao papel, e — obrigatoriamente — **autorização no dado** (RLS + verificação de papel dentro de cada server function), nunca só no menu. Nenhuma segunda aplicação.

**25.** Sim, todos os cinco cabem nessa área. Os dados já existem: `listE20Occurrences` (apresentações e acessos), `relationship_message_library` (conteúdos), `portal_institutional_blocks` (institucional), `portal_backups` (ferramentas).

---

## BLOCO 3 — Ações do Dia (26–58)

**26–27.** Abre `src/components/crm/daily-calls-overlay.tsx`, acionado pelo Portal dos Leads (`src/components/crm/portal-leads-board.tsx`). É **esse overlay** que deve virar "Ações do Dia", mais um agregador de leitura novo (ex.: `src/server/crm/daily-actions.server.ts`).

**28–29. Estado atual das fontes:**

| Fonte | O que é | Estado |
| --- | --- | --- |
| `crm_cadence_tasks` | tarefas de ligação (legado) | 5 linhas, **todas DONE** — nenhuma pendente |
| `agenda_cadence_tasks` | função SECURITY DEFINER de leitura | lê **apenas** `crm_cadence_tasks` |
| `relationship_queue` | motor oficial de mensagens | **26 itens** (E1×11, E3×9, E4×6) |
| `workspace_agenda_events` | compromissos do executivo | 1 linha |
| `portal_meetings` | reuniões com o investidor | 1 linha |

**30–32.** **JÁ DEFINIDO.** `relationship_queue` é o motor oficial da jornada e das mensagens (`src/server/relationship/engine.server.ts`); `crm_cadence_tasks` é legado de ligações. Confirmado pelos volumes acima.

**33–35.** **Não existe** chave `lead + fluxo + etapa + instância`. Deve ser criada **na camada de normalização do agregador de leitura**, não no banco:
`action_key = ${source}:${leadId}:${step ?? kind}:${instanceSeq ?? occurrenceDate}`.
Como é calculada em leitura, **não altera nenhum histórico** — nenhuma linha existente é reescrita.

**36–39.** Mensagem: `relationship_queue.step` + `lead_id` (+ instância). Ligação: linha em `crm_cadence_tasks` (`step_day`, `channel = 'call'`). Reunião: linha em `portal_meetings`. Compromisso: linha em `workspace_agenda_events` com `kind` e `priority`.

**40–44.** Sim, todas normalizáveis. Estrutura recomendada de `DailyAction` (somente leitura, sem persistência):

```text
DailyAction {
  action_key: string        // source:leadId:step|kind:instância
  source: 'queue' | 'cadence' | 'agenda' | 'meeting'
  kind: 'mensagem' | 'ligacao' | 'agenda' | 'reuniao'
  lead_id: string           // ID original GreenSales
  lead_name: string         // já tratado (resolveTreatment)
  executive_id: string
  step_key?: 'E1' | 'E3' | 'E4' | ...   // só para mensagem
  step_label?: string       // rótulo funcional
  body?: string             // texto já renderizado
  due_at: string            // ISO, America/Sao_Paulo
  starts_at?: string; ends_at?: string
  priority: 'maxima' | 'media' | 'minima'
  bucket: 'agora' | 'atrasada' | 'hoje' | 'futura'
  status: 'pendente' | 'concluida'
}
```
`kind` distingue ligação, mensagem e agenda — **sim**. `step_key` identifica E1/E3/E4 etc. — **sim** (mantendo a chave técnica, ver Bloco 7).

**45.** Sim: etapa visível na interface, com o texto oficial renderizado.

**46–49.** Sim, atrasada permanece atrasada. Classificação por comparação de `due_at` com o agora em **America/São_Paulo** (mesmo padrão já usado em `src/lib/crm/e0-window.ts`): vencida = `due_at < hoje 00:00`; hoje = mesma data local; futura = data posterior.

**50. Ajuste recomendado à ordenação proposta.** Ordenar por **blocos** calculados antes do horário, e só depois por tipo:
1. Agenda/reunião com `priority = 'maxima'` dentro da janela (−15 min até `ends_at`);
2. Atrasadas;
3. Do momento (hoje, já vencidas no horário);
4. Futuras de hoje;
5. Demais.
Dentro do bloco: horário crescente → mensagem antes de ligação (a mensagem tem janela) → empate pelo `action_key`. Isso evita o efeito colateral da lista proposta, em que uma mensagem futura ultrapassaria uma ligação atrasada.

**51–54.** A Agenda entra como item nativo da lista, lida de `workspace_agenda_events` (**sem cópia**). Reunião confirmada = prioridade máxima no momento adequado: **sim**. Regra temporal mais segura: **janela relativa de −15 min até `ends_at`**, calculada em leitura — não usar "faltam X minutos" recalculado a cada render, e sim o mesmo relógio de fuso do agregador.

**55–56.** **Sim para ambos.** Camada exclusivamente de leitura/agregação: não cria tarefa, não escreve, não duplica evento de agenda. Concluir uma ação resolve o `action_key` de volta para a tabela de origem.

**57–58. Riscos de duplicidade:** (a) mesma etapa presente na fila oficial e no legado; (b) mesmo encontro em `portal_meetings` e `workspace_agenda_events`; (c) reprocessamento gerando duas linhas de fila para a mesma etapa/instância. **Evitado por:** `Map<action_key, DailyAction>` com precedência **agenda > reunião > fila oficial > legado**, aplicada na normalização — a chave colide e o item de menor precedência é descartado.

---

## BLOCO 4 — Ficha do lead (59–69)

**59–60.** Botão em `daily-calls-overlay.tsx:246`, chama a prop `onOpenLead`. Em `portal-leads-board.tsx:620-623` essa prop executa apenas `setCallsOpen(false)` e `setSelectedId(leadId)` — **fecha o overlay e seleciona o card**, sem navegar. Não há navegação porque **não existe rota de destino**.

**61–63.** Não existe rota por `leadId`: `/f/executivo/investidores` é lista, sem `$id` e sem `validateSearch`. Criar **`src/routes/f.executivo.investidores.$id.tsx`**. Sim, o parâmetro pode ser o **ID original GreenSales** — é literalmente o `portal_leads.id`, então não cria identidade nova.

**64.** A origem/carteira não é segmento de rota (é filtro de `workspaceScopesFor`). Preservar como `search.origem` informativo, sem alterar o contexto de carteira.

**65–66.** Sim, abre com o lead já resolvido pelo parâmetro. **Nova aba recomendada**: a Ação do Dia é fila de trabalho e perder o contexto a cada consulta é pior que a troca de aba.

**67–69.** Reutilizar o que já existe, sem criar ficha nova: **`src/components/crm/crm-lead-ficha.tsx`** (ficha do CRM) e **`src/components/executive/investor-profile-view.tsx`** (perfil consolidado). A nova rota é apenas o invólucro que resolve o lead e monta esses componentes.

---

## BLOCO 5 — Mensagens manuais na Ação do Dia (70–85)

**70–73.** Armazenadas em **`relationship_message_library`** (21 linhas, uma versão ativa por etapa). Existe uma **segunda fonte**: `src/lib/relationship/messages.ts`, com textos paralelos. Consumidor único hoje: **`src/server/relationship/message-library.server.ts`** — ou seja, o motor lê a Biblioteca, e `messages.ts` alimenta os slots/seed dela. A divergência é de **cobertura**, não de rota de leitura: E20, E27 e FINALIZACAO estão em `PENDING_TEXT_STEPS` (sem texto oficial) e **E2, E5, E6, E7, R0 não existem em lugar nenhum**.

**74.** Pela chave `step_key`, ligada à etapa da linha de `relationship_queue`.

**75, 79–81, 83.** "Copiar mensagem": chama `renderFromLibrary(step, vars)` **no momento do clique**, com dados atuais de lead e executivo, e copia o **texto final completo** para o clipboard — sem edição manual, sem alteração. Como o conteúdo vem da Biblioteca por `step_key`, **mudar o texto de uma etapa no futuro não exige tocar no componente**.

**76–78.** O nome do lead está disponível na ação (`lead_name`). Reutilizar `resolveTreatment`/`firstName` de **`src/lib/relationship/names.ts`**. Fallback quando o nome não é confiável: **`NEUTRAL_TREATMENT = "caro investidor"`** (`names.ts:12`, aplicado em `resolveTreatment:140-169`).

**82.** Sim: a etapa vem da própria ação (`step_key` da fila). Sem seletor manual.

**84–85.** **JÁ DEFINIDO.** Versionamento imutável na Biblioteca (editar cria nova versão) e `recordMessageSnapshot` congela template, versão e texto renderizado em `relationship_message_sends`. **A versão deve ser registrada somente no envio efetivo** — a ação é transitória e pode ser recopiada dias depois; registrar versão na ação criaria um segundo histórico sem valor.

---

## BLOCO 6 — Apresentação Digital / E20 (86–110)

**86–89.** Backend **completo e funcional**: `src/server/relationship/e20.server.ts` (`issueE20`, `redeemE20`, `listE20Occurrences`), fachada `src/lib/relationship/e20.functions.ts`, rota pública `src/routes/portal.convite.$token.tsx`, tabelas `relationship_e20_occurrences` e `relationship_e20_accesses`. `issueE20` funciona integralmente; token de **7 dias** via `SEVEN_DAYS_MS` (`:23`), com **`expires_at` calculado no servidor** (`:130`) e validado por `redeemE20` (`:219-265`), que marca `status = 'expirada'`.

**90–91.** Nova emissão **encerra a anterior** e cria nova ocorrência (histórico preservado). **Não existe hoje mecanismo de reutilização** de uma apresentação ainda válida — é exatamente a lacuna que o botão de estado resolve.

**92–94.** Sim ao botão de estado: **"Gerar apresentação digital" → "Copiar apresentação digital"** (com prazo restante ao lado). Sim, um segundo clique **não deve** gerar outro token — a UI lê a ocorrência ativa antes de oferecer geração. **"Gerar novo link" é ação secundária separada e explícita.**

**95.** **Ambos**, com pesos diferentes: ação primária na **ficha** (`crm-lead-ficha.tsx`) e atalho compacto no **LeadCard** (`portal-leads-board.tsx:80`).

**96.** Sim — sempre o ID original GreenSales (`portal_leads.id`).

**97, 101.** Pelo `responsible_executive_id` do lead. **Deve usar automaticamente os dados do responsável.** Ponto crítico a corrigir: `src/server/relationship/dispatch.server.ts:29,65-66` cai em `getDefaultExecutive()` quando não há responsável — em contradição direta com `src/lib/crm/post-presentation.ts:8-9`. Sem responsável, **bloquear a geração**.

**98–100.** Nome: disponível no perfil. **WhatsApp: `executive_profiles.whatsapp` é a única coluna persistida** (a tabela tem apenas `user_id`, `executive_id`, `email`, `name`, `whatsapp`, `created_at`, `updated_at`). Slug, cargo, foto, telefone e vídeo vivem **só no seed** `SEED_USERS` (`src/lib/executive-auth.ts:170,193-283`, mesclados em `:313`).

**102–107.** Não existe tela administrativa. `listE20Occurrences(leadId)` faz `select("*")` — **retorna todas as colunas da ocorrência**: `id`, `lead_id`, `token`, `instance_seq`, `status`, `generated_at`, `generated_by`, `generated_by_executive_id`, `generated_by_name`, `expires_at`, `first_opened_at`, `open_count`, `last_opened_at`, `redeemed_at` e metadados. Isso cobre **data de geração, validade, status, primeiro acesso e quantidade de acessos**; **último acesso** também (`last_opened_at`, e o detalhe fino em `relationship_e20_accesses`); **expirado** é derivável de `expires_at` e já é materializado em `status`.
**Duas lacunas para a tela administrativa:** a função é **por lead** (falta uma variante global/por executivo) e a RLS das tabelas E20 usa `is_portal_member()`, ampla demais.

**108.** Sim — cada abertura é registrada em `relationship_e20_accesses` e incrementa `open_count`.

**109–110.** A URL é montada no servidor por `portal-brands.ts` → `dispatch.server.ts`/`e20.server.ts`. **Confirmado: o frontend jamais deve reconstruir essa URL** — é o que garante que o portal seja o do executivo responsável e que o token não seja forjável na tela.

---

## BLOCO 7 — E20 interno × E6 visual (111–116)

**111–112.** Confirmado: **E20 permanece como chave técnica**; **E6 é apenas rótulo visual** "Apresentação Digital".

**113. Renomear E20 quebraria:** `relationship_message_library.step_key = 'E20'`; `LIBRARY_STEP_ORDER` e `PENDING_TEXT_STEPS` (`src/server/relationship/message-library.server.ts:47`); os snapshots já gravados em `relationship_message_sends`; a badge `e20` do mapa de cores em `src/components/crm/crm-lead-journey.tsx:54`; as linhas de `relationship_e20_occurrences`; e as chamadas de `issueE20`/`redeemE20`.

**114.** Confirmado: **nenhum dado histórico deve ser renomeado**.

**115–116.** O mapa **existe parcialmente**: `STEP_LABEL` em `src/server/relationship/message-library.server.ts` já traduz `step_key` em rótulo. O que falta é a entrada `E20 → "E6 — Apresentação Digital"` e um `display_order` explícito.

---

## BLOCO 8 — Biblioteca de Conteúdo (117–133)

**117–120.** **21 etapas** em `relationship_message_library`: `E0, E0_V1, E1, E3, E4, E12, V3, V4, R1, R2, R3, RE0, RE1, RE2, RE3, RF0, RF1, E20, E27, FINALIZACAO`. **Com conteúdo real: 18.** Sem texto oficial: **E20, E27, FINALIZACAO** (`PENDING_TEXT_STEPS`). A lista exibida e a lista que o motor conhece são **a mesma** — ambas derivam de `LIBRARY_STEP_ORDER`.

**121. Divergências reais:** (a) 3 etapas com linha e sem texto; (b) **E2, E5, E6, E7 e R0 ausentes** em banco, em `LIBRARY_STEP_ORDER` e em `messages.ts`; (c) `relationship_step_content_bindings` **vazia (0 linhas)** — nenhuma etapa tem material/link vinculado.

**122.** Sim, a ordem parece fora de lugar — mas por um motivo objetivo: **os códigos não são uma sequência**. E12 vem dos templates D1–D12, E20 do convite ao portal, E27 da finalização; são identificadores herdados de comandos diferentes, exibidos na ordem de `LIBRARY_STEP_ORDER`.

**123–125.** `src/lib/relationship/messages.ts` tem **um único consumidor**: `src/server/relationship/message-library.server.ts`. **Sim, é seguro aposentá-la** depois da importação oficial do Word — desde que as linhas da Biblioteca já estejam populadas, já que o servidor passa a depender só do banco.

**126.** **JÁ DEFINIDO.** Versionamento imutável: editar cria nova linha com `version` incrementada e desativa a anterior (`active`).

**127–130.** `relationship_step_content_bindings` mapeia etapa → conteúdo (`relationship_contents`) com ordem, permitindo **múltiplos conteúdos por etapa**. Hoje está **vazia**, então na prática nenhuma etapa tem conteúdo anexo. **Para a próxima implantação, um conteúdo oficial por etapa é suficiente** — a estrutura já suporta múltiplos quando for necessário, sem alteração.

**131–133.** Importação sem risco: o Word entra criando **novas versões** das etapas existentes e novas linhas para etapas inexistentes. **O histórico enviado permanece imutável** porque `recordMessageSnapshot` congelou o texto no envio; a Biblioteca governa **apenas o conteúdo futuro**.

---

## BLOCO 9 — CRM e presença do investidor (134–150)

**134–135.** Sim: **`portal_engagement.last_access_at`**, mantido por `src/server/portal-engagement.server.ts:62-94`, atualizado **a cada evento de engajamento** — não por ping periódico do servidor.

**136–137.** Existe um heartbeat, mas **100% no navegador**: `src/components/journey/journey-tracker.tsx:58-62` dispara a cada **15 s**, apenas com aba visível e interação real desde o último tick, chamando `heartbeat()` de `src/lib/journey/engine.ts:571`, que **escreve em localStorage**. Há varredura de sessões ociosas a cada 5 min (`sweepIdleSessions`). **Não há heartbeat que persista presença no servidor.**

**138.** **Não existe** estado online/offline calculado em lugar nenhum.

**139.** Sim — 15 minutos é um limite adequado, **calculado na leitura** (`now − last_seen_at < 15 min`), sem coluna de status e sem job de expiração.

**140–141.** Hoje o CRM consegue mostrar **"Último acesso"** (dado já disponível em `portal_engagement.last_access_at` e `portal_leads.last_activity_at`); **"Online" ainda não**. A informação deve ser **campo único derivado na leitura**, consumido igualmente por CRM e Workspace — dois mecanismos é exatamente o que produz divergência entre telas.

**142.** Sim — acessar o Manual é atividade real do investidor (o tracker emite `material.viewed` em `journey-tracker.tsx:40-43`).

**143–146.** **JÁ DEFINIDO e implementado.** Abrir card, criar reunião, comentar e enviar mensagem **não são** atividade do investidor: lista branca em `src/lib/events/investor-activity.ts`, aplicada em `src/lib/executive-data.ts:113+`.

**147.** Atividade real = acesso ao Portal/Manual, abertura de apresentação (E20), inbound do investidor e eventos de engajamento originados na navegação dele.

**148–149.** A lista branca é usada por `resolveLeadState`, `listAllInvestors` e `executive-data.ts`. **Não foi encontrado cálculo paralelo de `lastActivity` usando eventos administrativos** — a lista negra antiga foi substituída (comentário em `executive-data.ts:113`).

**150. Busca global por reclassificação para NOVO.** Os emissores de estado hoje são `src/lib/lead-state.ts:129,148,165` (com `dedupeKey` determinística e guarda de mudança real) e `src/components/shared/executive-contact-dialog.tsx:82,92`. Nenhum deles rebaixa para NOVO. **O risco residual não é de reclassificação, e sim de renderização**: o estado é derivado no cliente a partir do barramento local, então uma emissão fora da lista branca em código futuro voltaria a contaminar a tela. **RECOMENDAÇÃO:** mover a derivação do estado operacional para o servidor quando a presença for implementada.

---

## BLOCO 10 — Histórico da Jornada (151–163)

**151–155. Emissores de `lead.status.changed`:**

| Local | Representa mudança real? |
| --- | --- |
| `src/lib/lead-state.ts:129` (`em_andamento`) | **Sim** — só emite com mudança efetiva |
| `src/lib/lead-state.ts:148` (`encerrado`) | **Sim** |
| `src/lib/lead-state.ts:165` (`reabertura`) | **Sim** |
| `src/components/shared/executive-contact-dialog.tsx:82` (`qualificado`) | **Sim**, mas disparado por **ação administrativa** do executivo |
| `src/lib/workspace-alerts.ts:586` | Apenas **leitura/filtro**, não emite |

Todos já possuem `dedupeKey`. O único caso discutível é o do diálogo de contato: é mudança real de estado, porém originada no executivo — deve continuar no histórico e **não** contar como atividade do investidor (e não conta, pela lista branca).

**156–159.** A Jornada oficial (`src/server/relationship/journey.server.ts:88-98`) usa **whitelist relacional**; `investor.reactivated` **não está nela**, portanto **não aparece na Jornada**. Ele é gerado apenas em `src/lib/workspace-alerts.ts:132-137`, dentro de `pushAlert`, restrito a `category === "movimentacao"`. **Confirmado: deve permanecer somente como alerta**, sem persistência e sem entrar na jornada operacional.

**160–162.** **Sim, existem duas linhas do tempo.** A oficial é o agregador `journey.server.ts` (servidor, whitelist). A paralela é o barramento local (`src/lib/events/bus.ts` + `src/lib/investor-profile.ts`, com deduplicação de `lead.status.changed` consecutivos em `:97`), usada pelo perfil do investidor e pelos alertas do Workspace. **Risco de divergência: real** — a local é por navegador, some ao limpar o cache e não é compartilhada entre executivos.

**163. RECOMENDAÇÃO.** Fonte oficial única do histórico exibido ao executivo: **`journey.server.ts`**. O barramento local deve ficar restrito a alertas efêmeros da sessão, nunca a histórico.

---

## BLOCO 11 — Manual do Investidor (164–174)

**164, 168.** **14 capítulos fixos em código**, sem CMS e sem versionamento: `src/lib/journey-data.ts:21-272` (`recepcao`, `proposito`, `velox`, `modelo`, `produtos`, `personalizando-sua-jornada`, `operacao`, `investimento`, `treinamento`, `suporte`, `perfil`, `faq`, `autoavaliacao`, `proximos-passos`), com corpo em `src/components/journey/chapter-bodies.tsx`.

**165–167, 169.** Capítulo 3 = `velox`, função `VeloxBody`, array `timeline` em `chapter-bodies.tsx:106-132`. **"Primeiros anos" está em `chapter-bodies.tsx:113`**, como campo `year` de um item do array. Alterar para "Operação própria" é **edição de uma linha de código, sem migration e sem impacto no restante do capítulo** — não há índice numérico acoplado à timeline.

**170–174.** O vídeo do capítulo 7 é a flag **`hasVideo: true`** em `journey-data.ts:146`, renderizada em `chapter-view.tsx:76-80` pelo `src/components/journey/video-slot.tsx` — **placeholder puro**, texto "Vídeo do especialista — em breve.", sem player e sem dados. **Pode ser removido** alterando só a flag. **Não interfere no progresso/leitura** e **não há regra de conclusão** associada. Observação: existem mais dois placeholders — capítulo 1 `recepcao` (`:34`) e capítulo 14 `proximos-passos` (`:268`).

---

## BLOCO 12 — Princípios Velox (175–186)

**175.** Não é rota: é o overlay `src/components/portal/principios-overlay.tsx`, aberto pelo card `key: "cultura"` / `moduleKey: "principios"` da Home (`src/routes/index.tsx:214-225`, render em `:450-451`).

**176–179.** A imagem interna é carregada pelo próprio componente: `assetUrl("portal-capa-principios")` (`:15,84`), registrada em `src/lib/assets/registry.ts:256-265`. O **card externo usa outro asset** (`experienciasImg.url`, `index.tsx:221`). **São imagens diferentes** — remover o `<figure>` interno (`:82-91`) **não afeta o card**.

**180.** Sim. O cabeçalho (`:76-81`) é JSX hardcoded, independente dos princípios.

**181–182.** Os princípios vêm do **banco**: `portal_institutional_blocks`, via `fetchInstitutionalModule({ module: "principios" })` (`:13,62`); sem bloco cadastrado, caem em `Princípio 0N` + `PLACEHOLDER_BODY` (`:27-28,42-44`). **Substituição pelo conteúdo oficial não exige alteração estrutural** — basta cadastrar os blocos.

**183–185.** Os `<article>` (`:111-143`) **não são clicáveis**: não há `onClick`, `<a>` nem `<button>`. Nada a remover. Manter não clicáveis e adicionar apenas hover é **direto**.

**186. Animação recomendada:** apenas `transform` e `box-shadow` — `transition-transform duration-200 hover:-translate-y-1` com uma sombra sutil, e `motion-reduce:transform-none`. Composita na GPU, sem reflow, sem custo de layout.

---

## BLOCO 13 — Remarketing (187–195)

**187–189.** Layout em `src/routes/f.remarketing.tsx` (subtree) + `src/routes/f.remarketing.index.tsx` (tela). O texto **"Ambiente de Remarketing"** está em `f.remarketing.index.tsx:91` (`<h1>`), com o subtítulo em `:93` ("CRM operacional independente — isolado do CRM de Relacionamento."). É **puramente visual**: **pode ser removido sem qualquer impacto funcional**.

**190, 193–194.** As abas Campanhas/Conversas e o botão de alternância **já existem e funcionam** dentro de `f.remarketing.index.tsx`; **só o layout precisa de ajuste**.

**191–192.** Sim. O que limita a área é o bloco de cabeçalho (h1 `text-2xl md:text-3xl` + parágrafo + espaçamento) somado aos paddings do container da página. O padrão de área cheia já existe no projeto: o board em modo `standalone` usa `h-[100dvh]` com paddings responsivos (`portal-leads-board.tsx`).

**195. Atenção.** A alteração deve ficar **restrita a `f.remarketing.index.tsx`**. Os componentes de conversa são **compartilhados com o CRM** (`src/components/crm/crm-conversation.tsx`) — alterá-los muda o CRM de Relacionamento junto.

---

## BLOCO 14 — Backup (196–210)

**196–199.** Geração em `src/server/backup.server.ts`, fila assíncrona em `src/server/backup-queue.server.ts` (`portal_backup_requests`), agendamento por **`pg_cron`** (não há definição de cron no código da fila — o agendamento vive no banco). Pontos registrados em **`portal_backups`**, conteúdo deduplicado por hash em **`portal_backup_blobs`**, restaurações em `portal_restores`. Retenção automática: `pruneBackups`.

**197.** A frequência **horária** é a configurada, e a retenção atual pressupõe isso: `RETENTION = { fullHours: 48, dailyDays: 7 }` (`:143-152`).

**200–202.** A idade é calculada por diferença de timestamps; o agrupamento diário usa **`Math.floor(at / day)` em UTC** (`:362`). **Sim, é possível adotar America/São_Paulo**, mas exige um campo explícito de **data de referência** calculado no fuso local — não basta trocar a comparação.

**203–207.** A regra pretendida (horários apenas do dia corrente + um ponto de 00:00 por dia anterior, 7 diários) **exige alteração estrutural**: reduzir a janela horária de 48 h para o dia corrente e selecionar o ponto **pelo horário 00:00**, e não pelo "último do dia" como hoje. O backup das 00:00 **pode e deve representar o fechamento do dia anterior** (`reference_date = created_at − 1 dia`, no fuso local). Para garantir **exatamente 7**, o corte precisa ser por **ranking** (`ORDER BY reference_date DESC LIMIT 7`) e não por idade — hoje é por idade, então um dia sem execução produz 6 pontos. **O oitavo é excluído automaticamente** nesse desenho.

**208.** **Sim, risco real e presente.** Com agrupamento em UTC e operação em −03:00, a meia-noite local cai no dia UTC seguinte: o rótulo do dia fica errado por construção e o ponto descartado pode ser o errado.

**209.** Sim. `portal_backups`/`portal_backup_blobs` são armazenamento de pontos; limpar o histórico **não afeta os dados reais do Portal**. Pontos `protected = true` (manuais e pré-restauração) devem ser preservados.

**210. Ponto crítico.** O botão **Restaurar é real, porém parcial por desenho**. `restoreBackupPayload` (`:298-325`) apaga e reinsere por tabela, mas `NEVER_RESTORE_TABLES` (`:59-74`) exclui todo o núcleo operacional: `portal_leads`, `crm_leads`, `crm_pipelines`, `crm_pipeline_stages`, `crm_cadence_tasks`, `crm_sync_runs`, `crm_lead_events`, `crm_messages`, `crm_timeline`, `crm_connections`, `portal_journey_events`, `portal_engagement`, `portal_meetings`, `portal_lead_guard_log`.
Na prática restaura apenas: `campaigns`, `meta_templates`, `news_posts`, `knowledge_documents`, `creative_templates`, `creative_official_model`, `executive_profiles`, `user_roles`, `whatsapp_validations`, `app_user_connections`, `magazine_editions`, `magazine_pages`, `portal_institutional_blocks`.
**O backup captura tudo; a restauração jamais toca leads, conversas, jornada, engajamento ou reuniões.** Isso é a blindagem definitiva e está correto — mas a UI precisa dizer isso ao usuário, hoje não diz.

---

## BLOCO 15 — Perfil do executivo (211–219)

**211–212.** No banco, `executive_profiles` tem **apenas**: `user_id`, `executive_id`, `email`, `name`, `whatsapp`, `created_at`, `updated_at`.

| Campo | Onde está |
| --- | --- |
| nome | banco (`name`) |
| email | banco (`email`) |
| WhatsApp | banco (`whatsapp`) |
| cargo (`title`) | **somente no seed** |
| slug | **somente no seed** |
| foto (`photoUrl`) | **somente no seed** |
| telefone | **somente no seed** |
| vídeo pós-apresentação | **somente no seed/localStorage** |

Seed: `SEED_USERS` em `src/lib/executive-auth.ts:170,193-283`, mesclado com o armazenado em `:313`.

**213–214.** Existe: **`postPresentationVideoUrl`** (`src/lib/executive-auth.ts:158`, mesclado em `:315-316`). **Não é coluna de banco** — vem do seed e da camada `stored` do executive-auth.

**215. Dependentes:** `src/routes/f.executivo.perfil.tsx:123,133,150,164,215-217,282-286` (edição no perfil), `src/routes/f.crm.index.tsx:737` (passa ao CRM), `src/components/crm/crm-conversation.tsx:404,427,712` (usa no envio), `src/lib/crm/post-presentation.ts:16,71` (monta a mensagem). Há também `video_url` em `src/lib/comms.functions.ts:20,70,123`, que é **outro campo**, de comunicados — não confundir.

**216.** **Não exige migration** — o campo não existe no banco. Remover da interface é alteração de `f.executivo.perfil.tsx` apenas.

**217.** Não há fluxo automático: `post-presentation.ts:71` apenas inclui o link **se ele existir** (`const video = (ctx.videoUrl ?? "").trim()`), e o envio é sempre disparado manualmente pelo executivo em `crm-conversation.tsx`.

**218–219.** Confirmado: **tratamento manual pelo executivo, nunca pelo motor**, e **não deve ser requisito de perfil completo**. Recomendação: manter o campo no modelo (é usado no envio), remover a obrigatoriedade e o destaque na tela de perfil, deixando o executivo colar o link no momento do envio.

---

## BLOCO 16 — Visão final (220–250)

### A) JÁ ESTÁ PRONTO
Backend E20 integral (token, TTL 7 d, `expires_at` no servidor, resgate, registro de acessos, encerramento da anterior) · `listE20Occurrences` com todos os campos necessários · versionamento imutável da Biblioteca · `recordMessageSnapshot` · `renderFromLibrary` · normalização de nome com fallback neutro · lista branca de atividade real · Jornada oficial com whitelist · estrutura de prioridade/horário da Agenda (`src/lib/agenda-types.ts`) · constraint `EXCLUDE` de conflito em `workspace_agenda_events` · motor de backup e fila assíncrona · identidade atômica (`resolve_portal_identity`) · abas Campanhas/Conversas do Remarketing · componentes de ficha reutilizáveis.

### B) JÁ ESTÁ CORRETO — NÃO MEXER
`NEVER_RESTORE_TABLES` · uso do ID GreenSales como identidade do lead · `relationship_queue` como motor oficial · E20 como chave técnica · URL da apresentação montada no servidor · cards de Princípios não clicáveis · princípios vindos do banco · `investor.reactivated` fora da Jornada · Manual independente do E20.

### C) SÓ AJUSTE DE INTERFACE
Cabeçalho do Remarketing (`f.remarketing.index.tsx:91-93`) · `<figure>` interno dos Princípios (`:82-91`) + hover · "Primeiros anos" → "Operação própria" (`chapter-bodies.tsx:113`) · remoção do `hasVideo` do capítulo 7 (`journey-data.ts:146`) · remoção da tela de Pendências de Identidade · retirada da obrigatoriedade do vídeo pós-apresentação no perfil.

### D) PRECISA DE ALTERAÇÃO DE CÓDIGO — com dependência
| Item | Depende de |
| --- | --- |
| `action_key` + agregador `DailyAction` | nada — é a fundação |
| Ações do Dia (overlay) | D-1 |
| Agenda e reunião dentro da Ação do Dia | D-1 + espelhamento (E) |
| Rota `f.executivo.investidores.$id` + `onOpenLead` | nada |
| Copiar mensagem renderizada | Biblioteca importada (F) |
| UI da Apresentação Digital (botão de estado) | dados do executivo no banco (E) |
| Fim do fallback para Executivo Padrão (`dispatch.server.ts:66`) | nada |
| Painel administrativo (`/f/admin`) | RLS E20 (E) + decisão de papel (F) |
| Aposentar `messages.ts` | Biblioteca importada (F) |
| Presença: campo próprio + "online" derivado | E (coluna/campo de presença) |
| Adoção de `unitPath()` nos ~153 literais | nada |
| Inversão `/` institucional × `/f` | `unitPath()` adotado |
| Retenção de backup com data de referência | E (campo `reference_date`) |
| Papel ativo em vez de ID (`portal-workspace.ts:19-49`) | F |

### E) PRECISA DE ALTERAÇÃO DE BANCO
1. `executive_profiles`: colunas `slug` (único, validado contra slugs reservados), `title`, `photo_url`, `phone`.
2. RLS de `relationship_e20_occurrences` e `_accesses`: trocar `is_portal_member()` por `can_access_investor(lead_id)`.
3. `relationship_step_content_bindings`: popular (hoje vazia).
4. Biblioteca: novas versões vindas do Word + etapas ausentes.
5. `workspace_module_permissions`: novos `module_key` (`remarketing`, `apresentacoes`, `admin_global`).
6. Espelhamento da reunião confirmada como evento `maxima` em `workspace_agenda_events`.
7. `portal_backups`: campo de data de referência em fuso local + corte por ranking.
8. `lead_notes` (notas do executivo) — hoje em localStorage.
9. Campo de presença (`last_seen_at`), fora da lista branca de atividade.

### F) PRECISA DE DECISÃO DE PRODUTO
| # | Decisão | Recomendação |
| --- | --- | --- |
| F1 | Prefixo Solar: `s` ou `/sol` | manter `s`; se a marca exigir `/sol`, manter `s` como alias |
| F2 | Etapas E2, E5, E6, E7, R0 | criar somente as que o Word definir, como `step_key` novos, sem renumerar |
| F3 | Texto oficial de E20/E27/FINALIZACAO | cadastrar na Biblioteca a partir do Word |
| F4 | Papel híbrido do Tiago | acesso pelo **papel ativo**, não pelo ID |
| F5 | Apresentação após transferência de responsável | encerrar a ocorrência ativa; novo responsável gera a sua |
| F6 | Central de Templates (`crm_meta_templates` vazia) | remover; reintroduzir se o E0 real via Meta for ativado |
| F7 | Notas do executivo | criar `lead_notes`, preservando `portal_leads.notes` |
| F8 | Retenção de backup | 7 pontos diários por ranking, com data de referência local |

### G) DEPENDE DE ITEM ANTERIOR
Ações do Dia → `action_key` · Copiar mensagem → Biblioteca importada · Apresentação na UI → perfil no banco + RLS · Painel admin → RLS + F4 · Inversão de rotas → `unitPath()` · Presença no CRM/Workspace → campo de presença.

### 222–224. Ordem técnica e agrupamentos

1. **`action_key` + agregador de leitura** (fundação; nada depende de banco).
2. **Agenda + reunião espelhada no agregador** — resolve o único risco ALTO enquanto a superfície é pequena.
3. **Rota da ficha + `onOpenLead`** — isolado, sem migration.
4. **Importação do Word na Biblioteca**, `display_order`, bindings, aposentadoria de `messages.ts`.
5. **E1–E4 na Ação do Dia** com texto renderizado e Copiar.
6. **Perfil do executivo no banco** → **UI da Apresentação Digital** + **RLS E20** + **painel administrativo**.
7. **Presença do investidor.**
8. **Manual e Princípios** (risco zero).
9. **Remarketing (layout).**
10. **Retenção de backup.**
11. **Inversão `/` × `/f`** (com `unitPath()` já adotado).
12. **Remoções de legado** (Templates, Pendências de Identidade) — por último.

**Podem ir juntos, sem aumento de risco:** 3 + 8 + 9 (interface isolada); 6 em bloco único (perfil + RLS + UI + painel são o mesmo domínio); 12 com qualquer item, desde que os substitutos já estejam no ar.
**NÃO devem ir juntos:** 1/2 com 11 (agregador e reescrita de rotas mexem no mesmo caminho de navegação); 4 com 5 (importar conteúdo e consumi-lo na mesma entrega esconde a origem de qualquer erro de texto); 10 com qualquer coisa (fuso e exclusão de dados exigem janela dedicada); 7 com 1/2 (presença encosta na regra do NOVO — o item mais sensível do projeto).

### 225–231. Problemas arquiteturais e contradições encontradas

1. **Fallback para o Executivo Padrão** (`dispatch.server.ts:29,65-66`) **contradiz diretamente** `post-presentation.ts:8-9` — link do portal de outro executivo enviado ao investidor. *(contradição, aberta)*
2. **Papel híbrido decidido por ID** (`portal-workspace.ts:19-49`) contradiz o comentário do próprio arquivo (`:130-133`). *(contradição, aberta)*
3. **Duas linhas do tempo:** `journey.server.ts` (oficial) × barramento local `bus.ts`/`investor-profile.ts`. *(duplicidade de fonte de verdade)*
4. **Duas fontes de texto de mensagem:** Biblioteca × `messages.ts`. *(duplicidade)*
5. **Duas fontes de compromisso:** `portal_meetings` × `workspace_agenda_events`, sem precedência. *(duplicidade)*
6. **Dois motores de tarefa:** `relationship_queue` × `crm_cadence_tasks`, e `agenda_cadence_tasks` lê **só o legado** — a Agenda hoje **não enxerga mensagens pendentes**. *(legado em uso)*
7. **Frontend calculando o que deveria vir do servidor:** estado operacional do lead e histórico derivados do barramento local. *(230)*
8. **Presença e observações vivendo em localStorage:** `journey/engine.ts` (heartbeat) e `investor-comments.ts` (notas) guardam no navegador dados que deveriam ser persistidos. *(231)*
9. **Perfil do executivo em seed de código** (`SEED_USERS`) em vez de banco. *(duplicidade de fonte)*
10. **Sem guard server-side por módulo:** `requiresRole` governa menu, não rota.
11. **`unitPath()` com zero uso** e 153 literais — dívida que trava a reorganização de rotas.
12. **Legado em uso sem necessidade:** Central de Templates com `crm_meta_templates` **vazia**; tela de Pendências de Identidade somente leitura; três `VideoSlot` placeholder no Manual.
13. **Novo:** `pruneBackups` não conhece restaurações em andamento — não há lock entre a fila e a restauração, e o ponto de origem de uma restauração em curso **não é protegido**.
14. **Novo:** a UI de restauração não informa que o núcleo operacional nunca é restaurado — o usuário pode presumir uma reversão completa que não acontece.

### 232–246. Riscos mapeados
- **232 Duplicidade de ações:** três fontes sem chave comum.
- **233 Duplicidade de mensagens:** fila oficial + legado + envio manual sem `action_key`.
- **234 Geração duplicada de apresentação:** ausência de leitura da ocorrência ativa antes de emitir.
- **235 Histórico da Biblioteca:** nenhum — snapshot congela o enviado.
- **236 E20/E6:** alto **se** houver renome; nulo mantendo a chave técnica.
- **237 Rotas ao inverter `/`:** links E0/E20 já entregues deixariam de resolver.
- **238 Ambiente administrativo:** acesso por URL direta, sem guard por módulo.
- **239 Apresentação de outro executivo:** `is_portal_member()` deixa qualquer colaborador ler todas as ocorrências E20.
- **240 Link válido após transferência:** a ocorrência não é reavaliada; o link continua apontando para o portal do executivo anterior.
- **241 Duplo clique invalidando apresentação válida:** `issueE20` encerra a anterior a cada chamada.
- **242 Fuso da Agenda:** classificação de atraso/hoje precisa ser explicitamente America/São_Paulo.
- **243 Fuso dos backups:** agrupamento em UTC descarta o ponto errado.
- **244 Presença:** heartbeat só no navegador; se o ping entrar na lista branca, a regra do NOVO quebra de novo.
- **245 Jornada:** segunda timeline local pode divergir da oficial.
- **246 NOVO/EM ANDAMENTO/ENCERRADO:** derivação no cliente.

### 247. Já resolvidos pelo código atual
235 (snapshot imutável) · 245 parcialmente (whitelist na Jornada oficial impede poluição do histórico servidor) · 246 na regra (lista branca + `dedupeKey` + guarda de mudança real, com 13 testes passando) · conflito evento × evento de prioridade máxima (constraint `EXCLUDE`) · integridade de leads na restauração (`NEVER_RESTORE_TABLES`) · proteção contra exclusão de leads (gatilhos + `portal_lead_guard_log`).

### 248–249. Abertos e solução recomendada
| Risco | Solução |
| --- | --- |
| 232/233 | `action_key` + `Map` com precedência agenda > reunião > fila > legado |
| 234/241 | ler a ocorrência ativa antes de emitir; botão de estado; "Gerar novo link" como ação secundária confirmada |
| 236 | manter `step_key = 'E20'`; E6 só como rótulo em `STEP_LABEL` |
| 237 | adotar `unitPath()` antes; `portal-brands.ts` como fonte única de link |
| 238 | verificar papel dentro de cada server function do subtree admin, não só no menu |
| 239 | trocar `is_portal_member()` por `can_access_investor(lead_id)` na RLS das tabelas E20 |
| 240 | encerrar a ocorrência ativa no ato da transferência |
| 242 | relógio America/São_Paulo no agregador, padrão de `e0-window.ts` |
| 243 | `reference_date` calculada em fuso local + corte por ranking; proteger o ponto de origem de restauração em curso |
| 244 | campo de presença próprio, derivado na leitura (15 min), **fora** da lista branca |
| 245 | `journey.server.ts` como única fonte de histórico; barramento local só para alerta efêmero |
| 246 | mover a derivação do estado operacional para o servidor junto com a presença |

### 250. PRONTO PARA CONSTRUÇÃO
Itens com informação técnica suficiente para receber comando de construção **sem novas perguntas**:

1. `action_key` e agregador `DailyAction` (estrutura definida acima).
2. Overlay "Ações do Dia" com blocos de ordenação e fuso São Paulo.
3. Agenda e reunião dentro da Ação do Dia, sem duplicação.
4. Espelhamento da reunião confirmada como evento `maxima`.
5. Rota `f.executivo.investidores.$id` + correção de `onOpenLead`, reutilizando `crm-lead-ficha.tsx` / `investor-profile-view.tsx`.
6. Botão de estado da Apresentação Digital (gerar → copiar, novo link como ação secundária).
7. RLS das tabelas E20 via `can_access_investor(lead_id)`.
8. Migração de `slug`, `title`, `photo_url`, `phone` para `executive_profiles`.
9. Fim do fallback para Executivo Padrão em `dispatch.server.ts:66`.
10. Encerramento da ocorrência E20 na transferência de responsável.
11. Manual: "Primeiros anos" → "Operação própria" e remoção do vídeo do capítulo 7.
12. Princípios: remoção do `<figure>` interno e hover leve.
13. Remarketing: remoção do cabeçalho e ocupação de área cheia (restrito a `f.remarketing.index.tsx`).
14. Remoção da tela de Pendências de Identidade, mantendo `resolve_portal_identity` e as colunas.
15. Remoção da obrigatoriedade do vídeo pós-apresentação no perfil.
16. Presença: `last_seen_at` + "online" derivado por 15 min, fora da lista branca.
17. Adoção de `unitPath()` nos literais `/f/...` (preparo para a inversão de rotas).

Fora desta lista, os itens dependem das decisões F1–F8, com destaque para a **importação do Word** (bloqueia toda a frente de mensagens) e a **nomenclatura da unidade Solar**.

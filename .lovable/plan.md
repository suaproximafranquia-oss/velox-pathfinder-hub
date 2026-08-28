# Auditoria prévia à Etapa B — respostas 1 a 20

Nenhuma alteração de código, banco ou migration foi feita nesta rodada.

## 1. Estrutura atual do /f
Existem hoje 36 rotas sob `/f`: `f.executivo.*` (30 telas + `f.executivo.index`), `f.crm.tsx` (layout) + `f.crm.index.tsx`, `f.remarketing.tsx` (layout) + `f.remarketing.index.tsx`, `f.portal-leads.tsx` e `f.$slug.tsx` (link público de executivo).
As 30 rotas antigas `executivo.*.tsx` mais `crm.tsx`, `remarketing.tsx` e `portal-leads.tsx` continuam existindo, porém **todas** são stubs: `beforeLoad` com `throw redirect({ replace: true, search })` e `component: () => null` (13 linhas cada). Verifiquei arquivo por arquivo: nenhuma rota antiga renderiza aplicação nem contém lógica própria. Não há duplicação de telas — o componente real existe apenas em `/f`.
Status: **já está correto**.

## 2. Ausência de `src/routes/f.tsx`
Não existe rota-pai `/f`. O agrupamento é apenas nominal (arquivos com prefixo `f.`), e `f.crm.tsx` / `f.remarketing.tsx` são layouts locais de cada módulo. O papel de "unidade de negócio" é cumprido por `src/lib/business-unit.ts` (helpers) e por `src/routes/__root.tsx` (`resolveShell`, `isOperationalPath`).
Consequências reais (lacuna, não só diferença de implementação):
- não há ponto único para `beforeLoad` de guard de sessão da unidade;
- não há head/meta (`robots: noindex`) herdado por toda a área interna;
- `/f` sem nada depois cai em 404 do root;
- cada nova tela precisa repetir prefixo e guard.
Recomendação para a Etapa B: criar `src/routes/f.tsx` como layout com `beforeLoad` (guard) + `<Outlet />`. Atenção: com `f.$slug.tsx` existente, o layout passa a envolver também o link público do executivo — o guard precisa ficar no nível `/f/executivo`, `/f/crm`, `/f/remarketing`, `/f/portal-leads`, não no `/f` cru.

## 3. business-unit.ts
`BUSINESS_UNITS` já declara financeira/solar/seguros com `prefix` e flag `operational`, e `unitPath()` monta o caminho. Estruturalmente serve para escalar sem reconstruir.
Porém `unitPath()` é usado apenas **3 vezes** em todo o `src`. Há strings `/f/...` manuais em ~35 arquivos, com concentração em:
- `src/components/executive/executive-shell.tsx` (24 ocorrências — menu lateral inteiro);
- `src/routes/__root.tsx` (6, em `resolveShell`/flags);
- `src/routes/f.executivo.dashboard.tsx` (6), `f.executivo.administracao.tsx` (5), `f.executivo.laboratorio.tsx` (4);
- praticamente todas as demais `f.executivo.*` com 2–3 navegações de guard (`navigate({ to: "/f/executivo" })`).
Observação técnica: TanStack Router exige literais tipados em `to=`; `unitPath()` retorna `string` e não é type-safe em `<Link to>`. Padronizar exige decidir entre helper com `as never` ou manter literais. **Precisa de decisão.**

## 4. Slugs reservados
- Validação de leitura: `getExecutiveBySlug()` (`src/lib/executive-auth.ts:511-517`) retorna `null` para slug reservado — ou seja, um link `/f/crm` nunca resolve para executivo.
- Validação de escrita: **não existe bloqueio**. Em `src/routes/f.executivo.usuarios.tsx:49-59`, `slugifyEmail()` chama `safeExecutiveSlug()`, que **transforma** (`crm` → `crm-velox`) em vez de recusar. O slug é derivado do e-mail e não há campo editável de slug na UI (o `draft.slug` existe mas não é exposto/consumido na gravação).
Efeito prático: o conflito não acontece hoje, mas a regra arquitetural "bloquear cadastro" não está implementada; está "silenciosamente corrigida". **Precisa de decisão/correção** (erro de validação visível vs. transformação silenciosa) e a regra deve cobrir também qualquer edição futura de slug.

## 5. Conflito /f/$slug
TanStack Router dá precedência a segmentos estáticos sobre dinâmicos, então `/f/executivo`, `/f/crm`, `/f/remarketing`, `/f/portal-leads` sempre ganham de `/f/$slug`. Confirmado pela árvore gerada e pela navegação já validada.
Risco: se um executivo **já publicado** tiver um desses slugs, o link deixa de funcionar silenciosamente (`getExecutiveBySlug` devolve `null`). A lista reservada (`RESERVED_UNIT_SLUGS`) cobre os quatro segmentos estáticos atuais, mas é manual: qualquer nova rota estática sob `/f` criada sem atualizar a lista reintroduz o conflito. Não há teste/verificação automática ligando rotas estáticas ↔ lista reservada.

## 6. Redirecionamentos legados
Todas as 33 rotas antigas usam `replace: true` e repassam `search`. Nenhuma renderiza a aplicação e nenhuma tem lógica própria. Ponto de atenção: os stubs propagam `search` mas nenhum deles tem `params` dinâmicos, então não há perda. **Já está correto.**

## 7. Proteção das áreas internas
Não existe guard único. Cada tela repete o padrão em `useEffect`: `getSession()` → `navigate({ to: "/f/executivo" })`. Exemplos: `f.portal-leads.tsx:41-46`, `f.remarketing.index.tsx:37-41`, `f.executivo.usuarios.tsx`, e `CrmShell` (`src/components/crm/crm-shell.tsx`) que renderiza formulário de login inline.
Consequências:
- a checagem é **client-side e pós-montagem**: no SSR/primeiro frame o componente monta e só depois redireciona. Em telas que renderizam antes de `session` estar setado pode haver flash; a maioria faz `if (!session) return null`, mitigando, mas o carregamento de dados protegido depende de RLS, não do guard.
- níveis diferentes: CRM tem shell com login inline + expiração de 4h; Portal dos Leads e Remarketing apenas redirecionam; Executivo tem shell próprio com `navigate("/entrar")`.
- a proteção efetiva dos **dados** é o RLS + `requireSupabaseAuth` nas server functions, não a rota.
Conclusão: o requisito "sem sessão executiva válida, não renderizar o ambiente interno" é atendido **na prática visual**, mas não arquiteturalmente. **Precisa ser corrigido** (guard único em layout).

## 8. Remarketing e shell global
`resolveShell()` (`__root.tsx:144-153`) não lista `/f/remarketing`; ele cai no default `"manual"`. E em `RootRoutes` as flags `isCrm`/`isLeadsPortal` também não o incluem, então o Remarketing hoje é renderizado dentro de `EditorialShell variant="manual"` + `<JourneyChrome>` + `<WhatsAppFloating>` + `<JourneyTracker>` — cabeçalho editorial e botão flutuante de WhatsApp sobre um ambiente operacional que já tem header próprio fixo.
Não parece intencional: `isOperationalPath()` reconhece `/f/remarketing`, logo a **Agenda aparece** ali, mas o shell não. É uma inconsistência real (**diferente da arquitetura definida**), com risco de sobreposição visual e de rastreio de jornada indevido em ambiente interno.

## 9. Agenda — identidade do executivo
Fluxo real: o cliente (`agenda-dock.tsx`) envia `session.userId` como `executiveId`; `listAgenda`/`createAgendaEvent` (`src/lib/agenda.functions.ts`) usam `.middleware([requireSupabaseAuth])` e o client `context.supabase` (RLS como usuário), **mas não comparam** o `executiveId` recebido com o usuário autenticado — o servidor confia no valor.
A barreira efetiva é o RLS de `workspace_agenda_events`: leitura/escrita exigem `executive_id = current_executive_id()` OU `has_role(admin)`. Então, alterando o `executiveId` no navegador, um executivo comum não obtém dados de outro (retorna vazio, sem erro), e um admin obtém — hoje sem tela para isso e sem auditoria.
Riscos: (a) `portal_meetings` tem política mais ampla (admin, manager, `can_access_investor`), então um manager pode listar reuniões de outro executivo pela Agenda passando outro id; (b) `crm_cadence_tasks` só é legível por admin/manager — **executivo comum não vê tarefas de cadência na Agenda**, falha silenciosa; (c) `createAgendaEvent` pode tentar gravar com `executive_id` alheio e o insert falha por RLS com mensagem genérica.
Recomendação: derivar `executiveId` no servidor via `current_executive_id()` e aceitar override só com papel admin explícito.

## 10. Agenda — conflito de horário
A verificação é 100% aplicacional (`createAgendaEvent`), reutilizando `listAgenda` na janela do dia. Falhas identificadas:
- a consulta filtra por `starts_at` entre início e fim do dia → **evento/reunião que começou antes e termina dentro do novo horário não é encontrado** (sobreposição não detectada);
- eventos atravessando meia-noite não são cobertos (a janela é derivada de `start`/`end` com `setHours` no fuso do servidor, que é UTC — não America/Sao_Paulo);
- reuniões sem `duration_min` assumem 30 min por default;
- não há constraint/índice de exclusão (`EXCLUDE USING gist` com `tstzrange`) nem lock: **duas criações simultâneas passam as duas** (TOCTOU).
Status: **precisa ser corrigido** se o bloqueio for requisito duro.

## 11. Agenda — reuniões existentes
Fonte: `portal_meetings`, filtrada por `executive_id` e `scheduled_at`. São somente leitura na Agenda (`readOnly: true`, id prefixado `meeting:`), portanto não há duplicação com eventos próprios nem risco de escrita. Reuniões com `status = "Cancelada"` são descartadas — mas outros status (ex.: "Realizada", "Reagendada") aparecem. Duração: `duration_min` ou 30 min. O horário é o mesmo `scheduled_at` usado pelo módulo de reuniões (`/f/executivo/reunioes`), sem transformação. **Já está correto**, com a ressalva do filtro de status e da janela por `scheduled_at` (item 10).

## 12. Agenda — cadência
Confirmado: a Agenda apenas **lê** `crm_cadence_tasks` com `status = 'pendente'` e `due_date` na janela. Não cria, não altera, não conclui tarefas. As tarefas vêm do motor (`src/server/crm/cadence.server.ts` / `src/server/relationship/*`).
Duas regras que a Agenda está assumindo indevidamente: (a) o **horário** 09:00 (item 13); (b) a **prioridade mínima fixa** e o rótulo `D{step_day} · Ligação/Mensagem`, que é interpretação de canal feita na camada de apresentação. Além disso, a descoberta das tarefas passa por `portal_leads` do executivo (item 14), o que reintroduz regra de propriedade dentro da Agenda.

## 13. Agenda — horário 09:00 / -03:00
É representação visual: `new Date(\`${t.due_date}T09:00:00-03:00\`)`. `crm_cadence_tasks.due_date` é uma **data**, sem hora; o motor decide a janela real de envio (09–21h, Seg–Sáb) em outro lugar.
Problemas potenciais: horário preferencial configurado pelo usuário é ignorado; o offset `-03:00` está fixo no código (o Brasil não tem horário de verão hoje, mas o valor é literal, não `America/Sao_Paulo`); quando tarefas tiverem hora própria, o 09:00 vai mentir; e o item entra na mesma lista dos eventos em UTC, podendo aparecer no dia errado para clientes em outro fuso. **Precisa ser definido** (coluna de horário na tarefa ou horário derivado da janela do motor).

## 14. Agenda — fonte de dados e performance
`listAgenda` faz 4 consultas: eventos, reuniões, **todos os leads do executivo** (`select id,name` sem limite) e depois tarefas via `.in("lead_id", [...])`.
- Sim, existe o risco apontado: carregar toda a carteira só para descobrir tarefas. Com centenas/milhares de leads o `IN (...)` cresce sem limite e pode estourar tamanho de URL do PostgREST.
- É possível evitar: `crm_cadence_tasks` seria consultada diretamente se tivesse `executive_id` denormalizado, ou via join/`view` no banco filtrando por responsável. Hoje a tabela não tem coluna de responsável.
- Índices: `workspace_agenda_events(executive_id, starts_at)` e `portal_meetings(executive_id, scheduled_at)` existem e atendem. Falta índice útil para a Agenda em `crm_cadence_tasks` — os existentes são `(lead_id, channel)` e o único `(lead_id, channel, cycle_date, step_day)`; não há índice por `due_date`/`status`.
- Além disso o RLS de `crm_cadence_tasks` (admin/manager) faz a seção de cadência aparecer vazia para executivos comuns.

## 15. portalvelox.com.br — Grupo Velox
Hoje a raiz `/` é o **Portal do Investidor da Financeira** (`src/routes/index.tsx`), com Gateway, overlays de módulos e `resolveShell("/") = "portal"`. O domínio não é considerado em lugar nenhum do roteamento: não há detecção de host, tudo é servido pelo mesmo app em qualquer domínio.
É possível criar o ambiente institucional do Grupo sem tocar em Home/Portal/Manual, mas exige uma decisão: (a) nova rota `/grupo` (ou `/velox`) como institucional e a Home do investidor permanece em `/` — mais seguro; ou (b) trocar `/` pelo institucional e mover o Portal do Investidor para uma rota própria — quebra links publicados, `/origem/tiktok|meta`, `/f/$slug`, `/e/$slug` e o fluxo de Gateway, todos apontando para `/`. **Precisa de decisão**, e recomendo (a) com redirecionamento por host apenas se realmente forem domínios distintos.

## 16. Isolamento do portal institucional
Esconder link não basta, correto. O que a arquitetura atual oferece e o que falta:
- roteamento: as áreas internas continuam acessíveis por URL em qualquer domínio (nenhum guard de servidor);
- guard: hoje é client-side por tela (item 7);
- dados: RLS e `requireSupabaseAuth` já impedem leitura sem sessão — esta é a única barreira forte hoje.
Recomendação (Etapa B): guard único em layout com `beforeLoad` server-aware para os quatro prefixos internos, `robots: noindex` herdado, nenhum link do institucional para `/f`, e — se `portalvelox.com.br` for um host separado do host operacional — bloqueio por host no `beforeLoad` do layout `/f`. Nunca depender de ocultar navegação.

## 17. Captação de leads do Grupo
Estrutura reutilizável: o padrão de `src/routes/origem.$channel.tsx`, em que a **rota** define a origem e o formulário não recebe origem alguma. A origem deve ser derivada do caminho clicado (ex.: `/grupo/financeira/contato`) no servidor, nunca de campo do formulário nem de query editável.
Persistência: `portal_leads` já tem `origin`, `scope`, `campaign`, `material`, `external_source` e a função atômica `resolve_portal_identity`. Para Financeira, reutilizar exatamente o caminho atual. Para Solar/Seguros, a origem precisa gravar unidade + status próprio (ver 18/19). A validação de origem deve ser por allowlist no servidor (`financeira | solar | seguros`), rejeitando qualquer outro valor.

## 18. Destino dos leads Financeira / Solar / Seguros
- **Financeira**: nada muda; o lead segue por `portal_leads` + Portal dos Leads + motor de relacionamento.
- **Solar / Seguros**: o requisito (nome, telefone, e-mail, origem, status, botão "Atendido") é incompatível com `portal_leads`, porque essa tabela é o gatilho de toda a maquinaria financeira: guard de exclusão (`portal_lead_guard_log`), sync GreenSales, distribuição/carteira, cadência, jornada, engajamento, backups. Inserir Solar/Seguros ali obrigaria a filtrar por unidade em dezenas de leitores (`src/lib/executive-data.ts`, `portal-leads.functions.ts`, `crm/*`, `relationship/*`) — risco alto de contaminação e regressão exatamente no que é intocável.
Recomendação: **estrutura nova e minimalista**, isolada, sem qualquer vínculo com o motor.

## 19. Modelo de dados dos leads do Grupo
A) Poderiam armazenar: `portal_leads` (tecnicamente sim, arquiteturalmente não recomendado).
B) **Não devem ser usadas**: `crm_leads`, `crm_cadence_tasks`, `relationship_*`, `remarketing_*`, `portal_engagement`, `portal_journey_events`, `portal_meetings` — todas assumem jornada/cadência.
C) Campos existentes que representam o que se pede, em `portal_leads`: `origin` (origem), `scope` (carteira/unidade), `commercial_state` + `closed_at` (status de atendimento). Ou seja, o vocabulário existe, mas dentro do domínio financeiro.
D) **Sim, é necessária uma tabela nova**, por exemplo `group_leads` com: `id`, `unit` (`solar` | `seguros`, com CHECK), `name`, `phone`, `email`, `origin`, `status` (`novo` | `atendido`), `handled_at`, `handled_by`, `created_at`, `updated_at`, RLS por papel interno + GRANTs. Motivo objetivo: isolamento total do fluxo financeiro, ausência de gatilhos de guarda/sync, e ausência de campos de jornada que ninguém preencherá. Nenhum lead Solar/Seguros deve existir em `portal_leads`.

## 20. Impacto e plano da Etapa B
1. **Afetados**: `src/routes/__root.tsx` (shell do Remarketing + institucional), novo layout `/f`, novas rotas institucionais e de captação, `src/lib/business-unit.ts`, `src/routes/f.executivo.usuarios.tsx` + `src/lib/executive-auth.ts` (slug), `src/lib/agenda.functions.ts` (identidade/conflito/performance).
2. **Não tocar**: `src/routes/index.tsx` e o fluxo do Gateway, `src/components/crm/portal-leads-board.tsx`, `src/lib/portal-leads.functions.ts`, `src/server/crm/*`, `src/server/relationship/*`, `src/server/greensales.server.ts`, tabela `portal_leads` e seus gatilhos, `/origem/$channel`, `/f/$slug`, `/e/$slug`.
3. **Reutilizar**: padrão de origem-por-rota do `origem.$channel`, `business-unit.ts`, `EditorialShell`, componentes de formulário e `sonner`, RLS/`has_role` já existentes.
4. **Novo**: rotas institucionais do Grupo, rota de captação por unidade, tabela `group_leads`, fila operacional Solar/Seguros, layout-guard `/f`.
5. **Corrigir antes/durante**: shell do Remarketing (item 8); guard único (7); identidade do executivo na Agenda (9); bloqueio real de slug reservado (4). Conflito de horário (10) e performance da Agenda (14) podem ser etapa própria.
6. **Riscos de regressão**: mudar `/` quebrar links publicados; layout `/f` envolver `/f/$slug` e bloquear link público; guard server-side derrubar prerender; contaminação de `portal_leads`; alterar `resolveShell` afetar CRM/Portal dos Leads.
7. **Testes obrigatórios**: `/f/$slug`, `/e/$slug`, `/origem/tiktok|meta` continuam públicos; `/` do investidor intacto; redirects legados; acesso a `/f/*` sem sessão não renderiza; Agenda abre nos quatro ambientes; captação grava origem correta e Solar/Seguros não aparecem no Portal dos Leads nem no CRM; contagem de `portal_leads` inalterada antes/depois.
8. **Ordem segura**: (1) correções estruturais do `/f` (layout+guard, shell do Remarketing, slug); (2) institucional do Grupo em rota nova, sem tocar em `/`; (3) captação com origem derivada da rota, Financeira usando o fluxo atual; (4) tabela `group_leads` + fila Solar/Seguros com botão "Atendido"; (5) endurecimento da Agenda (identidade, conflito, performance).

---

## A) Pontos já corretos
Rotas `/f` sem duplicação; 33 redirects legados com `replace` + `search`; precedência de rota estática sobre `/f/$slug`; Agenda como consumidora somente leitura de reuniões e cadência; índices de `workspace_agenda_events` e `portal_meetings`.

## B) Pontos que precisam de decisão
Criação e escopo do layout `/f`; padronização `unitPath()` vs literais tipados; bloquear ou transformar slug reservado; horário real das ações de cadência; `/` institucional vs rota nova para o Grupo; se admin pode ver a agenda de terceiros.

## C) Diferentes da arquitetura definida
Ausência de rota-pai `/f`; ausência de guard único; Remarketing herdando shell editorial + JourneyChrome + WhatsApp flutuante; `safeExecutiveSlug` transformando em vez de bloquear; Agenda confiando no `executiveId` do cliente.

## D) Estruturas reutilizáveis
`business-unit.ts`, padrão origem-por-rota, `portal_leads` (só Financeira), `resolve_portal_identity`, RLS/`has_role`/`current_executive_id`, `EditorialShell`, `AgendaDock`.

## E) Novas estruturas necessárias
`src/routes/f.tsx` (layout + guard), rotas institucionais do Grupo, rota de captação por unidade, tabela `group_leads` com RLS e GRANTs, tela de fila Solar/Seguros.

## F) Riscos de regressão
Quebra de links publicados; bloqueio acidental de `/f/$slug`; contaminação de `portal_leads`; mudança de shell afetando CRM/Portal dos Leads; falha silenciosa por RLS na Agenda.

## G) Ordem recomendada
Conforme item 20.8.

## H) Confirmação
"Não implementei nenhuma alteração nesta rodada."

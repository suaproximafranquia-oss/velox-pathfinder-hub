# Auditoria Técnica Pré-Implantação — Fotografia do Estado Atual

Somente leitura. Nenhuma alteração de código, banco ou componentes foi feita.

## BLOCO 1 — Arquitetura geral e estado atual

1. **Arquitetura.** Uma única árvore de rotas TanStack, dois grandes grupos:
   - Público / Portal do Investidor: `src/routes/index.tsx` (Home + overlays), `src/routes/manual/*`, links personalizados `e.$slug.tsx`, `f.$slug.tsx`, `s.$slug.tsx`, `seg.$slug.tsx`, `origem.$channel.tsx`, `portal.convite.$token.tsx`.
   - Operacional sob `/f`: `f.tsx` (pai neutro), `f.executivo.*` (Workspace, ~38 rotas), `f.crm.tsx` + `f.crm.index.tsx` (CRM), `f.remarketing.*`, `f.portal-leads.tsx`.
   - Agenda: não é rota — é dock global `src/components/agenda/agenda-dock.tsx` montado no `__root.tsx`, com dados em `src/lib/agenda.functions.ts` / `workspace_agenda_events`.
   - Rotas legadas de topo (`crm.tsx`, `remarketing.tsx`, `portal-leads.tsx`, `executivo.*`) são stubs de `redirect` para `/f/...`.
2. **Rotas do Portal do Investidor:** `index.tsx`, `manual/index.tsx`, `manual/$chapter.tsx`, `manual/anuncio.tsx`, `manual/concluido.tsx`, `e.$slug.tsx`, `f.$slug.tsx`, `s.$slug.tsx`, `seg.$slug.tsx`, `origem.$channel.tsx`, `portal.convite.$token.tsx`.
3. **Portal sem autenticação:** `src/routes/index.tsx` (`createFileRoute("/")`), sem guard; só gateway de identificação (`index.tsx:246-336`).
4. **`/f`:** `src/routes/f.tsx:12-13` — camada NEUTRA, apenas `<Outlet />`, sem autenticação e sem visual. O bloqueio vive nos filhos (`f.executivo.tsx:17` com `OperationalGuard`).
5. **Módulo "Portal do Investidor" no Workspace:** aponta para `/` — `src/config/modules.ts:47-56` (`href: "/"`, `external: true`).
6. **Diferenciação institucional x Velox Financeira: NÃO EXISTE.** A Home é única e compartilhada. `src/lib/business-unit.ts:1-33` modela apenas prefixos de rota (`f`/`s`/`seg`), não dois produtos.
7. **Arquivos responsáveis por essa diferenciação, se fosse criada:** `src/lib/business-unit.ts`, `src/lib/portal-brands.ts`, `src/routes/index.tsx`, `src/config/modules.ts`.
8. **`/f` é namespace funcional** (pai único da unidade operacional + prefixo dos links personalizados), não apenas visual — mas `/f/{slug}` público é somente redirecionador.
9. **Links para `/`:** `src/routes/__root.tsx:45,83`, `src/routes/index.tsx:536`, `src/components/editorial/module-chrome.tsx:66`, `src/components/journey/journey-chrome.tsx:41`. São coerentes com o comportamento atual (todo `/f/{slug}` redireciona para `/`). Se o Portal passar a viver em `/f`, esses são os pontos a revisar.
10. **Construção dinâmica do link do Portal:** `src/lib/portal-brands.ts:69-91` (`investorPortalPath`, `investorPortalUrl`, fallback `window.location.origin` e hardcode `https://velox-pathfinder-hub.lovable.app`). Consumidores: `src/lib/journey/campaigns.ts`, `src/lib/portal-session.ts`, `src/routes/f.crm.index.tsx`, `src/routes/f.executivo.dashboard.tsx:576`, `src/server/crm/automation.server.ts`, `src/server/relationship/dispatch.server.ts:30,66-72`.
11. **Sim**, existe URL personalizada por executivo: `/{prefixo}/{slug}`.
12. **Armazenamento:** o slug do executivo é hardcoded em `src/lib/executive-auth.ts:170,193-283` (`SEED_USERS`); **não existe coluna `slug` em `executive_profiles`** (colunas reais: `user_id, executive_id, email, name, whatsapp, created_at, updated_at`). Por lead, o vínculo persiste em `portal_leads.responsible_executive_slug`.
13. n/a (existe).
14. **Risco:** `e.$slug`, `f.$slug`, `s.$slug`, `seg.$slug` já são stubs que fazem `redirect({ to: "/" })` preservando `search.e`. Inverter (`/` → `/f`) exige reescrever esses 4 arquivos e revisar todo consumidor de `investorPortalUrl`. Links antigos `/f/{slug}` continuam válidos hoje.
15. **O link E0 abre a Home**, não o Manual diretamente. O botão é `label: "Acessar Portal do Investidor"`, `url: portal` (`src/lib/relationship/messages.ts:466-469`). O Manual abre por consequência da lógica `pendingModule` da Home (`index.tsx:374`: `search.e ? "manual" : null`).
16. **Função:** `investorPortalUrl(slug)` (`src/lib/portal-brands.ts:85-92`), chamada em `src/server/relationship/dispatch.server.ts:72`.
17. **Sim**, é derivado do executivo do lead: `dispatch.server.ts:66` — `card?.responsible_executive_slug`.
18. **Sim, existe fallback para outro executivo:** `?? fallback?.slug` vindo de `getDefaultExecutive()` (`dispatch.server.ts:29,65`). Conflito com a regra "nunca link de outro executivo" aplicada no pós-apresentação (`src/lib/crm/post-presentation.ts:8-9`).
19. **Sim**, com ressalva: identificação por `responsible_executive_id` + `responsible_executive_slug`.
20. **Persistência:** colunas `portal_leads.responsible_executive_id` e `portal_leads.responsible_executive_slug` (confirmadas no schema). **Não existe coluna `operational_owner_id`** no banco — `operationalOwnerId` só existe no modelo de aplicação (`src/lib/leads.ts:48`, `src/lib/crm/redistribution.ts:381-434`). Conflito real: redistribuição no cliente sem coluna equivalente no banco.

## BLOCO 2 — Perfis, papéis e permissões

21. **Papéis:** aplicação — `super_admin | diretora | executivo` (`src/lib/executive-auth.ts:9`); banco — enum `app_role` (`admin | manager | user`) em `user_roles`. São dois vocabulários distintos e não sincronizados.
22. **Diferença técnica:** rótulos em `executive-auth.ts:21-25`; checagens: `canViewPrivateLeads:52`, `canManageUsers:56`, `canManageTargetUser:71`, `assignableRoles:81`, `canViewAllInvestors:87`, `canManageKnowledge:116`, `canManageCreativeTemplates:124`; escopos de carteira em `src/lib/portal-workspace.ts:115-141` (`workspaceScopesFor`): Administrador = green_sales+redistribuicao+portal+tiktok+meta; Gestora = central_unica; Executivo = green_sales+redistribuicao.
23-25. **Colaborador híbrido existe.** Identificador: `HYBRID_WORKSPACE_USER_IDS = ["usr_thiago"]` (`src/lib/portal-workspace.ts:19`), `isHybridWorkspaceUser:21`. Permissões: `canAccessPortalWorkspace:30-35` (vê aba Portal) e `canViewFullWorkspace:42-49` (opera como Administrador). **Conflito:** o comentário em `:130-133` afirma que o híbrido não abre mais o Portal atuando como Colaborador, mas `canAccessPortalWorkspace` não checa o papel ativo.
26. **Sim:** `greensales-sync` com `requiresRole: ["super_admin"]` (`src/config/modules.ts:57-66`).
27. **Ambos, parcialmente.** Frontend: `src/lib/workspace-permissions.ts:50-59` + `src/hooks/use-workspace-permissions.ts`. Servidor: RLS real em `workspace_module_permissions` — `ALL` para `has_role(auth.uid(),'admin')`, `SELECT` para `is_portal_member()`; e `updateWorkspaceOperational` usa função dedicada no banco para campos operacionais (`src/lib/workspace-operational.functions.ts:28+`). **Não há guard server-side de módulo** que bloqueie a chamada de dados do CRM/Portal dos Leads por usuário.
28. **Sim** — `WorkspaceModuleKey = "crm" | "portal_leads"` (`src/lib/workspace-permissions.ts:21`), gravado em `workspace_module_permissions` (`setWorkspaceModuleAccess:98-112`).
29. **Sim** (mesma estrutura).
30. **Não.** Remarketing não é módulo permissionado; é item de navegação condicional em `src/components/executive/executive-shell.tsx:135-142` (`newTab: true`).
31. **Não existe** permissão para apresentações digitais (a feature não existe — Bloco 6).
32. **Não existe** área exclusiva do Administrador nos moldes do Remarketing; o mais próximo é `greensales-sync` (`requiresRole`).
33. **Ponto adequado:** nova rota `src/routes/f.<area>.tsx` com `OperationalGuard`, entrada em `src/config/modules.ts` com `requiresRole: ["super_admin"]`, e navegação em `executive-shell.tsx`.
34. **Sim.** Bastaria ampliar a union `WorkspaceModuleKey` e `resolveModuleAccess`; a tabela `workspace_module_permissions` é genérica por `module_key`. Nenhuma arquitetura paralela é necessária.
35. **Parcialmente.** No tipo `ExecutiveUser` (`executive-auth.ts:134-173`) há `name, email, phone, whatsapp, title, photoUrl, postPresentationVideoUrl, admissionDate, birthDate, slug`. No banco `executive_profiles` só existem `name, email, executive_id, whatsapp`. Ou seja, personalização é majoritariamente seed em código, não dado persistido.

## BLOCO 3 — Manual do Investidor

36. **14 capítulos**, definidos em `src/lib/journey-data.ts:21-272`, renderizados por `src/routes/manual/$chapter.tsx` + `src/components/journey/chapter-view.tsx` / `chapter-bodies.tsx`: `recepcao` (`/manual`), `proposito`, `velox`, `modelo`, `produtos`, `personalizando-sua-jornada`, `operacao`, `investimento`, `treinamento`, `suporte`, `perfil`, `faq`, `autoavaliacao`, `proximos-passos` (final, sem path fixo).
37. `src/components/journey/chapter-bodies.tsx:104-260`, função `VeloxBody` (capítulo `velox`).
38. **Não.** "Fundação da Velox" (`:109`) e "Consolidação da operação" (`:114`) aparecem na mesma timeline sequencial, sem oposição conceitual entre fundação e operação própria.
39. **Não.** A cronologia diz o contrário: fundação → consolidação → "Expansão da rede de franquias" (`:118-120`).
40. `src/components/journey/chapter-bodies.tsx:113` — `year: "Primeiros anos"` no array `timeline` de `VeloxBody`.
41. **Sim** — string literal isolada, sem referência externa.
42. **Sim** — basta inserir um objeto `{ year, title, d }` no array `timeline` (`:106-132`).
43. **14 fixos e hardcoded**: `CHAPTERS` literal + `TOTAL_CHAPTERS = CHAPTERS.length` (`journey-data.ts:274`); navegação `prevPath`/`nextPath` escrita manualmente por objeto.
44. Capítulos com `hasVideo: true`: `recepcao` (`journey-data.ts:34`), `operacao` — capítulo 7 (`:146`) e `proximos-passos` (`:268`).
45. **Placeholder.** Sem `onClick`, sem player (`src/components/journey/video-slot.tsx:8-17`).
46. **Sim:** `src/components/journey/video-slot.tsx:1-25`; texto fixo `"Vídeo do especialista — em breve."` (`:19`).
47. **Nenhum dado/storage.** Só a flag `hasVideo` e o render condicional em `chapter-view.tsx:76-80`.
48. **Só alteração visual/estrutural**: remover `hasVideo` do capítulo ou o bloco condicional. Nenhuma migração ou dado envolvido.
49. **Sim** — o mesmo `VideoSlot` aparece em `recepcao` e `proximos-passos`; alterar o componente afeta os três.
50. **Sim.** `VideoSlot` não recebe `chapter` nem lê conteúdo textual; é totalmente independente do corpo do capítulo.

## BLOCO 4 — Princípios Velox

51. **Não há rota própria.** Abre como overlay na Home (`src/routes/index.tsx:214-225` card `key:"cultura"`, `moduleKey:"principios"`; `:450-451` renderiza o overlay).
52. `src/components/portal/principios-overlay.tsx` (lazy em `index.tsx:35`).
53. **Conteúdo do overlay** (`<figure>` em `principios-overlay.tsx:82-91`), não do card.
54. `assetUrl("portal-capa-principios")` (`:15,84`) → `src/lib/assets/registry.ts:256-265` → `src/assets/portal-principios.jpg`.
55. **Não.** O card externo usa `experienciasImg.url` (`index.tsx:221`), a capa do módulo Experiências.
56. **Não há duplicação** — há incoerência: nenhum card usa a imagem de Princípios.
57. **JSX literal hardcoded** em `principios-overlay.tsx:76-81`.
58. **Nem oficial nem placeholder fixo:** vêm de `fetchInstitutionalModule({ module: "principios" })` (`:13,62`); sem bloco cadastrado, caem em `Princípio 0N` + `PLACEHOLDER_BODY` (`:27-28,42-44`).
59. **Sim:** tabela `portal_institutional_blocks`, acessada por `src/server/magazine.server.ts` via `src/lib/magazine.functions.ts`.
60. **Sim** — cabeçalho e figura são um bloco JSX isolado (`:75-92`); o fetch acontece no `useEffect` (`:59-68`), independente.
61. **Não são clicáveis** — `<article>` sem `onClick`/`<a>`/`<button>` (`:111-143`).
62. Apenas estilos base de card; **sem classe `hover:` explícita** nos cards internos.
63. **Nenhuma navegação** além do `onClose` do `PortalOverlayShell`.
64. **Menor alteração:** `className` do `<article>` em `principios-overlay.tsx:111-114`.
65. Dependências: `PortalOverlayShell`, `fetchInstitutionalModule` / `InstitutionalBlock`, `assetUrl` (registry), e o acoplamento por `moduleKey: "principios"` em `index.tsx`. Nenhum outro módulo lê os princípios.

## BLOCO 5 — Workspace e Lead

66. `LeadCard` em `src/components/crm/portal-leads-board.tsx:80`, usado em `:492`.
67. **Sim.** `markLeadViewed` (`src/lib/lead-state.ts:122-136`) → `persist:60-91` → `updateWorkspaceOperational` (`src/lib/workspace-operational.functions.ts:28+`), que grava `viewed_at` por função dedicada no banco e só confirma o cache após resposta positiva (com rollback e toast em caso de falha).
68. **Sim, integralmente presente:** `src/lib/events/investor-activity.ts`, `resolveLeadState`/guardas em `lead-state.ts`, filtro em `executive-data.ts:6,121`, colapso de status em `investor-profile.ts`, testes `lead-state.test.ts` e `investor-profile.test.ts`.
69. **Sim, indiretamente:** `resolveLeadState` (`lead-state.ts:103-111`) consome `subject.lastActivity`, que é montado a partir de `filterInvestorActivity(...)` em `src/lib/executive-data.ts:121`. `resolveLeadState` em si não importa a lista branca — quem chamar com outro `lastActivity` burla a regra.
70. **Atividade real** (`investor-activity.ts:20-38`): `journey.started`, `journey.lead.created`, `journey.session.started/ended`, `journey.returned`, `journey.module.opened`, `journey.progress`, `journey.completed`, `manual.started/chapter.completed/completed`, `material.viewed`, `simulator.started/completed`, `profile.interests.captured`, `whatsapp.requested`, `ai.query.answered`, e `meeting.requested` só com `origin` investidor/portal (`:47-51`).
71. **Todos** os tipos de `PortalEventType` (`src/lib/events/bus.ts:13-63`) continuam gravados no barramento local, inclusive administrativos (`admin.settings.updated`, `knowledge.document.*`, `resource.*`, `google.*`, `meeting.*`).
72. Na Jornada (servidor) só aparecem os relacionais: `RELATIONAL_TIMELINE_EVENTS` em `src/server/relationship/journey.server.ts:88-95` (`lead_criado`, `contato_recebido`, `atividade_portal`, `nota_executivo`, `mudanca_coluna`, `oportunidade`, `primeiro_contato`) + prefixo `cadencia_` (`:98`). O restante vai para a camada `tecnico`.
73-74. `investor.reactivated` é emitido em `src/lib/workspace-alerts.ts:132-137`, dentro de `pushAlert`, **restrito a `category === "movimentacao"`** (`:128-130`), acionado por `evaluateInvestorMovement()` (`:142-172`) quando a inatividade supera `getReactivationWindowMs()`. É heurística **100% local (localStorage)**, comparando `lastActivity` com `lastSeen` — não é fato do servidor.
75. **Sim, um:** `markLeadViewed` grava e emite quando o **executivo** abre um card ainda não visto. É ação do executivo, não do investidor — porém já é idempotente (guarda `if (entry?.viewedAt) return`, `:125`). Nenhum cron/polling emite `lead.status.changed`.
76. **Causa:** abertura em sequência de vários cards nunca vistos; cada um grava `viewed_at = new Date()` e emite o evento com poucos ms de diferença. O `dedupeKey` é por lead (`:133`), então não colapsa leads distintos. Eventos legados sem `dedupeKey` gravados antes da correção permanecem no localStorage e só são colapsados na exibição (`investor-profile.ts:86-103`).
77. **Emissores de `lead.status.changed`:** `src/lib/lead-state.ts:129` (`markLeadViewed`), `:148` (`closeLead`), `:165` (`reopenLead`), e `src/components/shared/executive-contact-dialog.tsx:82`.
78. **Emissores de `investor.reactivated`:** único — `src/lib/workspace-alerts.ts:132-137`.
79. **Emissores de `profile.updated`:** `src/lib/investor-comments.ts:61` e `src/lib/workspace-lead-edit.ts:136`.
80. **Sim, parcialmente:** o barramento local é por navegador e sobrevive a F5; `evaluateInvestorMovement` recalcula reativação a cada montagem a partir do localStorage; `markLeadViewed` dispara na primeira montagem do card. Não há realtime/polling do servidor emitindo eventos falsos (`src/lib/portal-leads-sync.ts:38-64` sincroniza dados sem emitir eventos do bus).

## BLOCO 6 — Apresentação Digital

81. **NÃO EXISTE** feature "Apresentação Digital". O termo aparece só como `ContentKind` genérico `apresentacao` (`src/lib/relationship/content.ts:18,31`) e no fluxo manual de **Pós-Apresentação** (`src/lib/crm/post-presentation.ts`), que é mensagem, não apresentação hospedada. O mecanismo funcionalmente próximo é o **E20 — Convite ao Portal**.
82. **E20:** `src/server/relationship/e20.server.ts`, `src/lib/relationship/e20.functions.ts`, rota pública `src/routes/portal.convite.$token.tsx`, tabelas `relationship_e20_occurrences` e `relationship_e20_accesses`.
83. **Sim** (como convite E20): token aleatório + `link_url = ${baseUrl}/portal/convite/${token}` (`e20.server.ts:129-131`).
84. **Sim:** `SEVEN_DAYS_MS` (`e20.server.ts:23`).
85. Calculado em `e20.server.ts:130` (`expiresAt = now + SEVEN_DAYS_MS`) e persistido em `relationship_e20_occurrences.expires_at`.
86. **Sim:** `src/routes/portal.convite.$token.tsx:35-65` → `resgatarConviteE20` → `redeemE20` (`e20.server.ts:219-265`).
87. **Parcialmente.** O token não expõe dados; porém, após validar, redireciona para `/` com `search: { lead: result.leadId }` (`portal.convite.$token.tsx:50-55`) — o `leadId` fica visível na URL. Nome/telefone/e-mail não são expostos.
88. **Não existe.** `emitirE20` / `listarOcorrenciasE20` (`e20.functions.ts:8,27`) **não têm nenhum consumidor `.tsx`**. `crm-lead-ficha.tsx` e `portal-leads-board.tsx` não referenciam E20.
89. **Local correto:** `src/components/crm/crm-lead-ficha.tsx` (ficha do investidor) e/ou o menu do `LeadCard` em `portal-leads-board.tsx:80`.
90. **Sim, genérico:** `copyToClipboard` (`src/lib/clipboard.ts:5-28`), já usado em `crm-conversation.tsx`, `crm-new-lead.tsx`, `investor-profile-view.tsx` — mas **não ligado a nenhum link de apresentação**.
91. **Sim, para E20:** `renderFromLibrary("E20", { executiveName, portalLink, rawInvestorName })` (`e20.server.ts:167-171`).
92. **A frase não existe no código.** Buscas por "sete dias" e "deixei disponível" não retornam ocorrência em `src`. E20 está em `PENDING_TEXT_STEPS` (`message-library.server.ts:47`), ou seja, nasce **sem texto oficial aprovado**; o texto vive em dados (`relationship_message_library`). Se está cadastrado como versão ativa: NÃO É POSSÍVEL DETERMINAR PELO CÓDIGO ATUAL.
93. **Sim:** `src/lib/relationship/names.ts` — `normalizeName:29-41`, `firstName:44-47`, `resolveTreatment:140-169`.
94. **Sim:** `NEUTRAL_TREATMENT = "caro investidor"` (`names.ts:12`), aplicado quando o nome não é reconhecido ou foi rejeitado (`:161-168`).
95. **Sim (para E20):** `relationship_e20_occurrences.lead_id`, com `scope`, `cadence_id`, `instance_seq`.
96. **Sim:** `generated_at`, `generated_by`, `generated_by_name`, `generated_by_executive_id`.
97. **Sim:** `relationship_e20_accesses` (`occurrence_id`, `lead_id`, `accessed_at`, `outcome`, `user_agent`), inserido em `e20.server.ts:232-238`; além de `first_opened_at`/`open_count` na ocorrência.
98. **Sim:** `expires_at` + atualização de `status = "expirada"` (`e20.server.ts:240-245`).
99. **Não existe.** `listE20Occurrences` (`e20.server.ts:77-84`) e `listarOcorrenciasE20` não têm tela consumidora. RLS atual: `SELECT` liberado a `is_portal_member()` nas duas tabelas E20 — sem restrição por Administrador.
100. **Reutilizável hoje:** `issueE20` (geração + link + 7 dias + encerramento da ocorrência anterior), `relationship_e20_occurrences` / `relationship_e20_accesses`, `redeemE20` + rota `portal.convite.$token.tsx` (acesso e registro), `renderFromLibrary` + `resolveTreatment`/`firstName` (mensagem personalizada com fallback), `copyToClipboard` (link e mensagem), `crm-lead-ficha.tsx` / `LeadCard` (ponto de UI), `crm-lead-journey.tsx` (já tem cor de badge `e20`, `:54`). **Faltando:** botão de emissão, exibição de status/histórico no CRM/Workspace, tela administrativa de apresentações, texto oficial da mensagem, e a decisão semântica "apresentação digital" x "convite E20".

## Classificação final

**A) JÁ EXISTE E ESTÁ FUNCIONAL**
- `/f` como namespace operacional com guard nos filhos; stubs de redirecionamento das rotas legadas.
- Link personalizado por executivo (`investorPortalUrl`) e vínculo lead → executivo em `portal_leads`.
- Manual com 14 capítulos e `VideoSlot` isolado.
- Princípios Velox como overlay alimentado por `portal_institutional_blocks`.
- Persistência confirmada de `viewed_at`/`closed_at` com rollback; lista branca de atividade real do investidor.
- Backend E20 completo: token, 7 dias, expiração, resgate, registro de acesso.
- `copyToClipboard`, normalização de nome com fallback neutro.

**B) EXISTE MAS ESTÁ INCOMPLETO**
- E20 sem nenhuma UI: sem botão de emissão, sem listagem, sem exibição no CRM/Workspace.
- Texto oficial de E20 pendente (`PENDING_TEXT_STEPS`).
- Perfil do executivo: slug, foto, cargo, vídeo e telefone vivem em seed de código, não no banco.
- Permissões individuais só para `crm` e `portal_leads`; sem enforcement server-side de módulo.
- Cards de Princípios sem hover/animação; card da Home com a capa errada.
- `resolveLeadState` depende de quem monta `lastActivity` (whitelist não está dentro da função).

**C) EXISTE MAS ESTÁ EM CONFLITO COM A REGRA ATUAL**
- Fallback de portal para o Executivo Padrão em `dispatch.server.ts:66` x regra "nunca link de outro executivo" (`post-presentation.ts:8-9`).
- Híbrido: comentário de restrição em `portal-workspace.ts:130-133` x `canAccessPortalWorkspace:30-35`.
- `operationalOwnerId` usado na redistribuição sem coluna correspondente em `portal_leads`.
- Dois vocabulários de papel não sincronizados (`super_admin/diretora/executivo` x enum `admin/manager/user`).
- Módulo "Portal do Investidor" apontando para `/` enquanto a unidade operacional é `/f`.
- `investor.reactivated` gerado por heurística local de localStorage, não por fato do servidor.

**D) NÃO EXISTE**
- Feature "Apresentação Digital" (rota, tabela, componente, botão, mensagem).
- Diferenciação entre Portal institucional Velox e Portal do Investidor da Velox Financeira.
- Área administrativa exclusiva nos moldes do Remarketing; permissão individual para Remarketing e para apresentações.
- Coluna `slug` em `executive_profiles`.
- Tela de listagem de apresentações/convites gerados.

**E) PRECISA SER DECIDIDO ANTES DA IMPLANTAÇÃO**
1. "Apresentação Digital" é um novo artefato ou é o E20 renomeado e exposto na UI?
2. O Portal do Investidor passa a viver em `/f` (e `/` vira redirecionador) ou permanece em `/`?
3. O fallback para o Executivo Padrão continua permitido nos links E0?
4. Slug e dados de personalização do executivo migram para o banco?
5. Papel do híbrido: mantém acesso ao Portal atuando como Colaborador?
6. `operationalOwnerId` vira coluna real em `portal_leads`?
7. Texto oficial da mensagem de apresentação (com ou sem a frase de "sete dias") e quem o cadastra na Biblioteca.
8. Quem enxerga as apresentações geradas (RLS atual libera a qualquer membro do portal).

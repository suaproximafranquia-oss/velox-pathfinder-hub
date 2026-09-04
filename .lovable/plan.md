# Validação — camada institucional /financeira, /solar, /seguradora

Segunda rodada, somente leitura. Nada foi alterado (inclusive `roadmap.md`, que só pode ser atualizado após a aprovação).

## Bloco 1 — Formulário institucional

1-2. Componente único: `src/components/group/unit-interest-form.tsx` (`UnitInterestForm`).
- Grava via `registrarInteresseUnidade` em `src/lib/group/unit-leads.functions.ts` (server fn `POST`, sem autenticação, usa `supabaseAdmin`).
- Tabelas: `group_unit_leads` (cadastro) e `group_unit_lead_events` (histórico append-only).
- Campos gravados: `unit`, `name`, `whatsapp` + `whatsapp_key` (só dígitos), `email` + `email_key`, `city`, `investment_range` (`10_20 | 20_30 | acima_30`), `origin`, `campaign`, `from_group`, `last_submitted_at`, `first_contact_status='pendente'`, `submissions`.
- A marca é identificada pelo campo `unit`, hoje restrito por validação a `solar | seguros` (constante `UNITS`).
- Identidade: mesma `unit` + mesmo `whatsapp_key` = mesma pessoa; novo envio faz UPDATE + evento `novo_envio`, nunca segundo card.

3. Reuso na Home: **tecnicamente possível e já é o que acontece** — `group-franchise-cta.tsx` já usa o mesmo `UnitInterestForm` com `fromGroup`. Incluir Financeira exige apenas ampliar a lista `UNITS` (e o tipo `unit`) para aceitar `financeira`; nenhuma segunda lógica de formulário é necessária.
   Ressalva importante: hoje Financeira é bloqueada de propósito. Ampliar `UNITS` é decisão de negócio (Bloco 9 B), não detalhe técnico.

4. Sim: `unit` é coluna própria, então Solar, Seguros e Financeira ficam individualmente identificáveis e as carteiras seguem separadas por unidade.

## Bloco 2 — Destino dos leads vindos de `/`

5. Registro em `group_unit_leads` + evento `registrado` em `group_unit_lead_events`. **Nada** é criado em `portal_leads`, `crm_leads`, `relationship_*` ou cadência.
6. Origem: `origin` = valor do parâmetro `o` da URL, ou o padrão `"Portal Institucional do Grupo Velox"`; além disso `from_group = true` marca explicitamente a vinda da Home.
7. Marca/interesse: `unit = 'solar' | 'seguros'`.
8. Responsável inicial: **nenhum** — `responsible_executive_id` nasce nulo; a atribuição é manual por `atribuirResponsavelUnidade`, com registro de autor e data.
9. Não vira card do Workspace da Financeira. A "carteira" é a tela `/f/executivo/unidades`, alimentada por `listarInteressadosUnidade`. Não existe chamada a `intakeLead` nem a `ensureWorkspaceCard` nesse caminho.
10. Identificador: o `id` (uuid) de `group_unit_leads`; o histórico referencia por `lead_id`. Não existe padrão `gs_<external_id>` aqui.
11. Confirmado: como não entram em `crm_leads`/`portal_leads`, esses leads **não participam** de rotação, redistribuição, FIFO, E0 nem cadência dos colaboradores.

## Bloco 3 — Thiago híbrido

12. Regra em `src/lib/portal-workspace.ts`: `HYBRID_WORKSPACE_USER_IDS = ["usr_thiago"]` → `isHybridWorkspaceUser()` → `workspaceScopesFor(userId, role)` devolve `["green_sales","redistribuicao","portal","tiktok","meta"]` para o híbrido e para `super_admin`. Demais colaboradores recebem só `green_sales` e `redistribuicao`. O identificador técnico é permanente; o nome exibido nunca é usado.
13. **Não é a mesma regra** e não precisa ser. A carteira das unidades usa outro controle: `assertUnitPortfolioAccess` (`src/server/authorization.server.ts`), que exige `admin` ou `manager` via `readAdministrativeAccess`. Reutilizar significa manter esse controle, não estender `WorkspaceScope`.
14. Confirmado: colaborador comum não vê a carteira das unidades (falha em `assertUnitPortfolioAccess`) nem os escopos Portal/TikTok/Meta.
15. Confirmado: Administrador (`admin`) tem acesso pleno à carteira das unidades e a todos os escopos do Workspace.
16. Nenhuma permissão nova é necessária para Solar/Seguros. Se o negócio quiser Thiago (perfil Colaborador) operando a carteira das unidades, isso é decisão pendente — hoje ele só entra por permissão administrativa, não pelo híbrido.

## Bloco 4 — Portal

17. Sim. O Workspace já exibe leads de origens diferentes por abas.
18. Diferenciação atual: `WorkspaceScope` (`green_sales`, `redistribuicao`, `portal`, `tiktok`, `meta`, `central_unica`), decidido por `resolveLeadScope` (`src/lib/lead-routing.ts`) e persistido no card; canais pagos entram por `/origem/$channel`. A origem institucional do Grupo **não é um escopo** — ela vive em outra tabela, com `origin` + `from_group`.
19. Sim: para Solar e Seguros a estrutura já existe e já está em produção (`group_unit_leads` + `/f/executivo/unidades`). **Nenhum módulo novo é necessário.**
20. Sem limitação — desde que se aceite que essa carteira é separada do Portal dos Leads da Financeira, o que é justamente o isolamento desejado.

## Bloco 5 — Card e ficha

21. Ficha oficial: a linha de `group_unit_leads` exibida em `/f/executivo/unidades`, com histórico de `group_unit_lead_events`.
22. "Ver ficha completa" abriria essa tela filtrando pelo `id` do interessado (por exemplo `?lead=<id>`), sem passar por card do CRM.
23. Confirmado e já é o comportamento atual: nada é enviado para `/s` ou `/seg` operacionais por causa da marca escolhida; a escolha só define `unit`.

## Bloco 6 — Home institucional

24. Confirmado. `group-companies.tsx` já renderiza os três cards a partir de `COMPANIES` em `group-content.ts`. Falta apenas: imagem/logo por marca, ajuste do texto curto e trocar o `<span aria-disabled>` por `<Link>`.
25-28. Confirmado: sem reconstrução da Home. Os `href` em `group-content.ts` já são `/financeira`, `/solar`, `/seguradora`.

## Bloco 7 — Três páginas

29. Confirmado. Um invólucro compartilhado (header, footer, grid, tipografia, espaçamento, CTA, breakpoints) e um conteúdo por marca em módulo próprio. Os componentes editoriais de `src/components/site/v2/` cobrem hero, estatísticas, editorial, galeria, timeline, citação e catálogo.
30. Confirmado: **nenhum CMS/editor nesta etapa**. Conteúdo em módulos TypeScript por marca, alimentados pelo Word e pelas referências visuais.

## Bloco 8 — Impacto e segurança

31-32. Arquivos compartilhados tocados numa implementação futura:

| Arquivo | Alteração | Risco em /f, /s, /seg, CRM, Cadência, Ação do Dia, E0, Safety Lock |
|---|---|---|
| `src/components/group/landing/group-companies.tsx` | ativar `Link` | nenhum — só a Home |
| `src/components/group/landing/group-content.ts` | imagens/logos/texto | nenhum |
| `src/routes/financeira.tsx`, `solar.tsx`, `seguradora.tsx` | novos | nenhum |
| `src/components/group/brand/*` | novos | nenhum |
| `src/lib/assets/registry` | novos logos | nenhum (aditivo) |

33. Um único ponto **sensível**: incluir `financeira` em `UNITS` dentro de `src/lib/group/unit-leads.functions.ts`. Esse arquivo é a captação viva de Solar/Seguros. Alteração aditiva não afeta CRM/cadência/E0/Safety Lock (o caminho nunca os chama), mas mexe em código em produção — por isso não foi tocado e fica como decisão explícita.
34. Confirmado: as três páginas podem ser construídas sem alterar uma linha de lógica operacional de `/f`, `/s`, `/seg`, CRM, Cadência, Ação do Dia, E0 ou Safety Lock.

## Bloco 9 — Recomendação final

**A) Confirmado**
- As três rotas não existem; a Home e os cards existem e só precisam de ativação.
- Formulário institucional único, reutilizável, com marca identificável por `unit`.
- Solar/Seguros já têm carteira própria isolada, sem rotação, sem E0, sem cadência.
- Acesso à carteira já é restrito a permissão administrativa; colaboradores comuns não veem.
- Nenhum CMS é necessário; nenhuma permissão nova é necessária.

**B) Precisa de decisão**
1. Financeira na Home terá formulário próprio (ampliando `UNITS`) ou continuará sem captação institucional?
2. Thiago, no perfil Colaborador, deve enxergar a carteira das unidades? Hoje não enxerga (regra administrativa, não híbrida).
3. Logos oficiais das três marcas em arquivo — ainda não estão no registro de assets.

**C) Menor conjunto de alterações**
1. `src/components/group/brand/brand-page.tsx` — invólucro compartilhado.
2. Três módulos de conteúdo (um por marca).
3. Três arquivos de rota com `head()` própria.
4. `group-companies.tsx` — ativar "Saiba mais".
5. `group-content.ts` — imagens/logos/textos curtos.

**D) O Word + referências visuais são suficientes?** Sim para textos e estrutura. Faltam apenas: logos em arquivo, imagens em alta e o texto alternativo/legenda de cada imagem (acessibilidade e SEO).

**E) Sequência mais econômica**
1. Rodada 1: invólucro + as três rotas com o conteúdo do Word já aplicado, e ativação dos botões — tudo em uma única entrega.
2. Rodada 2 (só se necessário): refino visual pontual com as referências.
3. Rodada 3 (opcional, futura): camada editável, se um dia o conteúdo passar a mudar com frequência.
Evitar rodadas separadas para "estrutura" e "conteúdo": duplica custo sem ganho.

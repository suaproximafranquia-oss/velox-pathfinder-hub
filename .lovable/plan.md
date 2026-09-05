# Confluência — /f /s /seg, Corporate Workspace e identidade GreenSales

Diagnóstico somente leitura. Nada foi alterado.

## 1. Portais do Investidor — /f, /s, /seg

**Estado atual**

- `/f` (rota `f.index.tsx`) — **JÁ EXISTE** como Portal do Investidor completo: hero, cards de módulos, overlays (Manual, Material Institucional, Simulador, Nossa Estrutura, Revista, Princípios), Gateway de identificação, registro de telefone, feed de notícias e sessão do investidor.
- `/s` e `/seg` (`s.index.tsx`, `seg.index.tsx`) — **NÃO EXISTEM como portal**. São páginas institucionais estáticas de uma tela: título, três bullets e o componente `unit-interest-form` (formulário de interesse). Não carregam nenhum módulo, overlay ou simulador.
- `/s/{slug}` e `/seg/{slug}` — **redirecionam** para `/s` e `/seg`, com o comentário explícito de que "Solar e Seguros são institucionais nesta versão". É essa a razão de tudo cair no formulário: a decisão está no próprio arquivo de rota, não em um bug.
- `/f/{slug}` — redireciona para `/f` levando marca e executivo em `search` (`e`, `m`, `o`, `b`).

**a) A estrutura de /f é reaproveitável?** — **EXISTE PARCIALMENTE.**
Existe reaproveitamento real de baixo nível: `PORTAL_BRANDS` (marca por prefixo), `portal-modules.ts` (registro de módulos), overlays independentes (`src/components/portal/*`), `portal-overlay-shell`, sessão/gateway e `business-unit`/`navigation-environment` (prefixo de unidade). O que **não existe** é a camada de página: `f.index.tsx` é um arquivo único, com conteúdo, assets e regras da Financeira embutidos — não é um componente parametrizado por marca.

**c) Diferenciação financeiro/solar/seguros** — **EXISTE PARCIALMENTE.** Existe no nível de identidade (`PORTAL_BRANDS`, prefixos, origem do lead, `brand-content.ts` das páginas institucionais). **Não existe** no nível de conteúdo do portal: `portal-modules.ts` é global, sem chave de marca, e não há tabela/config de módulos por unidade.

**d) Menor alteração arquitetural futura (sem replicar conteúdo agora)**

1. Extrair o corpo de `f.index.tsx` para um componente `InvestorPortalHome({ brand })`, mantendo `/f` como um consumidor fino desse componente (comportamento idêntico, zero mudança visual).
2. Dar chave de marca ao registro de módulos: `portal-modules.ts` passa a mapear `brandKey → módulos disponíveis`, com a Financeira mantendo exatamente a lista atual.
3. Trocar os redirects de `s.$slug`/`seg.$slug` por entrada de contexto igual à de `/f` quando cada portal existir — não antes.
4. `/s` e `/seg` só migram de página institucional para portal quando houver conteúdo próprio: enquanto não houver, permanecem como estão.

Isso não exige migration, não duplica conteúdo e não toca no motor.

## 2. Corporate Workspace — menu do Administrador

**a) Origem do menu** — **EXISTE PARCIALMENTE (regras híbridas).**
O menu é montado em um único lugar — `src/components/executive/executive-shell.tsx`, em quatro listas: `daily`, `centrais`, `relationship`, `administrative`. Porém a decisão de visibilidade **não** vem de uma matriz única: convivem quatro mecanismos diferentes no mesmo arquivo:
- `useModuleAccess(...)` (permissões por usuário no banco) para CRM, Remarketing, Portal dos Leads e Backup de Conversas;
- comparação direta `session.activeRole === "super_admin" | "diretora"` para Central de Backup, Revista, Biblioteca, Homologação, Laboratório;
- `administrativeAccess` (`user_roles`) para Central de Operações e Apresentação Digital;
- `canManageUsers(role)` para Usuários.

Além disso, cada rota repete sua própria checagem (guards de módulo e `assertManager` nas server functions). Ou seja: o menu é centralizado, a **autorização** não é.

**b) Onde está definida a visibilidade por perfil** — nos quatro pontos acima, mais `src/lib/workspace-permissions.ts` (ON/OFF individual de CRM, Portal dos Leads e E0), `portal-workspace.ts` (escopos/carteiras) e `hooks/use-administrative-access.ts`.

**Diferenças em relação à lista desejada:**
- Faltam no menu: KPI Manager existe; **Central de Captação, Operações, Reuniões, Alertas, Backup** existem; **não encontrei** item de menu para "Central de Reuniões" ausente — está presente. Não há divergência de itens faltantes, exceto que a ordem/agrupamento atual difere da lista desejada.
- **Apresentação Digital está hoje no menu lateral** (grupo `relationship`, visível com acesso administrativo) — contraria a regra desejada.

**c) Ação do Dia** — **JÁ EXISTE corretamente vinculada.** O overlay (`daily-actions-overlay.tsx`) é aberto de dentro de `portal-leads-board.tsx`, ou seja, dentro do Portal dos Leads. Não há item no menu lateral. As únicas outras entradas são de homologação/demo (`/f/executivo/acao-do-dia-demo` e `/f/executivo/homologacao/acao-do-dia`), restritas a `super_admin`.

**d) Apresentação Digital** — **JÁ EXISTE rota própria:** `/f/executivo/apresentacao-digital` (`src/routes/f.executivo.apresentacao-digital.tsx`).

**e) Botões "Home"/"Voltar" indo para o institucional** — **EXISTE PARCIALMENTE o mecanismo central.**
Já existe `src/lib/navigation-environment.ts` (`homePathFor` / `homePathOrRoot`), que resolve a Home do ambiente pelo pathname. Mas ele é consumido por apenas quatro lugares: `journey-chrome`, `module-chrome`, `manual/concluido` e `error-page`. Vários pontos ainda usam `to="/"` fixo — entre eles `__root.tsx` (duas ocorrências), `f.executivo.index.tsx`, `f.index.tsx` e as páginas institucionais. É exatamente por isso que alguns "Home/Voltar" saem para o Grupo Velox. A correção é única: fazer esses pontos consumirem `homePathOrRoot(pathname)`.

## 3. Portal dos Leads / GreenSales — identidade do executivo

**a) Vínculo usuário interno → usuário GreenSales → ID GreenSales** — **JÁ EXISTE.**
`executive_profiles.greensales_vendor_id` guarda o `vendedor_id` da origem; `resolveResponsibleByVendorId` (em `src/server/crm/responsible.server.ts`) resolve o executivo responsável a partir dele, sem inventar dono quando não há mapeamento.

**b) Autenticação individual do GreenSales** — **JÁ EXISTE (por usuário), com fallback global.**
`crm_connections` (provider `greensales`) guarda credenciais cifradas **por `user_id`**; `greenSalesLogin` usa as credenciais recebidas e só cai em `GREENSALES_EMAIL`/`GREENSALES_PASSWORD` do servidor quando nenhuma é passada. Ou seja: o modelo por executivo existe; o global permanece como fallback.

**c) O que bloqueia o colaborador com Portal dos Leads liberado** — **CONFIRMADO.**
São **duas camadas independentes**. A permissão de módulo (`workspace_permissions` → `useModuleAccess`) libera a rota e o item de menu, mas as server functions do CRM (`src/lib/crm/leads.functions.ts`, `daily-actions.functions.ts`, `cadence.functions.ts`, `meta-templates.functions.ts`) chamam `assertManager`, que exige papel `admin` ou `manager` em `user_roles` e lança **"Acesso restrito à gestão do CRM."**. Um colaborador com o módulo ON não tem esse papel — daí a mensagem.

**d) Ponto arquitetural correto para cadastrar a identidade GreenSales** — o campo já existe e já é editável em **Gestão de Usuários** (`/f/executivo/usuarios`, campo `greensalesVendorId`, com validação de unicidade). O que **NÃO EXISTE** é uma seção equivalente em **Meu Perfil**: lá o GreenSales aparece apenas como um status informativo ("Redirecionamento externo ativo"). O caminho correto futuro é uma seção em Meu Perfil que leia/escreva o mesmo `executive_profiles.greensales_vendor_id` e a mesma `crm_connections` do usuário autenticado — sem criar segunda tabela nem segunda fonte de verdade.

## Resumo por item

| Item | Situação |
| --- | --- |
| /f como Portal do Investidor | JÁ EXISTE |
| /s e /seg como portais próprios | NÃO EXISTE (institucional + formulário, por decisão explícita no código) |
| Estrutura reaproveitável para 3 portais | EXISTE PARCIALMENTE (marca/módulos/overlays sim; página parametrizada não) |
| Diferenciação por marca | EXISTE PARCIALMENTE (identidade sim; conteúdo por marca não) |
| Menu montado num único arquivo | JÁ EXISTE (`executive-shell.tsx`) |
| Matriz única de permissões | NÃO EXISTE (quatro mecanismos coexistem) |
| Ação do Dia dentro do Portal dos Leads | JÁ EXISTE |
| Apresentação Digital fora do menu lateral | NÃO EXISTE (hoje está no menu) |
| Rota da Apresentação Digital | JÁ EXISTE (`/f/executivo/apresentacao-digital`) |
| Mecanismo central de Home por ambiente | EXISTE PARCIALMENTE (existe, pouco adotado) |
| Vínculo executivo ↔ vendedor GreenSales | JÁ EXISTE (`executive_profiles.greensales_vendor_id`) |
| Credencial GreenSales por usuário | JÁ EXISTE (`crm_connections`, com fallback global) |
| Bloqueio do colaborador no Portal dos Leads | CONFIRMADO (`assertManager` exige admin/manager em `user_roles`) |
| Cadastro da identidade GreenSales em Meu Perfil | NÃO EXISTE (existe só em Gestão de Usuários) |

Nenhuma implementação foi feita. Próximos blocos possíveis, em ordem de menor esforço: (1) unificar Home por ambiente; (2) tirar Apresentação Digital do menu e levá-la para o card de Módulos da Home; (3) extrair `InvestorPortalHome({ brand })`; (4) seção GreenSales em Meu Perfil.

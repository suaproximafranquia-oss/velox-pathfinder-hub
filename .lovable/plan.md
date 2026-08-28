# Reestruturação /F + Agenda Operacional Global

## Auditoria da estrutura atual (feita antes de qualquer alteração)

**Rotas operacionais hoje (todas na raiz):**
- `/executivo` + 30 telas (`home`, `dashboard`, `reunioes`, `kpi`, `campanhas`, `brain`, `criativa`, `captacao`, `templates`, `biblioteca`, `identidade`, `homologacao`, `backups`, `central-backup`, `usuarios`, `perfil`, `configuracoes`, `laboratorio`, `alertas`, `revista`, `investidores`, `relatorios`, `recursos`, `institucional`, `greensales`, `greensales-sync`, `celebracao`, `teste-cadencia`, `administracao`, `index`)
- `/crm` (+ `crm.index`), `/remarketing` (+ index), `/portal-leads`

**Rotas públicas / aquisição (NÃO serão movidas):**
- `/` (Home institucional + Gateway), `/manual/*`, `/universo`
- `/origem/$channel` (tiktok, meta) — grava canal e devolve à Home
- Links personalizados de marca: `/f/$slug`, `/s/$slug`, `/seg/$slug`, legado `/e/$slug`
- `/portal/convite/$token`, `/entrar` (legado), `/oauth/google/$connector`, `/api/public/*`

**Conflito identificado:** o prefixo `/F` colide com o link personalizado `/f/$slug` (Velox Financeira). O roteador dá precedência a segmentos estáticos, então `/f/executivo/...`, `/f/crm`, `/f/remarketing`, `/f/portal-leads` funcionam — mas um executivo com slug `crm`/`executivo`/`remarketing`/`portal-leads` deixaria de resolver. Solução: lista de slugs reservados validada na criação/edição de executivo, sem alterar o formato do link personalizado.

**Guard atual:** cada tela chama `getSession()` e redireciona para `/executivo` quando não há sessão. Não existe layout único de proteção.

## O que será feito

### 1. Camada de unidade de negócio
- Novo módulo `src/lib/business-unit.ts`: define a unidade `financeira` com prefixo `/f`, e helpers `unitPath(path)` / `currentUnit(pathname)`. Toda navegação interna passa a usar esse helper — nada de string solta. Isso deixa `/seg` e `/s` possíveis no futuro sem refatoração.

### 2. Migração das rotas (sem duplicar aplicação)
- Cada tela operacional passa a viver em `src/routes/f.executivo.<tela>.tsx` (`/f/executivo/...`), `src/routes/f.crm.*`, `src/routes/f.remarketing.*`, `src/routes/f.portal-leads.tsx`. O conteúdo é o mesmo arquivo movido; só muda a string do `createFileRoute`.
- As rotas antigas permanecem como **redirecionamento controlado** (`beforeLoad` → nova rota, preservando `search` e `params`). Nenhuma tela duplicada, nenhum link antigo quebrado.
- Novo layout de unidade `src/routes/f.tsx` com `<Outlet />` (contexto da unidade).
- Todos os `<Link to>`, `navigate({to})`, `window.open` e itens de menu internos apontam para as rotas `/f/...`.

### 3. Proteção das rotas internas
- Guard único no layout `/f/executivo`, `/f/crm`, `/f/remarketing`, `/f/portal-leads`: sem sessão executiva → volta para a tela de acesso, sem renderizar o Workspace.
- A raiz `/` continua institucional e não ganha nenhum atalho para áreas internas.

### 4. Preservação de aquisição e ownership
- `/origem/tiktok` e `/origem/meta` permanecem exatamente como estão.
- `/f/$slug`, `/s/$slug`, `/seg/$slug`, `/e/$slug` permanecem como links personalizados; nenhuma alteração na resolução de identidade, escopo ou ownership.
- Slugs reservados (`executivo`, `crm`, `remarketing`, `portal-leads`) bloqueados no cadastro.

### 5. Agenda Operacional Global
- Botão fixo lateral **AGENDA** presente no shell do Executivo, do CRM, do Remarketing e do Portal dos Leads — independente da aba aberta.
- Abre um painel lateral sobre o ambiente atual (sem navegar/sair da tela).
- Painel mostra o dia/próximos dias com três níveis: **Prioridade Máxima** (compromisso com horário), **Média** (atenção) e **Mínima** (cadência E1/E2/E3, acompanhamento).
- Fontes: eventos próprios da Agenda + reuniões existentes (somente leitura, sem duplicar) + ações de cadência já calculadas pelo motor (nunca eventos inventados).
- **Conflito de horário:** ao criar evento de prioridade máxima, o sistema verifica sobreposição com reuniões e com eventos máximos existentes e **bloqueia antes de gravar**, informando o conflito.

### 6. Banco
- Uma migração criando `workspace_agenda_events` (executivo, título, início, fim, prioridade, origem, observação) com RLS por executivo + admin e GRANTs. Nenhuma tabela existente é alterada.

## Detalhes técnicos
- Prefixo em minúsculo (`/f/...`) por causa do casamento de rotas do TanStack e dos links personalizados já publicados; `/F/...` digitado pelo usuário resolve para a mesma rota.
- Redirecionamentos legados usam `beforeLoad` + `redirect({ replace: true })`, preservando `search`.
- Nenhum módulo é removido, renomeado ou reescrito — apenas realocado na hierarquia.

## Testes de aceite executados ao final
Navegação nas rotas novas, redirecionamento das antigas, `/origem/tiktok` e `/origem/meta`, links personalizados de cada marca, bloqueio de acesso interno sem sessão, abertura da Agenda em cada ambiente e detecção de conflito de horário — além do build.

# Diagnóstico — Navegação do Corporate Workspace /f (somente leitura)

Nada foi alterado. Escopo restrito ao ambiente Financeira /f.

## A. O que os HARs provam

Os arquivos HAR disponíveis nos anexos são:

- `veloxgrupo.com.br.har`, `veloxgrupo.com.br-2.har`, `veloxgrupo.com.br-3.har` (capturados em 29/08, conteúdo idêntico entre si) — são navegações no site institucional WordPress `veloxgrupo.com.br` (Elementor, jQuery, wp-content). Nenhuma requisição do Corporate Workspace.
- `adm.greennsales.com.br.har` e `-2` (24/08) — navegação no sistema GreenSales.

Ou seja: **não há HAR do Corporate Workspace /f nesta conversa**. Os HARs provam apenas o carregamento do site WordPress e do GreenSales; não provam nada sobre cliques no menu lateral do Workspace. Para conclusão baseada em rede seria necessário um HAR capturado em `/f/executivo/...` com pelo menos duas trocas de item de menu.

O diagnóstico abaixo é, portanto, baseado no código atual — que é suficiente para explicar o comportamento relatado.

## B. O que o código prova

1. **O shell não é um layout persistente.** `ExecutiveShell` (`src/components/executive/executive-shell.tsx`) é importado e renderizado **dentro de cada página**: `f.executivo.home.tsx`, `f.executivo.kpi.tsx`, `f.executivo.campanhas.tsx`, `f.executivo.brain.tsx`, `f.executivo.criativa.tsx`, `f.executivo.central-operacoes.tsx`, `f.executivo.reunioes.tsx`, `f.executivo.alertas.tsx`, etc. (~30 rotas). O layout `f.executivo.tsx` renderiza apenas `OperationalGuard > Outlet`, sem shell.
2. **Trocar de rota troca o componente filho do `Outlet`** — o React desmonta a árvore inteira da página anterior, inclusive o `ExecutiveShell` daquela página, e monta um `ExecutiveShell` novo. Menu, header, footer e todos os `useEffect` de inicialização são recriados a cada clique.
3. **Efeitos de inicialização reexecutam a cada navegação**, dentro do shell: abertura do token (`getAccessToken`), `hydrateMeetingsFromServer()`, `pullLeads()`, `hydrateCrmFromServer()`, verificação periódica de status do usuário (`listExecutiveStatus`) e o start da sincronização de permissões.
4. **A autorização do menu é buscada de novo a cada montagem.** `useWorkspaceAuthorization` faz `autorizacaoWorkspace()` dentro de um `useEffect` com estado local, sem cache compartilhado (não usa TanStack Query). Como o hook morre junto com o shell, cada navegação dispara uma nova chamada e o menu fica **vazio/fail-closed até a resposta chegar** — é isso que produz a sensação de "a lateral recarregou".
5. **O guard de rota agrava o efeito.** Em várias páginas, `WorkspaceResourceGuard` envolve a página **inteira** (inclusive o shell) e retorna `null` enquanto `allowed === null`. Resultado: tela em branco entre a saída da página anterior e a chegada da autorização — visualmente idêntico a um reload.
6. **Os itens do menu usam `<Link>` do TanStack Router** — navegação SPA. As exceções são intencionais: CRM, Remarketing e Portal dos Leads usam `<a target="_blank">` (abrem nova aba, por decisão de produto).
7. **Não há `key` por pathname** e nenhum `window.location.assign/href/replace` na navegação do menu. Os únicos `window.location.reload()` do Workspace são: troca de perfil ativo (`ProfileSwitcher`) e o Laboratório — ambos deliberados.
8. O `QueryClientProvider` fica no `__root` e não é recriado; só o shell e os providers internos das páginas remontam.

## C. Existe full page reload? **NÃO** (na navegação normal do menu)

A navegação é SPA. Reload de documento só ocorre em: troca de perfil, Laboratório, itens de nova aba e o botão "Go home" da tela de erro.

## D. Existe remount do shell? **SIM**

Confirmado por construção: o shell vive dentro de cada rota, portanto é obrigatoriamente desmontado e remontado a cada troca de item de menu.

## E. Componente que provoca

`ExecutiveShell`, por estar instanciado por página em vez de estar no layout `src/routes/f.executivo.tsx`. Contribuem: `useWorkspaceAuthorization` (sem cache) e `WorkspaceResourceGuard` envolvendo o shell.

## F. Mecanismo de navegação

`<Link>` (SPA correta). O problema **não** é o mecanismo de navegação, é a posição do shell na árvore.

## G. Requests repetidos desnecessariamente a cada clique

- `autorizacaoWorkspace` (1x por shell + 1x por `WorkspaceResourceGuard` da rota — hooks independentes, sem cache: geralmente 2 chamadas por página).
- `situacaoOperacional` / `listExecutiveStatus` (identidade/status).
- Sincronizações de hidratação: reuniões, leads do Portal, CRM.
- Nenhum JS/CSS é rebaixado: assets permanecem em cache do SPA.

Causa principal: **shell instanciado por rota** (item 1). Causas secundárias: autorização sem cache compartilhado e guard cobrindo o shell.

## H. Arquitetura correta

Mover o shell para o layout da rota pai `/f/executivo`:

```text
f.executivo.tsx (layout)
  OperationalGuard
    ExecutiveShell            <- monta 1x, permanece montado
      <Outlet />              <- só o miolo troca
```

Com o título de cada página vindo do contexto de rota/`head` ou de um pequeno provider, e a autorização resolvida **uma vez** e compartilhada (TanStack Query com `staleTime`, ou contexto do layout). O guard passa a proteger apenas o conteúdo central, não o shell. A decisão continua **server-side** — nada de autorização no cliente.

## I. Arquivos que uma construção futura tocaria

- `src/routes/f.executivo.tsx` (passa a montar o shell).
- `src/components/executive/executive-shell.tsx` (aceitar filhos via `Outlet`; título por contexto).
- ~30 rotas `f.executivo.*.tsx` (remover a instância local do shell, manter só o conteúdo).
- `src/hooks/use-workspace-authorization.ts` (cache compartilhado, mantendo fail-closed).
- `src/components/executive/workspace-resource-guard.tsx` (envolver só o conteúdo central).

## J. Riscos

- Rotas com `fullBleed` (KPI Manager) e páginas que hoje renderizam shell em estados intermediários precisam de tratamento individual.
- Páginas que hoje escondem o shell inteiro atrás do guard passariam a mostrar o shell com o miolo bloqueado — mudança visual aceitável, mas precisa ser confirmada.
- Efeitos hoje disparados a cada navegação passariam a rodar só uma vez; qualquer tela que dependa disso como "refresh implícito" precisa de revalidação própria.
- Alto número de arquivos tocados: recomenda-se fazer por lotes.

## K. O que não deve ser alterado

`assertWorkspaceAccess`, RLS, `WorkspaceResourceGuard` (permanece, apenas reposicionado), `OperationalGuard`, titularidade, GreenSales, cadência, Ação do Dia, Central de Operações, KPI, Painel de Campanhas, e os ambientes `/s`, `/s/portal`, `/seg`, `/`.

## 10. Apresentação Digital

- Rota alvo: `/f/executivo/apresentacao-digital` — o arquivo existe (`src/routes/f.executivo.apresentacao-digital.tsx`) e o recurso está mapeado como `apresentacao_digital` (admin/gestão).
- Origem do erro: nos estados iniciais a página renderiza `<ExecutiveShell session={session!} …>` **antes** de `getSession()` ter retornado. O shell lê `session.userId` / `session.name` — com `session` nulo isso lança em tempo de execução.
- O erro sobe até o `errorComponent` do `__root.tsx`.
- Esse fallback tem um link **hardcoded** `<a href="/">Go home</a>` (`src/routes/__root.tsx`, bloco `ErrorComponent`) — e `<Link to="/">` também no `notFoundComponent`. Por serem `"/"` fixos e, no caso do `<a>`, navegação de documento, o usuário cai na Home institucional das três marcas em vez da Home do Workspace `/f/executivo/home`.
- Existe utilitário próprio para isso, hoje não usado nessas telas: `homePathFor` / `homePathOrRoot` em `src/lib/navigation-environment.ts`.
- Correção fica para construção separada.

## 11. Painel de Campanhas

Nada alterado. Registro: o filtro considera apenas executivos com `status === "ativo"` a partir de `listarDiretorioExecutivos` — coerente com o teste observado (Marton inativo deixa de aparecer).

## Componentes compartilhados entre ambientes (apenas informativo)

- `src/routes/__root.tsx` (inclui o `ErrorComponent` com `"/"` fixo) atende todos os ambientes — qualquer mudança ali é global.
- `ExecutiveShell`, `WorkspaceResourceGuard`, `OperationalGuard` e `use-workspace-authorization` hoje são usados apenas pelo ramo `/f`.

## Menor alteração segura recomendada

Mover a montagem do `ExecutiveShell` para `src/routes/f.executivo.tsx`, com `<Outlet />` no lugar de `children`, e passar a resolver a autorização uma única vez em cache compartilhado. Sozinha, essa mudança elimina o remount da lateral e as chamadas duplicadas, sem tocar em guards, RLS ou regras de acesso.

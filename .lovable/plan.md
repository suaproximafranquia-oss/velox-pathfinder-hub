# Central de Homologação — análise da arquitetura atual e proposta

Somente análise. Nenhum arquivo foi alterado.

## 1. Estrutura atual da rota

- `src/routes/f.executivo.homologacao.tsx` — rota real (`/f/executivo/homologacao`), componente único `HomologacaoPage`, com `head()` `noindex`.
- `src/routes/executivo.homologacao.tsx` — rota legada que apenas redireciona para a rota `/f`, preservando `search`.
- Página monolítica de ~700 linhas com seções empilhadas: cabeçalho + selo "Disparo real bloqueado", Biblioteca de Conteúdos (lacunas + link para `/f/executivo/biblioteca`), execução da rodada (nome do executivo, link do portal, cenários de `SCENARIOS`), histórico de rodadas, detalhe da rodada (execução, seleções de conteúdo, decisões) e o bloco de Reset controlado do Workspace.

## 2. Componentes, funções e guards

- Guard de sessão: herdado do layout `src/routes/f.executivo.tsx` (`OperationalGuard`, `ssr: false`). A rota em si não declara guard próprio.
- Visibilidade no menu: `executive-shell.tsx` mostra "Homologação do Motor" apenas para `activeRole === "super_admin"`.
- Layout: `ExecutiveShell`.
- Componentes: `HomologationCrm` (reusa `CrmThread` do CRM real).
- Sessão/identidade: `ensureCloudSession`, `getSession`, `loadUsers` (`@/lib/executive-auth`).
- Domínio: `SCENARIOS` (`lib/relationship/simulation`), `contentLibraryGaps`/`contentLibraryStats`, `stepShortCode`.
- Server functions: `listRelationshipContents`, `listRelationshipRuns`, `readRelationshipRun`, `runRelationshipHomologation`, `resetHomologationWorkspace` (`lib/relationship-homologation.functions`).
- `src/lib/homologation-guard.ts` é outra coisa: protege o AMBIENTE de homologação (login local do ambiente), não esta tela.

## 3. Melhor ponto de transformação

Transformar a própria rota `/f/executivo/homologacao` em Central, sem mover nada de lugar:

1. Converter `f.executivo.homologacao.tsx` em rota-pai de layout (renderiza `ExecutiveShell` + navegação de abas + `<Outlet />`).
2. Mover o conteúdo atual, sem edição de lógica, para `f.executivo.homologacao.index.tsx` (aba "Motor de Relacionamento"), que continua respondendo em `/f/executivo/homologacao`.

Assim a URL pública não muda, o link do menu não muda, e a homologação existente segue idêntica.

Alternativa mais barata ainda (se preferirem zero rota nova): manter arquivo único e adicionar um seletor de abas por estado local, com a demo renderizada em uma das abas. Menos organizado, porém uma única alteração de arquivo.

## 4. Incorporar a Ação do Dia Demo sem duplicar código

Nada precisa ser reescrito: a demo já é composta por três peças reutilizáveis — `createDemoDailyActionsAdapter()` (`lib/crm/daily-actions.demo.ts`), o overlay compartilhado `DailyActionsOverlay` e o contrato `daily-actions.adapter.ts`.

Proposta: extrair do arquivo de rota atual apenas o corpo visual (`DailyActionsDemoPage`) para um componente, por exemplo `src/components/executive/homologation-daily-actions-demo.tsx`, e renderizá-lo na aba correspondente da Central. A rota `/f/executivo/acao-do-dia-demo` passa a renderizar esse mesmo componente (ou vira redirect), sem cópia de JSX.

## 5. Isolamento da demo

O isolamento já está garantido por construção e deve ser preservado como está:

- `daily-actions.demo.ts` não importa nenhum `*.functions.ts`, nenhum cliente de banco, nenhum executor — só tipos puros e `normalizeDailyActions`.
- O adaptador demo devolve resultados simulados; `openWhatsapp` não abre `wa.me`.
- `onOpenLead` é no-op: a ficha real nunca abre.
- A fila vive em memória; recarregar reinicia.

Regra a manter na Central: a aba de demonstração recebe SEMPRE o adaptador demo, e nenhum componente da Central pode passar o adaptador real por engano. O selo "DEMONSTRAÇÃO" do overlay (`adapter.demoLabel`) continua sendo o sinal visual.

## 6. Navegação interna sugerida

Abas dentro da Central, com o mesmo `ExecutiveShell`:

```text
Central de Homologação
├── Motor de Relacionamento   (tela atual, intacta)
├── Ação do Dia (demo)        (adaptador demo)
└── [espaço para testes futuros]
```

Como rotas filhas: `/f/executivo/homologacao` (índice = motor) e `/f/executivo/homologacao/acao-do-dia`. Rotas filhas são preferíveis a abas por estado porque dão URL compartilhável, preservam o histórico do navegador e permitem adicionar testes futuros sem inflar um arquivo.

## 7. Conflitos a resolver antes

- **Permissão divergente**: a Homologação é `super_admin`; a demo hoje exige o módulo `portal_leads` via `useModuleAccess`. Ao entrar na Central é preciso decidir uma regra única — o mais coerente é a Central inteira ser `super_admin` e a aba demo manter, adicionalmente, sua checagem atual (o mais restritivo vence).
- **Shell duplicado**: a rota demo hoje monta `<main>` próprio com `OperationalGuard`; dentro da Central o guard já vem do layout `f.executivo` e o shell é o `ExecutiveShell`. O componente extraído não deve trazer guard nem `min-h-screen` próprio.
- **Overlay em tela cheia**: `DailyActionsOverlay` é um overlay `open/onClose`. Dentro de uma aba precisa de um botão "Abrir a Ação do Dia" (já existe na rota demo) para não cobrir a navegação de abas.
- **Vocabulário de etapas**: o fixture da demo usa "E2", que não é etapa executável do motor (é rótulo editorial do Word, mapeado para E3). Dentro de uma Central de Homologação essa incoerência fica visível e deve ser corrigida — em construção própria, depois desta.

## 8. Destino da rota `/f/executivo/acao-do-dia-demo`

Reaproveitar o componente e **incorporar** à Central. Recomendação: manter a rota existente funcionando como redirect para a aba nova (`/f/executivo/homologacao/acao-do-dia`), evitando link quebrado, exatamente como já é feito com `executivo.homologacao.tsx`.

## 9. Lógica que não pode ser tocada

- Todas as server functions de homologação e o reset controlado (com dupla confirmação) permanecem exatamente como estão.
- `HomologationCrm` e sua reutilização de `CrmThread`.
- O redirect legado `executivo.homologacao.tsx` depende do path atual — a URL `/f/executivo/homologacao` precisa continuar existindo.
- O item de menu `super_admin` em `executive-shell.tsx` aponta para essa mesma URL.
- Motor, cadência, E0, Safety Lock, Ação do Dia real e banco: nada é tocado.

## 10. Menor alteração arquitetural

Quatro passos, sem migration e sem tocar em lógica:

1. `f.executivo.homologacao.tsx` → layout com abas + `<Outlet />`.
2. Conteúdo atual movido, sem alteração, para `f.executivo.homologacao.index.tsx`.
3. Corpo da demo extraído para um componente compartilhado, usado pela nova rota filha `f.executivo.homologacao.acao-do-dia.tsx`.
4. `f.executivo.acao-do-dia-demo.tsx` vira redirect; rótulo do menu passa a "Central de Homologação".

Arquivos afetados: 4 rotas + 1 componente novo + 1 linha do `executive-shell.tsx`. Nenhum arquivo de motor, de mensagens, de E0 ou de banco.

## Pendência registrada

Correção do fixture da demo (remover "E2", incluir E12/RE/RF/V4 e derivar rótulos de `DEFAULT_STEP_LABELS`) fica como tarefa separada, posterior à criação da Central.

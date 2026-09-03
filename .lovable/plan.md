# Navegação por ambiente — Home contextual

Auditoria concluída e plano de correção. Nada de E0, banco, migration, cadência, Safety Lock ou criação de rotas.

## Regra adotada

HOME = HOME DO AMBIENTE ATUAL. `/` nunca é destino universal.

## Ambientes existentes hoje no código

| Ambiente | Rota | Layout/shell | Home atual | Situação |
|---|---|---|---|---|
| Institucional do Grupo | `/` (+ `/s`, `/seg`) | nenhum shell (`src/routes/index.tsx`) | `/` | correta |
| Corporate Workspace | `/f/executivo/*` | `ExecutiveShell` | `/f/executivo/home` | correta |
| CRM | `/f/crm` | `f.crm.tsx` + `CrmShell` | não existe Home própria | sem link Home |
| Remarketing | `/f/remarketing` | `f.remarketing.tsx` | não existe Home própria | sem link Home |
| Portal de Leads | `/f/portal-leads` | `f.portal-leads.tsx` | não existe Home própria | sem link Home |
| Portal do Investidor | `/f` (+ Manual, módulos editoriais, `/portal/convite/$token`) | `EditorialShell` / `JourneyChrome` / `ModuleChrome` | `/f` | links apontam para `/` (errado) |

CRM, Remarketing e Portal de Leads são ambientes de tela cheia com navegação interna por abas: hoje não têm nenhum botão "Home" — só "Sair", que vai para `/f/executivo`. Portanto não há nada errado neles; se um Home for adicionado no futuro, deve apontar para a raiz do próprio ambiente.

## Links "Home" incorretos (todos no Portal do Investidor)

- `src/routes/f.index.tsx:554` — logo "Portal Velox" → `/`
- `src/components/editorial/module-chrome.tsx:66` — logo "Início" → `/`
- `src/components/journey/journey-chrome.tsx:41` — logo "Início do Manual" → `/`
- `src/routes/manual/concluido.tsx:38` — botão de retorno → `/`
- `src/config/modules.ts:48-57` — card "Portal do Investidor" na Home do Workspace → `/`
- `src/routes/f.executivo.index.tsx:50` — "Voltar ao Portal Velox" → `/`
- `src/routes/__root.tsx:45` e `:83` — "Go home" genérico → `/` (404 e erro, sem contexto)

Corretos e mantidos: `ExecutiveShell` (menu Home → `/f/executivo/home`), `s.index.tsx` e `seg.index.tsx` (retorno institucional).

## Como identificar o ambiente

Não existe hoje função única. Há `unitPath`/`currentUnit`/`isOperationalPath` em `src/lib/business-unit.ts` (prefixo de unidade) e `data-shell` (só tema visual). O plano adiciona um resolvedor único de ambiente por pathname, sem alterar as funções atuais:

```text
/f/executivo/*   -> workspace   -> /f/executivo/home
/f/crm*          -> crm         -> /f/crm
/f/remarketing*  -> remarketing -> /f/remarketing
/f/portal-leads* -> leads       -> /f/portal-leads
/f, /manual/*, módulos editoriais, /portal/* -> investidor -> /f
/, /s, /seg      -> institucional -> /
```

Ambiente de navegação é conceito distinto de origem do lead (GreenSales, Portal, TikTok, Meta) — nada nessa área é tocado.

## O que muda

1. **Novo resolvedor** em `src/lib/business-unit.ts`: `environmentFor(pathname)` e `homePathFor(pathname)` com a tabela acima.
2. Logo/retornos do Portal do Investidor passam a apontar para `/f`: `f.index.tsx`, `module-chrome.tsx`, `journey-chrome.tsx`, `manual/concluido.tsx`.
3. Card "Portal do Investidor" em `src/config/modules.ts` → `/f`.
4. "Voltar ao Portal Velox" em `f.executivo.index.tsx` → `/f`.
5. `__root.tsx` (404/erro) usa `homePathFor` em vez de `/` fixo.
6. Nenhum link institucional dentro do Portal do Investidor.
7. **Unidades do Grupo** sai do menu `/f` (`executive-shell.tsx`); rota, dados, formulário público e backup permanecem intactos.

`/f` é a Home do Portal do Investidor apenas dentro da arquitetura atual; conceitualmente ele segue sendo ambiente independente e poderá ganhar prefixo próprio depois, sem mudar essa regra.

## O que não muda

Apresentação Digital (funcional, `/f/executivo/apresentacao-digital` + `/portal/convite/$token`), Home do Workspace, CRM/Remarketing/Portal de Leads, E0, permissões, cadência, GreenSales, Safety Lock, banco.

## Arquivos afetados

`src/lib/business-unit.ts`, `src/config/modules.ts`, `src/routes/f.index.tsx`, `src/routes/f.executivo.index.tsx`, `src/routes/manual/concluido.tsx`, `src/routes/__root.tsx`, `src/components/editorial/module-chrome.tsx`, `src/components/journey/journey-chrome.tsx`, `src/components/executive/executive-shell.tsx`.

## Validação

Typecheck e build; conferir Home em cada ambiente, ausência de "Unidades do Grupo" no menu `/f` e acesso direto por URL preservado.

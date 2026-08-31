# Auditoria Profunda — Bateria 1: Navegação, Interface e Arquitetura Visual

Somente leitura. Nenhum arquivo do projeto foi alterado. Tudo abaixo foi verificado no código atual.

## A) Mapa dos ambientes

| Ambiente | Rota | Finalidade | Marca | Proteção |
|---|---|---|---|---|
| Institucional do Grupo | `/` (`index.tsx`) | Landing das 3 empresas | Grupo | Pública; redireciona para `/f` só quando há search de contexto (e, m, o, u, c, b, ch, lead) |
| Financeira / Portal do Investidor | `/f` (`f.tsx` + `f.index.tsx`) | Home do Portal do Investidor | Financeira | Pública, com SSR |
| Solar | `/s` | Landing + formulário de interesse | Solar | Pública |
| Seguros | `/seg` | Landing + formulário de interesse | Seguros | Pública |
| Workspace / Portal do Executivo | `/f/executivo/*` | Central do Executivo | Financeira | OperationalGuard + ssr:false; `/f/executivo` é a tela de acesso pública |
| CRM | `/f/crm` | Relacionamento estilo WhatsApp | Financeira | OperationalGuard + ssr:false (sem rota pública) |
| Portal dos Leads | `/f/portal-leads` | Kanban somente leitura | Financeira | Guard + useModuleAccess |
| Remarketing | `/f/remarketing` | Ambiente independente (nova aba) | Financeira | Guard + ssr:false |
| Link personalizado | `/f/$slug`, `/s/$slug`, `/seg/$slug`, `/e/$slug` (legado) | Portal por executivo | conforme prefixo (`/e` → Financeira) | Pública |
| Jornada / Manual | `/manual/*` | Jornada editorial | Financeira | Pública |
| Universo | `/universo` | Material institucional | Financeira | Pública |
| Canal de origem | `/origem/$channel` | Entrada por campanha (TikTok/Meta) | Financeira | Pública |
| Convite E20 (Apresentação Digital do investidor) | `/portal/convite/$token` | Apresentação digital com token 7 dias | Financeira | Token |
| Entrar (legado) | `/entrar` | Redireciona para `/f` | Financeira | Pública |

## B) Mapa das rotas e redirects legados

Todos os redirects abaixo são `beforeLoad` + `throw redirect(replace:true)` preservando `search` — nenhum quebrado:

- `/crm` → `/f/crm`; `/remarketing` → `/f/remarketing`; `/portal-leads` → `/f/portal-leads`
- 28 arquivos `executivo.*.tsx` → espelho 1:1 para `/f/executivo/*` (redirect puro, sem conteúdo duplicado)
- `/entrar` → `/f`; `/e/$slug` → `/f?e=slug&m=manual`
- `/f/executivo/greensales` → `/f/portal-leads`; `/f/executivo/relatorios` → `/f/executivo/brain`

Rotas sem legado equivalente (novas, esperado): `apresentacao-digital`, `investidores/$id`, `unidades`.

### Rotas existentes sem item de menu
`institucional`, `investidores` e `investidores/$id`, `identidade`, `templates` (saída do menu documentada em comentário no shell), `teste-cadencia`, `celebracao`, `greensales-sync` (só aparece como card na Home, via `config/modules.ts`), `administracao`, `recursos`.

Nenhum item de menu aponta para rota inexistente: os 24 itens do `executive-shell.tsx` têm rota 1:1 confirmada.

## C) Mapa dos menus (`src/components/executive/executive-shell.tsx`)

- Dia a dia: Home, Workspace, CRM (nova aba), Remarketing (nova aba), KPI Manager, Painel de Campanhas, Brain Analytics, IA Criativa, Portal dos Leads (nova aba).
- Centrais: Captação, Reuniões, Alertas, Central de Backup (super_admin), Revista Velox.
- Relacionamento: Biblioteca de Conteúdos, Apresentação Digital, Unidades do Grupo, Homologação do Motor (super_admin), Backup de Conversas.
- Administrativo: Usuários, Meu Perfil, Configurações, Laboratório Atlas (só em homologação).

Observações objetivas:
- "Central de Backup" (banco inteiro, super_admin) e "Backup de Conversas" (CRM, somente leitura) são módulos distintos — não há duplicidade de código, apenas nomenclatura ambígua.
- `SiteNav` e `editorial/module-chrome` são chrome público (âncoras), não menus de sistema.
- `crm-shell.tsx` não tem menu lateral próprio.

## D) Links de Home/Voltar incorretos (não corrigidos)

| Arquivo:linha | Situação | Risco |
|---|---|---|
| `src/routes/__root.tsx:45` (NotFound "Go home") | `to="/"` fixo; 404 dentro do Workspace ejeta para a raiz institucional | Alto |
| `src/routes/__root.tsx:83` (Error "Go home") | `href="/"` fixo; mesmo efeito em erro de runtime | Alto |
| `src/config/modules.ts:54` | Card "Portal do Investidor" com `href:"/"` external → abre a raiz do Grupo em vez de `/f` | Alto (marca cruzada) |
| `src/routes/f.executivo.index.tsx:50` | Botão "Voltar ao Portal Velox" abre `/` | Médio |
| `src/routes/f.index.tsx:554` | Logo "Portal Velox" na Home Financeira aponta para `/` | Médio |
| `module-chrome.tsx:66`, `journey-chrome.tsx:41`, `manual/concluido.tsx:38` | logo/voltar público → `/` | Baixo |
| `s.index.tsx:61`, `seg.index.tsx:61` | "Grupo Velox" → `/` | Correto por design |

`__root.tsx` já importa `isOperationalPath` (linha 32) mas não o usa nos handlers de erro/404.

## E) Componentes com navegação/estado incorretos

- `f.executivo.apresentacao-digital.tsx:156,164,177`, `f.executivo.alertas.tsx`, `f.executivo.unidades.tsx`: passam `session!` para `ExecutiveShell` enquanto `session` é `null` no primeiro render (vem de `getSession()` em `useEffect`). `ExecutiveShell` lê `session.userId` (linha 81) e `session.name` (linha 399) sem optional chaining → crash real "Something went wrong".
- `f.executivo.celebracao.tsx`: única página de conteúdo sem `ExecutiveShell` e sem retorno visível durante a tela.
- `investor-profile-view.tsx:581`: chama o módulo de "Cultura Velox" — nomenclatura antiga, o resto do sistema usa "Princípios Velox".

## F) Unidades do Grupo — origem e dependências

- Menu criado em `executive-shell.tsx:194`, condicionado a acesso administrativo.
- Rota `src/routes/f.executivo.unidades.tsx`; server fns em `src/lib/group/unit-leads.functions.ts`; tabela `group_unit_leads`.
- Finalidade real: carteira de interessados de Solar e Seguros, captados por `src/components/group/unit-interest-form.tsx` nas landings `/s` e `/seg`. Isolado do CRM, cadência e `portal_leads`.
- Não tem relação com a narrativa institucional de "milhares de unidades" da Home — é gestão de leads das duas marcas não operacionais.
- Remoção: tecnicamente isolada, mas eliminaria a única gestão dos leads captados em `/s` e `/seg` — não é código morto.

## G) Homologação do Motor — origem e dependências

- Rota `/f/executivo/homologacao` (super_admin); UI `src/components/executive/homologation-crm.tsx` reutiliza `CrmThread` real; servidor `src/server/relationship/homologation.server.ts`.
- O arquivo tem duas responsabilidades: (1) simulador de rodadas com leads `TEST-XXXX`, escopo `homologation`, despacho em memória, sem tocar produção; (2) `listValueContents` da Biblioteca (`relationship_contents`, escopo `library`) — este é compartilhado com produção.
- O motor real não depende do simulador, mas depende da parte de biblioteca. A tela de Biblioteca própria (`f.executivo.biblioteca.tsx`) existe e é separada. Remoção do simulador seria segura; remoção do arquivo inteiro não.

## H) Princípios Velox — estado real

- `principios-overlay.tsx:22-23`: `PRINCIPLE_TITLES = ["Missão","Visão","Valores"]`, `PRINCIPLE_COUNT = 3`. Renderiza sempre exatamente 3 cards.
- Divergência de documentação no mesmo arquivo: comentário de topo ainda cita "exatamente 6 princípios" e o `aria-label` (linha 113) diz "Os seis Princípios Velox", enquanto o comentário das linhas 17-21 já diz três quadros.
- Dados vêm do banco via `fetchInstitutionalModule({ module: "principios" })`; títulos e placeholder são hardcoded no componente. Sem card vazio: posição faltante mostra placeholder "Em definição".
- `f.executivo.institucional.tsx:244-251`: campo "Ordem" é input numérico livre, sem limite 1–3 — posições 4/5/6 podem ser gravadas e nunca aparecem (lixo silencioso).
- Nenhuma outra tela lê posições > 3.

## I) Apresentação Digital — estado real

Tela administrativa (`/f/executivo/apresentacao-digital`): sem `errorComponent`, sem botões "tentar novamente"/"voltar para Home"; falhas só geram `toast.error`. Crash de primeiro render pelo `session!` descrito em (E). Ausência de capítulos é tratada com mensagem explícita e nada é inventado.

Tela do investidor (`/portal/convite/$token`): em erro (inválido/expirado/encerrado) renderiza apenas texto, sem nenhum CTA — tela morta. Com roteiro vazio, redireciona silenciosamente para `/f`. O botão "Continuar no Portal do Investidor" (→ `/f`) só existe no caminho de sucesso. `presentation_chapters` está vazia em produção, então hoje o caminho real é o redirect silencioso.

## J) Redirects legados

Ver seção B. Todos funcionais e preservando `search`. Nenhum aponta para ambiente errado.

## K) Inconsistências visuais objetivas

1. `celebracao` sem shell e sem retorno.
2. "Cultura Velox" vs "Princípios Velox".
3. `aria-label` "Os seis Princípios Velox" com 3 cards.
4. Rótulo "Portal Velox" levando à raiz do Grupo (dois pontos).
5. "Central de Templates" viva por URL mas fora do menu.
6. `config/modules.ts:72-89`: ~16 ícones importados só para satisfazer o lint via `void [...]` — resíduo de refatoração.
7. Nomes "Central de Backup" x "Backup de Conversas" facilmente confundíveis.

## L) Arquivos envolvidos

`src/routes/__root.tsx`, `index.tsx`, `f.tsx`, `f.index.tsx`, `f.executivo.tsx`, `f.executivo.index.tsx`, `f.executivo.apresentacao-digital.tsx`, `f.executivo.alertas.tsx`, `f.executivo.unidades.tsx`, `f.executivo.celebracao.tsx`, `f.executivo.institucional.tsx`, `portal.convite.$token.tsx`, `s.index.tsx`, `seg.index.tsx`, os 28 `executivo.*.tsx` legados; `src/components/executive/executive-shell.tsx`, `src/components/portal/principios-overlay.tsx`, `src/components/executive/homologation-crm.tsx`, `src/components/executive/workspace/investor-profile-view.tsx`, `src/components/group/unit-interest-form.tsx`, `src/components/editorial/module-chrome.tsx`, `src/components/journey/journey-chrome.tsx`; `src/config/modules.ts`, `src/lib/business-unit.ts`, `src/lib/portal-brands.ts`, `src/lib/group/unit-leads.functions.ts`, `src/server/relationship/{homologation,presentation,e20}.server.ts`.

## M) Riscos

- Crash da Apresentação Digital, Alertas e Unidades no primeiro render (padrão `session!`) — afeta 3 telas, não é caso isolado.
- 404/erro dentro do Workspace expulsa o executivo autenticado para a landing pública do Grupo.
- Card "Portal do Investidor" leva à raiz do Grupo: cruzamento de marca visível ao usuário.
- Convite E20 com erro deixa o investidor em tela sem saída.
- Posições 4–6 graváveis em Princípios geram dados invisíveis.

## N) O que é seguro corrigir na próxima rodada

1. `__root.tsx`: Not Found e Error passarem a usar `isOperationalPath` para voltar a `/f/executivo/home` dentro do Workspace.
2. `config/modules.ts:54`: `href:"/"` → `unitPath("/")`; e remoção do bloco `void [...]` com os ícones mortos.
3. `f.executivo.index.tsx:50` e `f.index.tsx:554`: apontar "Portal Velox" para `/f`.
4. Guard de sessão nas 3 telas com `session!` (render nulo até `getSession()` resolver), ou tornar `ExecutiveShell` tolerante a sessão ausente.
5. CTA na tela de erro do convite E20 e mensagem explícita quando não há capítulos.
6. `aria-label` e comentário de topo do `principios-overlay.tsx`; limite 1–3 no campo Ordem do admin institucional.
7. Renomear "Cultura Velox" para "Princípios Velox" na ficha do investidor.
8. Navegação de retorno em `celebracao`.

## O) O que NÃO deve ser alterado

- Os 28 redirects legados `/executivo/*`, `/crm`, `/remarketing`, `/portal-leads`, `/entrar`, `/e/$slug`.
- Módulo Unidades do Grupo e tabela `group_unit_leads` (captação viva de `/s` e `/seg`).
- `homologation.server.ts` na parte de Biblioteca (usada em produção) e o isolamento dos leads `TEST-XXXX`.
- Portal dos Leads, integração GreenSales e quaisquer dados reais.
- `presentation_chapters`: nenhum capítulo fictício deve ser criado.
- Links "Grupo Velox" em `/s` e `/seg` (corretos por design).

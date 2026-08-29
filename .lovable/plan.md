# Diagnóstico Técnico — Lacunas do Portal Raiz e da Apresentação Digital

Auditoria somente leitura. Nada foi alterado: nenhum código, banco, migration, dado ou tela.

## A. Já existe e está funcionando

**Motor da E20 (backend)** — `src/server/relationship/e20.server.ts`
- `issueE20` abre instância de cadência (`openInstance`), encerra a ocorrência anterior com
  `encerrada_por_nova`, gera token de 24 bytes, grava `expires_at` (+7 dias),
  `checkpoint_due_at` e `finalization_due_on` (próximo dia útil pelo calendário oficial).
- Assinatura pelo **executivo responsável** (`resolveLeadExecutive`), não por quem clicou.
- Mensagem vinda da **Biblioteca** (`renderFromLibrary("E20")`) com nome do investidor e link,
  congelada em `recordMessageSnapshot`.
- `currentE20` devolve a ocorrência vigente; `emitirE20` sem `force` **reutiliza** o convite.
- OPORTUNIDADE é bloqueada dentro de `openInstance`.

**Resgate público do convite** — `src/routes/portal.convite.$token.tsx` + `redeemE20`
- Rota pública sem login, `ssr: false`. Registra cada abertura em
  `relationship_e20_accesses` (com `user_agent` e `outcome`), incrementa `open_count`,
  grava `first_opened_at`, marca `expirada`/`substituido` e mostra texto explicativo.

**Painel na ficha do lead** — `src/components/executive/workspace/e20-panel.tsx`
dentro de `investor-profile-view.tsx`, usado em `/f/executivo/investidores/$id`.
Mostra convite vigente, validade restante, contagem de aberturas, primeira abertura e
histórico. Botões "Gerar apresentação digital", "Gerar novo convite" e "Copiar" (link).

**E27/Finalização** — `src/server/relationship/closure.server.ts` + `scheduler.server.ts`,
derivados de `checkpoint_due_at`/`finalization_due_on` da ocorrência: sem E20, não nascem.
`opportunity.server.ts` cancela os pendentes ao entrar em OPORTUNIDADE.

## B. Existe mas está incompleto

1. **Botão de gerar não respeita elegibilidade na interface** — `e20-panel.tsx`.
   Hoje o botão sempre aparece; a recusa só acontece no servidor, via `toast` de erro.
   Deveria: ocultar/bloquear com explicação quando o lead estiver em OPORTUNIDADE ou com o
   ciclo encerrado. Dependência: estado do lead já disponível em `investor-profile-view`.
   Risco: baixo (mudança de apresentação; a trava real do servidor permanece).

2. **"Copiar mensagem" não existe** — `e20-panel.tsx` copia apenas o link.
   `issueE20` já retorna `message.body` renderizado, mas o painel descarta esse valor e
   não o persiste na tela. Faltam: exibir a mensagem, botão "Copiar mensagem", e o registro
   do evento "mensagem copiada" (que hoje não existe em lugar nenhum).
   Risco: nenhum sobre histórico; é acréscimo.

3. **Reutilização não é comunicada corretamente** — o painel mostra "Gerar novo convite"
   quando há vigente, mas não o rótulo definido "Apresentação ativa — abrir/visualizar",
   e a nova emissão não pede confirmação explícita apesar de encerrar a anterior.

4. **Indicadores incompletos** — o painel mostra `openCount` e `firstOpenedAt`; **último
   acesso não é exposto**. O dado existe em `relationship_e20_accesses.accessed_at`, mas
   `E20Occurrence` não carrega `lastOpenedAt` e `estadoE20` não lê a tabela de acessos.

5. **Biblioteca sem texto oficial da E20** — `message-library.server.ts` mantém E20/E27 em
   `awaitingOfficialText`. Enquanto isso, `issueE20` devolve `messageBlockedReason` e a
   ocorrência nasce sem mensagem. Não é bug: é dependência de conteúdo seu.

## C. Existe no backend mas não existe na interface

1. **Registro de acessos detalhado** — `relationship_e20_accesses` grava cada abertura com
   horário, user agent e desfecho; **nenhuma tela lê essa tabela**. Faltam: último acesso,
   linha do tempo de aberturas e o indicador "Investidor visualizou" no Workspace.

2. **Motivo e autor do encerramento** — `close_reason`, `closed_at` e o snapshot
   (`emitido_por`, `assinatura`, `instancia`) existem na ocorrência; o histórico da tela
   mostra apenas data, status e nº de aberturas.

3. **Mensagem renderizada da emissão** — `recordMessageSnapshot` grava o texto congelado em
   `relationship_message_sends`, mas a ficha não exibe o que foi efetivamente gerado.

## D. Não existe

1. **Área administrativa da Apresentação Digital.** Não há tabela, server module, rota nem
   componente. Busca por vídeos retorna apenas `src/components/journey/video-slot.tsx`
   (Jornada pública) e `MediaSlot` (site institucional) — nada ligado à E20.
   Faltam por inteiro: cadastro de vídeos (título, descrição, ordem, ativo/inativo),
   versionamento com preservação das versões anteriores, visão do roteiro ativo, e o gate
   por **permissão administrativa** (hoje `src/config/modules.ts` só conhece
   `requiresRole: super_admin | diretora | executivo` — permissão administrativa
   independente do cargo ainda não é um conceito modelado).

2. **Área pública de exibição da apresentação.** O convite hoje **não abre apresentação
   alguma**: `portal.convite.$token.tsx` valida o token e redireciona para `/` com
   `?lead=…`, ou seja, entrega o investidor ao Portal do Investidor genérico.
   Falta a rota/tela dedicada que reproduz o roteiro de vídeos daquela emissão.

3. **Snapshot do roteiro da apresentação.** A coluna `snapshot` da ocorrência guarda apenas
   emissor, assinatura e instância. Não há estrutura para congelar vídeos, ordem, títulos e
   descrições. O padrão a reaproveitar é o dos destinos da E0 e o de
   `recordMessageSnapshot` — não criar um mecanismo paralelo.

4. **Encerramento manual da E20.** Não existe função nem botão. Encerramento só acontece por
   nova emissão, OPORTUNIDADE ou fim de ciclo. Faltam: motivo obrigatório, autor, data/hora
   e evento na Jornada.

5. **Eventos distintos na Jornada** — "mensagem copiada", "mensagem enviada",
   "apresentação aberta", "apresentação expirada", "E20 encerrada (motivo/autor)".
   Hoje a Jornada recebe apenas o snapshot da emissão.

6. **Portal institucional do Grupo Velox.** Não existe rota, componente nem conteúdo.

7. **Rota `/f` como portal público da Financeira.** `src/routes/f.tsx` é apenas um layout
   neutro com `<Outlet />`; **não existe `f.index.tsx`**, portanto `/f` hoje não renderiza
   página alguma.

8. **`/s` e `/seg`.** Declarados em `src/lib/business-unit.ts` e `src/lib/portal-brands.ts`
   como marcas preparadas, mas **sem nenhuma rota**. Um acesso a `/s/alguem` hoje é 404.

## E. Existe em local incorreto

1. **Portal do Investidor da Financeira ocupa a raiz** — `src/routes/index.tsx`
   (Hero, Gateway, Simulador, Revista, Estrutura, Princípios, sessão do lead).
   Deveria viver em `/f`; a raiz deveria ser institucional, pública, sem Gateway e sem
   captação.

2. **Redirecionamentos apontam para a raiz** — três pontos, todos a alterar juntos:
   - `src/routes/f.$slug.tsx`: link personalizado redireciona para `/` com
     `{ e, m, o, b }`.
   - `src/routes/e.$slug.tsx`: link legado, mesmo padrão.
   - `src/routes/portal.convite.$token.tsx`: convite E20 redireciona para `/` com `lead`.
   **Risco real de quebrar os links personalizados existentes**: `/f/{slug}` e `/f` são o
   mesmo primeiro segmento. Hoje `f.$slug` convive com os segmentos estáticos porque o
   roteador dá precedência a eles; ao criar `f.index.tsx` o conflito não aumenta, mas
   qualquer troca de destino precisa preservar exatamente os mesmos parâmetros de contexto
   (`e`, `m`, `o`, `b`, `lead`) lidos por `src/lib/portal-entry.ts`.

3. **Origem "veio do Grupo" não existe** — `EntryContext` já carrega `brand`, `unit`,
   `origin`, `campaign`, `channel`; falta apenas a origem institucional do Grupo, que deve
   ser acrescentada a esse mesmo contexto, nunca a um mecanismo novo.

## F. Risco de duplicidade / paralelismo

1. **Criar uma segunda home institucional** em vez de mover a atual: manteria duas fontes de
   verdade para o Portal do Investidor. A raiz deve ser nova; `/f` deve reaproveitar
   `src/routes/index.tsx` e seus overlays já existentes.

2. **Botão de gerar E20 fora do Workspace** — a Ação do Dia
   (`daily-actions-overlay.tsx`, `daily-actions.server.ts`) hoje **não** tem botão de
   geração, e não deve ganhar um. Só atalho para a ficha.

3. **Snapshot paralelo do roteiro** — reaproveitar `snapshot` da ocorrência e o padrão de
   congelamento existente, não criar uma segunda tabela de histórico de apresentação.

4. **Permissão administrativa paralela** — deve nascer no mesmo modelo de permissões
   (`src/config/modules.ts` + `workspace_module_permissions` + `user_roles`), não como flag
   isolada da tela de vídeos.

5. **Separação de dados Solar/Seguros** — `portal_leads`, `crm_leads` e o motor não têm
   coluna de unidade. Qualquer captação de `/s` ou `/seg` cairia hoje na carteira da
   Financeira. Antes de abrir essas rotas com formulário, é obrigatório definir a chave de
   unidade e o isolamento por RLS/consulta.

## Dependências de conteúdo (bloqueiam a operação, não o código)

- Texto oficial da E20 e da E27 na Biblioteca.
- Vídeos e roteiro da Apresentação Digital.
- Conteúdo institucional do Grupo, Solar e Seguros.

## Próximo passo

Nenhuma implementação nesta etapa. O comando futuro deve ser dividido em:
**(1)** raiz do Grupo + Portal da Financeira em `/f` + redirecionamentos e origem;
**(2)** área administrativa de vídeos + snapshot do roteiro + área pública da apresentação;
**(3)** encerramento manual, eventos distintos na Jornada e indicadores no Workspace.

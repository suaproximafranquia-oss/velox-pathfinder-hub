# Confluência 2 — Base do Portal do Investidor Solar (/s)

Análise somente leitura. Nada foi alterado. Complementa a Confluência 1 (que segue válida: `/f` é portal completo, `/s` e `/seg` são páginas institucionais com formulário, por decisão explícita no código).

## 1. Estrutura visual do /f, na ordem da tela

Arquivo raiz: `src/routes/f.index.tsx` (873 linhas). Todos os blocos abaixo estão **dentro desse mesmo arquivo**, exceto onde indicado.

| # | Elemento | Arquivo | Reutilizável | Conteúdo Financeira | Regra Financeira | Aceita brand/unit sem mudar comportamento |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `PortalHeader` (selo "V" + "Portal Velox") | f.index.tsx (local) | estrutura sim | sim (texto e `to="/f"` fixos) | não | sim, trivialmente |
| 2 | `Hero` (foto, título, subtítulo, rodapé editorial) | f.index.tsx (local) | estrutura sim | sim (imagem, textos, "Sede Velox · São José do Rio Preto") | não | sim, via props/config |
| 3 | `ResumeBanner` (retomar jornada) | f.index.tsx (local) | sim | não | usa sessão global | sim |
| 4 | `ModulesGrid` + `ModuleTile` | f.index.tsx (local) | estrutura sim | sim (array `MODULES` com 6 cards, textos e capas) | sim (regra "só Manual é livre; demais exigem WhatsApp") | sim, se `MODULES` vier por marca |
| 5 | `InvestorNewsFeed` | `src/components/portal/investor-news-feed.tsx` | sim | não (vem de `news_posts`) | não | **não isola hoje**: a consulta é global |
| 6 | `PortalFooter` | f.index.tsx (local) | estrutura sim | sim ("© Velox Soluções Financeiras", link Grupo, "Powered by Atlas Platform") | não | sim |
| 7 | `ModulePanel` (iframe do módulo) | f.index.tsx (local) | sim | não | não | sim |
| 8 | Overlays lazy (Simulador, Revista, Estrutura, Princípios, Gateway, Confirmação de telefone) | `src/components/portal/*`, `src/components/simulator/*` | ver seção 4 | ver seção 4 | ver seção 4 | ver seção 4 |

## 2. O que está amarrado à Financeira dentro de f.index.tsx

| Item | Classificação |
| --- | --- |
| `head()`: título, description, og:title/description/image | metadados + texto |
| `assetUrl("portal-hero-sede")` e as 6 capas de módulo | imagem/asset |
| Textos do Hero ("Portal Velox", "Ecossistema Velox · Edição MMXXVI", sede em Rio Preto) | texto |
| Array `MODULES` (6 cards com eyebrow, título, descrição, CTA) | módulo + texto |
| `moduleKey` apontando para `portal-modules.ts` | módulo |
| Regra "módulo ≠ manual exige WhatsApp confirmado" (`isPortalUnlocked`) | regra de negócio |
| `setJourneyStatus("manual"/"simulador"/"portal")` | regra de negócio |
| `navigate({ to: "/f" })` e `<Link to="/f">` no header | rota |
| Footer "© Velox Soluções Financeiras" + `<Link to="/">` | texto + link |
| Variáveis CSS `--brand-orange`, `--brand-blue-deep`, `--ink`, `--paper` | identidade visual (globais, não por marca) |
| Gateway + telefone + `startPortalSession` | sessão/gateway |
| `writeEntryContext({ brand: search.b })` | sessão/gateway (único ponto que já carrega marca) |
| `trackModuleAccess` → `pushPortalProgress` | outro (telemetria) |

**Estrutura** (reaproveitável sem mudança): layout, grid, overlay shell, iframe, sessão, gateway, contexto de entrada, controle de módulo pendente e retomada.
**Conteúdo** (precisa ser por empresa): head/metadados, hero, array `MODULES`, capas, footer, textos institucionais e o conteúdo carregado por cada overlay.

## 3. Módulos do Portal (`src/lib/portal-modules.ts`)

Registro atual, **sem nenhuma chave de marca**:

| Módulo | Como abre | Aparece em /f | Natureza | Depende de conteúdo | Depende de rota | Poderia existir na Solar | Deve aparecer na Solar hoje |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `manual` | iframe `/manual` | sim | conteúdo Financeira | sim (13 capítulos) | sim | sim, com conteúdo próprio | não |
| `universo` | iframe `/universo` | sim | conteúdo Financeira | sim | sim | sim, com conteúdo próprio | não |
| `simulador` | `SimulatorModal` | sim | regra de negócio Financeira (receita de franquia) | sim (fórmulas) | não | só com modelo Solar | não |
| `estrutura` | `EstruturaOverlay` | sim | institucional Velox (fotos da sede) | sim (`portal_institutional_blocks`) | não | sim | não sem bloco próprio |
| `revista` | `MagazineOverlay` | sim | institucional Grupo | sim (`magazine_editions`) | não | sim | possível — é conteúdo de grupo |
| `principios` | `PrincipiosOverlay` | sim | institucional Grupo | sim | não | sim | possível — é conteúdo de grupo |

Consumidores do registro: `f.index.tsx`, `portal-entry.ts`, `portal-access.ts`, `portal-session.ts` e o guard de rotas internas (`guardedPaths` protege `/manual` e `/universo` de acesso direto). **Nenhum é global-por-marca**: hoje o registro é único para toda a plataforma.

## 4. Overlays usados pelo /f

| Overlay | Arquivo | Aberto por | Conteúdo | Fixo ou parametrizável | Referência direta à Financeira | Reuso seguro na Solar |
| --- | --- | --- | --- | --- | --- | --- |
| Shell de overlay | `portal-overlay-shell.tsx` | todos | só moldura | parametrizável (title/children) | não | sim, direto |
| Painel iframe | `ModulePanel` em f.index.tsx | `manual`, `universo` | rota interna | parametrizável (`src`) | via `panelSrc` | sim, apontando outra rota |
| Simulador | `simulator/simulator-modal.tsx` | `simulador` | cálculo de receita de franquia | fixo | sim (modelo de negócio) | **não** sem modelo Solar |
| Revista | `magazine-overlay.tsx` + `magazine-reader.tsx` | `revista` | `magazine_editions` / `magazine_pages` | parametrizável na estrutura, dados globais | não no código | sim (estrutura); dados hoje globais |
| Estrutura | `estrutura-overlay.tsx` | `estrutura` | `portal_institutional_blocks` + galeria fixa de fotos | **híbrido**: blocos vêm do banco, mas a galeria e os textos são fixos Velox Financeira | sim ("Fachada da sede Velox Soluções Financeiras") | estrutura sim; conteúdo não |
| Princípios | `principios-overlay.tsx` | `principios` | `portal_institutional_blocks` + capa fixa | híbrido | sim (textos "Princípios Velox") | estrutura sim; conteúdo por marca |
| Gateway | `gateway-overlay.tsx` | qualquer módulo sem sessão | identificação + `startPortalSession` | parametrizável (title) | não no visual; sim na lógica (usa `getPortalAdministratorId`) | sim, se a sessão receber a marca |
| Confirmação de telefone | `phone-registry-overlay.tsx` | bloqueio de módulo | confirmação do WhatsApp | parametrizável | não | sim |

## 5. Identidade visual — de onde vem hoje

| Elemento | Origem atual |
| --- | --- |
| Logo | **hardcoded**: quadrado com a letra "V" desenhada em `PortalHeader` |
| Nome da empresa | **hardcoded** ("Portal Velox", "Velox Soluções Financeiras" no footer) |
| Cores | variáveis CSS globais em `src/styles.css` (`--brand-orange`, `--brand-blue-deep`, `--paper`, `--ink`) — **globais, não por marca** |
| Textos de identificação | hardcoded no Hero/footer |
| Imagens | `assetUrl(...)` do registro de assets — chaves fixas da Financeira |
| Favicon | `public/favicon.ico`, único para todo o site |
| Título da página / metadados | `head()` da rota, hardcoded |
| `PORTAL_BRANDS` | fornece **apenas** prefixo, nome, shortName e rótulo de origem. Não fornece cor, logo, asset, texto nem módulo |

Ou seja: hoje **nada da identidade visual do /f vem de `PORTAL_BRANDS`**. A marca é usada só para rotular origem de lead e montar o link do executivo.

## 6. Sessão e Gateway

Fluxo: `/f` → clique num módulo → sem sessão → `GatewayOverlay` → `startPortalSession` → (se necessário) `PhoneRegistryOverlay` → `promotePortalSession` → módulo abre.

- **Específico ou reutilizável:** o motor é **reutilizável**; a sessão já tem campos `brand` e `unit`.
- **Como a marca é determinada:** só pelo parâmetro `b` da URL, gravado em `writeEntryContext` e lido em `startPortalSession` via `getBrand(entry.brand).key`. Sem `b`, cai no padrão `financeira`.
- **Onde fica armazenada:** contexto de entrada em `sessionStorage` (`velox:portal:entry-context:v1`); sessão em `localStorage` (`velox:portal:session:v1`), chave **única para todo o domínio**.
- **Como diferencia investidor Financeira de Solar:** hoje **não diferencia**. O campo `brand` é gravado, mas **nenhuma leitura filtra por ele** — nem a sessão, nem os módulos, nem o feed, nem o desbloqueio.
- **Risco de sessão de /f aparecer em /s:** **SIM, risco real e confirmado.** A chave de sessão não é namespaced por marca; um visitante que se identificou em `/f` chegaria ao `/s` já identificado, já desbloqueado e com banner "retomar jornada" apontando para um módulo da Financeira.
- **Isolamento necessário para /s:** sim — chave de sessão e de contexto de entrada por marca (`velox:portal:session:v1:{brand}`), ou um campo de marca validado na leitura. Não exige novo motor.

## 7. Dados persistentes lidos pelo Portal /f

| Estrutura | Granularidade hoje | Vaza para a Solar se só a interface for replicada? |
| --- | --- | --- |
| `localStorage velox:portal:session:v1` | por sessão/dispositivo | **sim** |
| `sessionStorage velox:portal:entry-context:v1` | por sessão | **sim** |
| leads locais (`src/lib/leads.ts`) | por lead | **sim** |
| `portal_leads` | por lead, com `scope`/origem — sem coluna de marca do portal | **sim** (o lead Solar nasceria como Financeira) |
| `investors` / `investor_identifiers` | por investidor, global por design | por design é global — aceitável |
| `portal_engagement`, `portal_journey_events` | por investidor/sessão | **sim** (mistura métrica das duas marcas) |
| `news_posts` (feed) | global | **sim** |
| `magazine_editions` / `magazine_pages` | global | é conteúdo de Grupo — decisão de produto |
| `portal_institutional_blocks` | global por chave de módulo | **sim** |
| `executive_profiles` | por usuário | global por design |
| `whatsapp_validations` / desbloqueio | por investidor | **sim** (desbloqueio de /f valeria em /s) |

**Conclusão do ponto 7:** replicar somente a interface **não** isola nada. Sessão, desbloqueio, leads, engajamento, feed e blocos institucionais são hoje compartilhados.

## 8. As quatro rotas

| Rota | Arquivo | Contexto criado | Parâmetros | Redirect | Dados preservados |
| --- | --- | --- | --- | --- | --- |
| `/f` | `f.index.tsx` | Portal completo; grava `EntryContext` e limpa a URL | `e, m, o, u, c, b, ch, g` | auto-redirect para `/f` com `search: {}` após gravar contexto | tudo vai para `sessionStorage` antes da limpeza |
| `/f/$slug` | `f.$slug.tsx` | nenhum; só monta contexto | `slug` = executivo | `redirect` para `/f` | `e=slug`, `m=manual`, `o=origem da marca`, `b=financeira` |
| `/s` | `s.index.tsx` | nenhum contexto de portal | `g, o, c` | nenhum | nada — é página institucional com `UnitInterestForm` |
| `/s/$slug` | `s.$slug.tsx` | nenhum | `slug` (ignorado) | `redirect` para `/s` | **nada — o slug do executivo é descartado** |

**Menor alteração para /s virar portal:** um único componente `InvestorPortalHome({ brand })` extraído de `f.index.tsx`; `/f` passa a renderizá-lo com `brand="financeira"` (comportamento idêntico); `/s` ganha uma rota `s.portal` ou substitui `s.index` quando houver conteúdo Solar; `s.$slug` passa a redirecionar preservando `e`/`b=solar` em vez de descartar.

## 9. Dependências ocultas encontradas

- `investor-news-feed.tsx` — parece genérico, **é global**: `listInvestorNews()` não recebe marca.
- `estrutura-overlay.tsx` e `principios-overlay.tsx` — parecem genéricos, têm **galeria e textos fixos da Financeira** e leem blocos institucionais por chave global.
- `gateway-overlay.tsx` — genérico no visual, mas chama `getPortalAdministratorId()` (Administrador do Portal da Financeira) e `getExecutiveBySlug` do diretório único.
- `portal-session.ts` — importa `investorPortalPath` e `getPortalAdministratorId`; grava `brand`, mas nunca filtra por ele.
- `business-unit.ts` — `unitPath()` é **fixado em `/f`** por assinatura de tipo (`/f${P}`); existe `unitPathFor(unit, path)` para as demais, sem tipagem de rota.
- `navigation-environment.ts` — `homePathFor` só reconhece `/f/executivo/home`, `/f` e `/`; não há Home de `/s`.
- `portal-modules.ts` — registro único, sem marca.
- `portal-brands.ts` — já modela as três marcas, mas só com prefixo/nome/origem.

## 10. Proposta mínima de arquitetura

Objetivo: `/f` intocado visual e funcionalmente; `/s` independente; `/seg` congelado.

**Camada 1 — extração neutra (sem mudança de comportamento)**
1. Extrair o corpo de `f.index.tsx` para `src/components/portal/investor-portal-home.tsx`, recebendo um objeto `PortalBrandContent`. `/f` passa a ser um arquivo fino que injeta o conteúdo Financeira atual, literalmente o mesmo. 🟢
2. Criar `src/lib/portal-content/financeira.ts` com o que hoje está hardcoded (head, hero, `MODULES`, footer). Nenhum texto muda. 🟢

**Camada 2 — marca como parâmetro real**
3. `portal-modules.ts` passa a mapear `brandKey → módulos`; `financeira` recebe exatamente a lista atual, `solar` nasce vazia. 🟢
4. `PORTAL_BRANDS` ganha campos opcionais de apresentação (logo, cor de destaque, rótulo). Financeira preenchida com os valores atuais. 🟡

**Camada 3 — isolamento (obrigatório antes de publicar /s)**
5. Namespace por marca nas chaves de `localStorage`/`sessionStorage` da sessão e do contexto de entrada, com leitura de legado para não derrubar sessões vigentes da Financeira. 🟡
6. Marca gravada e **lida** no lead/engajamento (usar coluna existente de `portal_leads`; não criar tabela). 🟡
7. Feed de notícias e blocos institucionais passam a aceitar filtro por marca, com `financeira` como padrão. 🟡

**Camada 4 — rotas Solar**
8. `s.$slug` preserva `e` e `b=solar` em vez de descartar. 🟡
9. `/s` só troca de página institucional para portal quando existir conteúdo Solar próprio. 🟡
10. `homePathFor` reconhece `/s` como Home do Portal Solar. 🟡

**Não tocar agora** 🔴: Simulador (regra de negócio Financeira), Manual e Universo (conteúdo próprio), `/seg`, CRM, Corporate Workspace, GreenSales, motor de relacionamento, Ação do Dia, WhatsApp/Safety Lock.

**Já existe e deve ser preservado** ⚪: `PORTAL_BRANDS`, `business-unit.ts`, `portal-overlay-shell`, motor de sessão/gateway, `portal-access`, registro de assets, `navigation-environment`, `investors`/`investor_identifiers`.

**Resposta direta à sua preocupação central:** hoje um investidor que se identificasse em `/f` apareceria identificado e desbloqueado em `/s` — a sessão, o desbloqueio, o feed e os blocos institucionais são compartilhados. Por isso o item 5 é pré-requisito de publicação do Portal Solar, não um refinamento posterior.

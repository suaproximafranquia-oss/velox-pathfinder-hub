# Auditoria da rota `/` — Grupo Velox + Arquitetura da Landing Institucional

Análise somente leitura. Nenhum código, rota, migration ou dado foi alterado. A imagem anexada foi usada apenas como referência visual (dark navy, acento laranja/dourado, hero com foto da sede, faixa de números, cards das empresas, grade de diferenciais, seção Sobre com missão/visão/valores + timeline e faixa final de números). Ela NÃO será inserida como imagem no site.

## 1. O que já existe na rota `/`

- `src/routes/index.tsx` (~250 linhas, componente `GroupHome`, sem componentes compartilhados):
  - `validateSearch` + `beforeLoad` que **redirecionam para `/f`** quando a URL traz contexto legado (`e`, `m`, `o`, `u`, `c`, `b`, `ch`, `lead`). Deve ser preservado intacto.
  - `head()` próprio com title/description/og:type/twitter:card.
  - Hero textual, 6 cards "o que sustenta a operação", 3 cards de empresas (Financeira → `/f`, Solar → `/s`, Seguros → `/seg`, ambos com `search` institucional `g=grupo`), footer simples.
  - Única âncora existente: `#empresas`. Sem menu superior, sem rolagem suave, sem imagens.
  - Cores hardcoded (`#050b1a`, `#c9a961`), sem tokens semânticos.
- `src/routes/__root.tsx` trata `/`, `/s` e `/seg` como ambiente de grupo: renderiza `<Outlet />` puro, sem o chrome dos portais (EditorialShell, JourneyChrome, WhatsAppFloating, JourneyTracker, AgendaDock, Toaster). Isolamento já garantido pelo root.
- `src/components/site/SiteNav.tsx` existe, tem rolagem suave (`scrollIntoView({behavior:"smooth"})`) e **não é importado por nenhuma rota** — está órfão, pode ser reaproveitado ou servir de base sem risco.

## 2. O que pode ser reaproveitado

- `SiteNav` (órfão): padrão de navegação por âncoras com scroll suave; pode ser adaptado ou usado como referência para um `GroupHeader` local.
- Primitivos editoriais: `BackToTop`, `Reveal`, `Section`, `Photo`, `Timeline` e `src/components/site/v2` (`ChapterCover`, `FeaturePanel`, `StatBand`, `Gallery`, `Pullquote`, `TimelineRail`, `ProductGrid`) — usados apenas por `/universo`, baixo risco de reuso sem alterar contratos.
- `src/lib/assets/registry.ts` + `assetUrl()` com imagens reais já registradas:
  - Logo: `logo-velox`.
  - Sede/fachada (hero da referência): `sede-velox`, `sede-recepcao`, `unidade-fachada`, `unidade-fachada-alternativa`, `unidade-inauguracao`, `encerramento-edificio`.
  - Pessoas/operação: `fundador-mario-sergio`, `fundador-com-consultores`, `diretora-expansao-larissa`, `equipe-expansao`, `treinamento-rede`, `atendimento-consultivo`, `reuniao-colaborativa`, `modelo-home-office`.
  - Mercado/parceiros: `marketplace-parceiros`, `parceiros-instituicoes`, `mercado-distrito-financeiro`.
- Conteúdo institucional já existente no projeto:
  - `src/routes/index.tsx`: textos das 3 empresas e dos 6 pilares (Oportunidade, Consultores, Investimento, Treinamento, Suporte, Reconhecimento) — mapeiam diretamente a grade "Por que o Grupo Velox?" da referência.
  - `src/routes/universo.tsx`: três frentes, "+200 produtos", "+200 parceiros", cobertura nacional; valores Compromisso, Relacionamento, Desenvolvimento Contínuo, Ética, Visão de Longo Prazo.
  - `src/routes/s.index.tsx` e `src/routes/seg.index.tsx`: descrições institucionais de Solar e Seguros.
  - Timeline da referência (2017 Fundação em São José do Rio Preto → Crescimento → Novas Frentes → Hoje) é compatível com o conteúdo do fundador já existente no projeto.

## 3. O que precisará ser criado

- **Composição da landing** na própria rota `/` (substituir internamente o `GroupHome`, mantendo `validateSearch`/`beforeLoad`/`head`):
  - `GroupHeader` fixo com logo + âncoras: **Início**, **Sobre o Grupo**, **Seja um Franqueado** (sem "Fale Conosco", sem "Acessar Portal"). IDs estáveis: `inicio`, `sobre-o-grupo`, `seja-um-franqueado`. "Conheça o Grupo" do hero aponta para `sobre-o-grupo`.
  - `GroupHero`: headline em duas cores, subtexto, CTAs (primário laranja "Seja um Franqueado", secundário outline "Conheça o Grupo"), foto da sede (`sede-velox`/`unidade-fachada`) com overlay navy e faixa de números.
  - `GroupCompanies`: 3 cards com imagem de fundo + overlay, selo/logo, bullets e "Saiba mais" → `/f`, `/s`, `/seg` (mantendo o `search` institucional).
  - `GroupWhy`: grade de 6 diferenciais com ícones (reusa textos atuais).
  - `GroupAbout` (id `sobre-o-grupo`): texto institucional + cards Missão/Visão/Valores + timeline vertical (2017 → Crescimento → Novas Frentes → Hoje). **Missão/visão/valores e números só entram com conteúdo confirmado — nada será inventado.** Valores já existem em `/universo`; missão/visão e números como "+1.400 unidades", "500k+ clientes", "+R$20Bi" **não estão confirmados no projeto** e ficam como placeholders a preencher pelo usuário ou omitidos.
  - `GroupNumbers`: faixa de estatísticas (somente números verificados no projeto; demais aguardam confirmação).
  - `GroupFranchiseCta` (id `seja-um-franqueado`): CTA final; pode acoplar `src/components/group/unit-interest-form.tsx` se captura for desejada nesta etapa.
  - `GroupFooter`.
- Componentes novos ficam em `src/components/group/` (diretório já existente), isolados da landing; nenhum componente compartilhado precisa ser alterado.
- Tokens: manter a paleta da referência (navy profundo, laranja/dourado, branco, cinzas) com classes locais — sem tocar no tema global em `src/styles.css`.
- Fora de escopo nesta etapa: `/financeira`, `/solar`, `/seguradora` (páginas institucionais futuras) e a pendência de nomenclatura `/s` × `/sol` (hoje o portal Solar é `/s`; `/sol` não existe).

## 4. Riscos de impacto em outros ambientes

- **Baixo** se a mudança ficar confinada a `src/routes/index.tsx` + novos componentes em `src/components/group/`: `/f`, `/f/executivo`, CRM, Cadência e Ação do Dia não são tocados.
- **Pontos de atenção:**
  - Preservar obrigatoriamente o redirect legado `/?...→ /f` (compatibilidade de links antigos).
  - Não alterar `__root.tsx`, `styles.css`/tokens globais, `SiteNav` original ou o registry de assets (apenas consumir chaves existentes).
  - Os cards das empresas continuam apontando para os portais `/f`, `/s`, `/seg` — as futuras páginas institucionais `/financeira`, `/solar`, `/seguradora` são rotas novas, sem colisão, a tratar em etapa própria.

## 5. Arquitetura recomendada

```text
src/routes/index.tsx            → mantém route, search validation, redirect legado, head();
                                  componente passa a renderizar <GroupLandingPage/>
src/components/group/
  landing/
    group-landing-page.tsx      → composição das seções
    group-header.tsx            → nav fixo com 3 âncoras + scroll suave
    group-hero.tsx              → hero com sede + stats
    group-companies.tsx         → 3 empresas
    group-why.tsx               → 6 diferenciais
    group-about.tsx             → sobre + missão/visão/valores + timeline
    group-numbers.tsx           → faixa de números
    group-franchise-cta.tsx     → seja um franqueado
    group-footer.tsx
    group-content.ts            → TODO o texto/números centralizados, só conteúdo confirmado
```

- Dados separados de apresentação (`group-content.ts`) facilita correção de números/missão/visão sem tocar em UI.
- Scroll suave via `scrollIntoView({behavior:"smooth"})` (padrão já presente no `SiteNav`), com scroll-spy simples por `IntersectionObserver` local.
- Validação pós-implementação: redirect legado intacto; âncoras/rolagem; responsividade; `/f`, `/f/executivo`, `/s`, `/seg` inalterados; sem migrations, sem banco, sem novos envios.

## Pendentes de decisão do usuário (antes da implementação)

1. Números institucionais da referência (+1.400 unidades, 500k+ clientes, +R$20Bi, 3 frentes) podem ser usados como oficiais? Não existem no projeto hoje.
2. Textos oficiais de Missão e Visão — fornecer ou omitir os cards até haver conteúdo aprovado?
3. A seção "Seja um Franqueado" deve incluir formulário de interesse (`unit-interest-form`) ou apenas CTA?
4. Confirmar nomenclatura futura: portal Solar hoje é `/s`; `/sol` não existe.

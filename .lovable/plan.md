# Diagnóstico — Camada institucional /financeira, /solar, /seguradora

Somente leitura. Nada foi alterado.

## 1. O que existe hoje em cada rota

Verificado em `src/routes/`: **nenhuma das três rotas existe**.

- `/financeira` — não existe arquivo de rota.
- `/solar` — não existe. O que existe é `src/routes/s.index.tsx`, que responde em `/s` e é a página operacional da unidade (identidade curta + `UnitInterestForm`).
- `/seguradora` — não existe. O equivalente atual é `src/routes/seg.index.tsx` em `/seg`, com a mesma estrutura de `/s`.

Os três caminhos já estão previstos como destino futuro em `src/components/group/landing/group-content.ts` (campo `href` de `COMPANIES`), e `group-companies.tsx` renderiza o botão "Saiba mais" como `<span aria-disabled>` justamente porque as páginas ainda não existem.

## 2. Como o conteúdo está estruturado hoje

- A landing do Grupo (`/`) usa um padrão já correto: **conteúdo separado da apresentação**. Todo o texto vive em um único módulo (`group-content.ts`: `HERO`, `NUMBERS`, `COMPANIES`, `WHY`, `ABOUT`, `FRONTS`, `VALUES`, `TIMELINE`, `FOOTER`) e os componentes apenas consomem.
- A composição da página é uma lista fixa de componentes em `group-landing-page.tsx`.
- `/s` e `/seg` têm o texto inline no próprio arquivo de rota (arrays `BULLETS`, parágrafos no JSX).
- Imagens vêm do registro de assets (`assetUrl(...)` de `@/lib/assets/registry`).
- `universo.tsx` (1.883 linhas) contém material institucional rico (frentes, valores, números) que hoje é a principal fonte de texto oficial reaproveitável.

## 3. Componentes já reutilizáveis entre as três páginas

Prontos para uso, sem mudança de comportamento:

- `src/components/group/landing/`: `GroupHeader`, `GroupHero`, `GroupNumbers`, `GroupWhy`, `GroupAbout`, `GroupFooter`, `GroupReveal` (animação de entrada), `GroupCompanies`.
- `src/components/site/v2/`: `ChapterCover`, `EditorialSection`/`Prose`, `FeaturePanel`, `StatBand`, `ProductGrid`, `TimelineRail`, `Gallery`, `Pullquote`, `SectionShell`/`Eyebrow`/`EdgeRule`, `MediaSlot`, `FlowDiagram`, `PortfolioCatalog` — é praticamente um kit de seções editoriais já existente.
- `src/components/group/unit-interest-form.tsx` — captação por unidade (`solar` e `seguros` hoje).

Obstáculo real: esses componentes recebem props **fixas e tipadas**, não um bloco genérico. Para virarem "seções de CMS" precisam de um mapa `tipo de seção → componente`.

## 4. Existe mecanismo de cadastro/edição desse conteúdo?

Não para essas páginas. O conteúdo institucional público é 100% código (`group-content.ts`, `s.index.tsx`, `seg.index.tsx`).

Existe, porém, um **padrão de CMS já implementado e validado no projeto**, que serve de modelo:
- `/f/executivo/institucional` → `src/routes/f.executivo.institucional.tsx`
- servidor: `src/server/magazine.server.ts`, tabela `portal_institutional_blocks` (blocos por módulo, com `position` e mídia)
- funções cliente: `src/lib/magazine.functions.ts`, incluindo upload de arquivo (`uploadMagazineFile`)

Ou seja: já existe editor de blocos ordenáveis com imagem/vídeo — mas ele publica no Portal do Investidor, não nas páginas institucionais do Grupo.

## 5. Arquitetura mais simples para conteúdo editável

Recomendação: **CMS de blocos por marca**, espelhando o padrão de `portal_institutional_blocks`, isolado no ambiente institucional.

Modelo de dados mínimo (duas tabelas):

```text
brand_pages          brand_sections
-----------          --------------
id                   id
slug (financeira|    page_id -> brand_pages
      solar|         type    (hero | stats | features | editorial |
      seguradora)             gallery | timeline | quote | cta ...)
title/meta           position (int)
published (bool)     content  (jsonb: título, texto, bullets, itens)
                     media    (jsonb: urls + alt)
                     published (bool)
```

Regras:
- `content` em JSONB permite tipos de seção diferentes por marca sem migration nova a cada seção.
- Ordem e quantidade livres por marca (`position`).
- Leitura pública via loader da rota com cliente publicável e política `SELECT` para `anon` restrita a `published = true`; escrita apenas por admin autenticado.
- Fallback: se a marca não tiver seções publicadas, a rota renderiza um conteúdo padrão em código (nada de página vazia).

Isso elimina a necessidade de passar texto dentro de comandos: o texto passa a ser digitado em uma tela administrativa.

## 6. Estrutura visual comum com seções variáveis

Um único **renderizador de página** para as três marcas:

```text
/financeira ┐
/solar      ├─► BrandPage(slug) ─► header + <SectionRenderer sections[]> + footer
/seguradora ┘                          │
                                       └─ mapa: type -> componente existente
```

- O invólucro (header, tipografia, grid, footer, tokens de cor) é o mesmo — garante unidade visual do Grupo.
- Cada marca define seu próprio `accent` (dourado/solar/seguros) por token, não por componente novo.
- A diferença entre marcas é apenas a **lista de seções** vinda do banco; o renderizador ignora tipos desconhecidos.

## 7. Cadastro posterior de textos e imagens por seção

- Tela admin (mesmo padrão de `f.executivo.institucional.tsx`): escolher marca → lista de seções ordenáveis → editar campos do tipo escolhido → publicar.
- Imagens: reaproveitar o fluxo de upload já existente (bucket de mídia + URL salva no JSONB `media`), com `alt` obrigatório por acessibilidade e SEO.
- Pré-visualização usando o mesmo `SectionRenderer` da página pública, evitando divergência entre editor e resultado.

## 8. Arquivos/rotas/componentes envolvidos numa futura implementação

Novos:
- `src/routes/financeira.tsx`, `src/routes/solar.tsx`, `src/routes/seguradora.tsx` (cada uma com `head()` própria).
- `src/components/group/brand/brand-page.tsx` e `section-renderer.tsx` + mapa de tipos.
- `src/lib/group/brand-pages.functions.ts` e `src/server/group/brand-pages.server.ts`.
- Rota administrativa institucional (ex.: `src/routes/f.executivo.paginas-institucionais.tsx`) — apenas tela de administração; não altera operação.
- Uma migration aditiva (`brand_pages`, `brand_sections`, GRANTs + RLS).

Alterados (mínimo):
- `src/components/group/landing/group-companies.tsx` — habilitar os botões "Saiba mais" com `Link`.
- `src/components/group/landing/group-content.ts` — `href` já aponta para os destinos corretos; sem mudança de texto.

Não tocados: `/f`, `/s`, `/seg` operacionais, Portal do Investidor, CRM, Cadência, Ação do Dia, Biblioteca, GreenSales, Safety Lock.

## Recomendação

Implementar em duas etapas: (1) as três rotas com o renderizador e conteúdo padrão em código, ativando os botões da landing; (2) a camada editável (tabelas + tela admin), com o código virando apenas fallback. Assim as páginas existem cedo e o CMS entra sem retrabalho visual.

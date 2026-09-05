# Base visual/demo do Portal do Investidor Solar em /s

Diagnóstico. Nada foi alterado. Objetivo desta etapa: `/s` deixar de ser só formulário e passar a apresentar o Portal do Investidor com a mesma base do `/f`, reutilizando referências da Financeira como provisórias. A equalização Solar fica para depois.

## 1. Menor alteração necessária

Uma extração e três arquivos de rota/registro:

1. Mover o corpo de `src/routes/f.index.tsx` (873 linhas) para um componente único `src/components/portal/investor-portal-home.tsx`, que recebe apenas duas coisas: a marca (`brandKey`) e o caminho da própria home (`homePath`).
2. `src/routes/f.index.tsx` vira um arquivo fino: mantém o `head()` atual **palavra por palavra** e renderiza o componente com `brandKey="financeira"` e `homePath="/f"`.
3. Criar `src/routes/s.portal.tsx` (`/s/portal`) renderizando o mesmo componente com `brandKey="solar"` e `homePath="/s/portal"`, com `head()` próprio Solar.

Nada mais é obrigatório para a demo.

## 2. Dá para fazer sem duplicar as 873 linhas?

Sim. Nenhuma linha é copiada: ela muda de arquivo uma única vez. As duas rotas passam a consumir o mesmo componente. O que se duplica é só o `head()` (metadados) e três parâmetros.

## 3. O que seria extraído

| Novo arquivo | Conteúdo |
| --- | --- |
| `src/components/portal/investor-portal-home.tsx` | `PortalHome`, `Hero`, `PortalHeader`, `ModulesGrid`, `ModuleTile`, `ModulePanel`, `PortalFooter`, `ResumeBanner`, array `MODULES`, orquestração de overlays — exatamente como estão hoje |
| (opcional) `src/lib/portal-content/financeira.ts` | textos/capas hoje hardcoded, para facilitar a personalização futura — pode ficar para a etapa 2 |

Os dois ajustes internos mínimos do componente: trocar os literais `to="/f"` e `navigate({ to: "/f" })` pela prop `homePath`, e passar `brandKey` ao gravar o contexto de entrada. Nenhum outro comportamento muda.

## 4. Referências da Financeira reutilizadas provisoriamente pelo /s

Hero e imagem de fundo; os 6 cards de módulo com seus textos e capas; Manual (`/manual`) e Material Institucional (`/universo`) via iframe; Simulador de receita; overlays Estrutura, Revista e Princípios; feed de notícias; Gateway de identificação e confirmação de WhatsApp; sessão do investidor; executivos e Administrador do Portal; regra "só o Manual é livre, os demais exigem WhatsApp"; cores e tipografia globais; footer institucional.

## 5. O que fica preparado para personalizar depois

`brandKey` já viaja pelo contexto de entrada e é gravado na sessão (`brand`) — o gancho existe e não é lido por ninguém hoje. `PORTAL_BRANDS` já modela Solar. `homePath` desacopla a navegação interna. O array `MODULES` fica isolado num único ponto, pronto para virar conteúdo por marca. Os overlays já recebem título e dados por parâmetro.

## 6. Risco de quebrar o /f

Baixo e controlável, com uma ressalva honesta: é uma extração grande, e extrações grandes erram por descuido, não por arquitetura. Mitigação: mover o código sem reescrever, manter o `head()` e o array `MODULES` idênticos, e conferir `/f` visualmente e por HTTP depois. Não há mudança de rota, de sessão, de dados nem de motor — se `/f` renderizar igual, está igual.

**Risco real que existe:** a sessão do investidor é uma chave única de `localStorage`, sem marca. Nesta demo, quem se identificou em `/f` chegará ao `/s` já identificado e desbloqueado. Para uma demonstração isso é aceitável; **não é aceitável em produção pública** e precisa entrar na etapa 2.

## 7. Risco de perder o formulário institucional do /s

Existe se `s.index.tsx` for substituído. A troca segura é não substituir:

- `/s` continua exatamente como está (institucional + `UnitInterestForm`);
- o portal nasce em `/s/portal`, rota nova, sem tocar em nada existente;
- quando a Solar estiver equalizada, decide-se se `/s` passa a ser o portal e o institucional migra para `/s/institucional`.

Assim nenhuma URL publicada quebra e nenhum formulário é perdido.

## 8. Quantidade mínima de arquivos

Três: um criado (`investor-portal-home.tsx`), um esvaziado (`f.index.tsx`) e um criado (`s.portal.tsx`). Opcionalmente um quarto, `s.$slug.tsx`, se você quiser que o link de executivo Solar leve ao portal em vez de à página institucional — hoje ele descarta o slug.

## 9. Deliberadamente adiado para a equalização Solar

Isolamento de sessão e desbloqueio por marca; leads, engajamento e jornada por marca; executivos, gestor e administrador Solar; conteúdo próprio (Manual, Material, Estrutura, Princípios, Revista); simulador com o modelo de negócio Solar; feed de notícias por marca; identidade visual (logo, cores, favicon) por marca; WhatsApp, automações, CRM e Corporate Workspace Solar; decisão sobre `/s` virar a home do portal.

## Classificação

**🟢 Implementar agora**
- Extrair `investor-portal-home.tsx` a partir de `f.index.tsx`, sem reescrever conteúdo.
- Reduzir `f.index.tsx` a rota fina com o `head()` atual intacto.
- Criar `/s/portal` com `head()` Solar próprio, consumindo o mesmo componente.
- Parametrizar apenas `homePath` e `brandKey`.

**🟡 Deixar preparado**
- `brandKey` gravado no contexto e na sessão, ainda sem filtro.
- Array `MODULES` isolado, pronto para virar conteúdo por marca.
- `PORTAL_BRANDS` com espaço para logo/cor/rótulo.
- `s.$slug` preservando executivo e marca.
- `homePathFor` reconhecer a home do Portal Solar.

**🔴 Não tocar**
- Conteúdo e comportamento da Financeira, `/seg`, Corporate Workspace, CRM, GreenSales, motor de relacionamento, Ação do Dia, WhatsApp e Safety Lock. Nenhuma migration.

**⚪ Preservar**
- `/s` institucional e o `UnitInterestForm`; motor de sessão e Gateway; overlays e `portal-overlay-shell`; registro de assets; `portal-modules.ts`; `business-unit.ts` e `portal-brands.ts`; todas as URLs publicadas hoje.

**Alerta único a registrar antes de publicar:** enquanto a sessão não for isolada por marca, `/s/portal` é uma demonstração interna, não um portal público independente.

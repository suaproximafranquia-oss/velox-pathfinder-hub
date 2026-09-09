# Diagnóstico — Portal do Investidor /f: destino do card e modo Editor de imagens

Somente leitura. Nada foi alterado.

## Parte 1 — Destino do card "Portal do Investidor"

Situação atual confirmada:

- O card está definido em `src/config/modules.ts` (item `id: "manual"`, nome "Portal do Investidor") com `href: "/"` e `external: true`.
- Quem renderiza é `src/routes/f.executivo.home.tsx` (`ModuleCardBody`): quando há `href` e `external`, abre um `<a target="_blank">`.
- `"/"` é a landing institucional do Grupo (`src/routes/index.tsx`, três marcas) — por isso o clique leva ao ambiente multimarcas.
- `/f` já é rota válida e funcional do Portal do Investidor da Financeira: `src/routes/f.index.tsx` → `InvestorPortalHome` com `brandKey="financeira"` e `homePath="/f"`.
- Não existe URL absoluta/externa fixa: é um caminho relativo.

Alteração mínima futura: trocar o destino do card para `/f` (via `unitPath("/")`, o helper oficial de `src/lib/business-unit.ts`), mantendo `external: true` se quiser continuar abrindo em nova aba. Nenhum outro ambiente é afetado, porque o card só existe na Home da Financeira.

## Parte 2 — Dois modos administrativos (Navegador e Editor)

### Como o Portal está estruturado hoje

- Base única: `src/components/portal/investor-portal-home.tsx`, consumida por `/f` e `/s/portal`. Módulos são cards (`MODULES`) abertos como overlays sobre a Home.
- Overlays institucionais: `estrutura-overlay.tsx`, `principios-overlay.tsx`, `magazine-overlay.tsx`.

### Como as imagens estão armazenadas

Existem hoje dois mundos diferentes:

1. Imagens fixas do Portal (hero e capas dos cards) — declaradas em `src/lib/assets/registry.ts` com chave semântica estável, por exemplo `portal-hero-sede`, `portal-capa-manual`, `portal-capa-material-institucional`, `portal-capa-sede`, `portal-capa-revista`, `portal-capa-experiencias`, `portal-capa-simulador`. Cada chave aponta para um arquivo no CDN da plataforma (`*.asset.json`). Isso é um manifesto estático: não é editável em runtime.
2. Conteúdo administrável (Revista e blocos institucionais) — já vive no armazenamento do backend, com referência `storage://caminho` e URL assinada de 6 h, resolvida em `src/server/magazine.server.ts`.

Ou seja: já existe identificação estável por imagem (a chave do registro) e já existe upload/armazenamento reutilizável (`uploadMagazineMedia` no servidor e `uploadMagazineFile` como função de servidor autenticada). Não é preciso criar um sistema paralelo de mídia.

### Como o administrador é identificado

- Permissão vem de `user_roles`/`has_role`, lido em `src/server/authorization.server.ts` (`readAdministrativeAccess`, `assertAdministrativeAccess`).
- Na interface, `useWorkspaceAuthorization` e a sessão do Workspace (`src/lib/executive-auth.ts`) já distinguem administrador.
- O upload da Revista é protegido por `assertWorkspaceAccess(..., "revista")`.

### Existe algum modo de edição reutilizável?

Não dentro do Portal. Hoje a edição acontece em telas separadas do Workspace (`/f/executivo/institucional`, `/f/executivo/revista`). O Portal em si é somente leitura. Então o modo Editor é novo, mas pode ser apenas uma camada de estado sobre o mesmo Portal.

### Resposta às perguntas de viabilidade

- Navegador e Editor podem usar exatamente o mesmo Portal: muda só um sinalizador de modo, validado no servidor pela permissão administrativa. Nada de segundo Portal.
- Manter alteração em estado de edição até o "Salvar": a substituição fica só na memória da página (pré-visualização local do arquivo escolhido); o envio ao armazenamento e a gravação da chave só acontecem no "Salvar".
- Dá para restringir tudo à Financeira `/f`: o modo só é habilitado na rota `/f` e a chave gravada carrega a unidade.

## Forma mais simples e segura de implementar depois

1. Uma tabela pequena de substituições: chave da imagem (a mesma do registro) + caminho no armazenamento + unidade + autor/data. Leitura pública apenas do par chave→imagem vigente; escrita só para administrador.
2. `assetUrl()` continua sendo o padrão; o Portal passa a consultar, uma vez por carregamento, o mapa de substituições e usa a imagem substituída quando existir. Sem substituição, tudo permanece exatamente como está hoje.
3. Reaproveitar o upload já existente (mesmo armazenamento da Revista), sem criar bucket novo.
4. Modo do Portal: `?modo=editor` em `/f`, liberado apenas após checagem de permissão administrativa no servidor. Navegador é o comportamento atual, sem nenhum controle visível.
5. No modo Editor, cada ponto de imagem ganha dois comandos (Excluir / Substituir) e a página ganha um único "Salvar", que confirma todas as trocas pendentes. Excluir volta a imagem original do registro.

## Escopo preservado

Manual do Investidor, `/s`, `/s/portal`, `/seg`, cadência, GreenSales e Biblioteca ficam fora. Nenhuma imagem atual é alterada; a substituição é sempre uma camada por cima, reversível.

## Próximo passo

Este documento é apenas o diagnóstico. A construção (destino do card + modo Editor) só começa se você aprovar.

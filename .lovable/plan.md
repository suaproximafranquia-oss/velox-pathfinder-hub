# Diagnóstico — rota /s/portal (Portal Solar)

## Resultado da verificação (somente leitura)

🟡 **A rota existe no código e no preview, mas NÃO está na versão publicada.**

### Evidências

1. **Arquivo de rota existe:** `src/routes/s.portal.tsx` — nome compatível com a convenção do TanStack Router (ponto vira barra: `s.portal.tsx` → `/s/portal`, com `createFileRoute("/s/portal")` correto).
2. **Registrada no routeTree.gen.ts:** a rota aparece como `/s/portal` (import `SPortalRouteImport`, id `/s/portal`, path `/s/portal`, fullPath `/s/portal`). Nenhum problema de convenção ou de registro.
3. **Preview (sandbox atual):** `http://localhost:8080/s/portal` responde **HTTP 200** — a rota funciona e tem prioridade correta sobre `/s/$slug`.
4. **Site publicado:** `https://velox-pathfinder-hub.lovable.app/s/portal` responde **HTTP 307 com `location: /s`** — ou seja, na build publicada, `/s/portal` ainda está caindo na rota antiga `/s/$slug` (com `slug = "portal"`), que redireciona para `/s` (comportamento legado de `s.$slug.tsx`).

### Causa exata

O site publicado está servindo uma **build anterior à criação da rota**. A publicação atual não contém `s.portal.tsx`, então `/s/portal` casa com o catch-all `/s/$slug` e é redirecionada para `/s`. Não existe nenhum redirect, guard ou fallback novo impedindo a rota — é apenas a versão publicada desatualizada.

## Menor ajuste necessário

**Republicar o projeto.** Nenhuma alteração de código é necessária. Ao republicar, a build atual (que já contém `/s/portal` registrada e funcionando) passa a ser servida, e:

- `/s/portal` → Portal do Investidor Solar (nova base visual/demo);
- `/s` → página institucional Solar (preservada, intacta);
- `/s/$slug` → continua redirecionando slugs de executivo para `/s`, sem conflito (rota estática tem prioridade sobre a dinâmica).

## Confirmações de preservação

- `/s`, `/seg` e `/f`: nenhuma alteração necessária ou proposta.
- Nenhuma migration, nenhuma mudança de comportamento, nenhum código novo nesta etapa.

## Ação proposta

1. Republicar o app (publicar a versão atual do preview).
2. Após publicar, validar que `https://velox-pathfinder-hub.lovable.app/s/portal` retorna 200 e exibe o Portal Solar, e que `/s` continua institucional.

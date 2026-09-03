# Navegação por ambiente — Home contextual, menu do Workspace

Correção apenas de navegação. Nada de E0, banco, migration, cadência, Safety Lock ou novas rotas.

## Princípio

O ambiente atual determina o destino do Home:

```text
Workspace              -> /f/executivo/home
Portal do Investidor   -> /f          (solução na estrutura atual)
Institucional (Grupo)  -> /
```

O Portal do Investidor continua sendo, conceitualmente, um ambiente independente. Usar `/f` agora é apenas a resolução dentro da arquitetura existente; nenhuma rota nova é criada nesta etapa.

Regra: nenhum componente aponta `"/"` como Home sem verificar o contexto.

## O que muda

1. **Helper de ambiente** — adicionar em `src/lib/business-unit.ts` uma função `homePathFor(pathname)` que retorna:
   - `/f/executivo/home` para caminhos operacionais do executivo;
   - `/f` para a jornada do investidor (Manual, módulos editoriais, convite);
   - `/` apenas para o institucional (raiz, Solar, Seguros).
   Sem alterar as funções existentes (`unitPath`, `currentUnit`, `isOperationalPath`).

2. **Logo/Home do Portal do Investidor passam a apontar para `/f`**
   - `src/routes/f.index.tsx` — logo "Portal Velox" do header.
   - `src/components/editorial/module-chrome.tsx` — logo "Início".
   - `src/components/journey/journey-chrome.tsx` — logo "Início do Manual".
   - `src/routes/manual/concluido.tsx` — botão de retorno.

3. **Card "Portal do Investidor" na Home do Workspace** — `src/config/modules.ts`: destino passa de `/` para `/f` (continua abrindo em nova aba).

4. **Tela de acesso do Workspace** — `src/routes/f.executivo.index.tsx`: o botão "Voltar ao Portal Velox" passa a apontar para `/f`.

5. **Sem link institucional dentro do Portal do Investidor** — nenhum link para `/` permanece no ambiente do investidor (nem no rodapé). As páginas institucionais Solar e Seguros mantêm o retorno para `/`, pois pertencem ao ambiente institucional.

6. **Remover "Unidades do Grupo" do menu `/f`** — `src/components/executive/executive-shell.tsx`, grupo `relationship`. A rota `/f/executivo/unidades`, o formulário público de interesse, os dados e o backup permanecem intactos; apenas o item de menu operacional da Financeira sai.

7. **Fallback de erro/404** — `src/routes/__root.tsx`: o botão "Go home" passa a usar o helper contextual em vez de `/` fixo.

## O que não muda

- Apresentação Digital (`/f/executivo/apresentacao-digital` e `/portal/convite/$token`) — funcional, sem alteração.
- Home do Workspace `/f/executivo/home` — já correta.
- E0, permissões, CRM, cadência, GreenSales, Safety Lock, banco, migrations.
- Nenhuma rota criada, renomeada ou removida.

## Arquivos afetados

`src/lib/business-unit.ts`, `src/config/modules.ts`, `src/routes/f.index.tsx`, `src/routes/f.executivo.index.tsx`, `src/routes/manual/concluido.tsx`, `src/routes/__root.tsx`, `src/components/editorial/module-chrome.tsx`, `src/components/journey/journey-chrome.tsx`, `src/components/executive/executive-shell.tsx`.

## Validação

Typecheck e build; conferir que Home no Workspace vai para `/f/executivo/home`, que logo e retornos do investidor vão para `/f`, que "Unidades do Grupo" não aparece mais no menu `/f` e que a rota continua acessível por URL direta.

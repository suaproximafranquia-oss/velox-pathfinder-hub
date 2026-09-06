# Diagnóstico — Escopo do KPI Manager e do Painel de Campanhas (/f)

Investigação somente de leitura. Nenhum arquivo, dado, permissão ou regra foi alterado.

## 1. Causa técnica encontrada

São três causas independentes, e juntas explicam todos os sintomas relatados.

**Causa 1 — A lista de pessoas é lida com a permissão do próprio usuário, e essa permissão só permite ler a própria ficha.**
A regra de leitura da tabela de fichas dos executivos autoriza: administrador vê todos; qualquer outro perfil vê apenas a própria ficha. Tanto o KPI quanto o Painel de Campanhas montam a lista de executivos lendo essa tabela com a permissão do usuário logado. Resultado: Marton (colaborador) e Larissa (gestora) recebem uma lista com uma única pessoa — eles mesmos. O administrador é o único que recebe a lista completa. Isso explica exatamente por que Marton via todos antes e passou a ver só a própria operação.

**Causa 2 — Quase toda a equipe está marcada como inativa no cadastro.**
Situação atual gravada: ativos apenas Marton e Thiago. Inativos: Larissa, Milton, Paulo, Carlos e Talita. Os dois módulos filtram por "ativo", então mesmo o administrador, que enxerga a lista inteira, só recebe duas pessoas. É isso que faz Thiago achar que "não vê todos" no KPI.

**Causa 3 — Os números de KPI/Campanha ficam guardados no navegador de cada pessoa, não no banco.**
Os lançamentos do KPI são gravados localmente na máquina de quem lançou. Portanto, mesmo com a lista correta, o administrador vê zero para os colegas: os números do Marton existem só no navegador do Marton. O Painel de Campanhas consome exatamente a mesma fonte, então o ranking também é sempre "local".

## 2. Arquivos e funções envolvidos

- `src/lib/kpi-scope.functions.ts` (`resolverEscopoKpi`) — decide quem aparece no KPI; lê fichas e situação com a permissão do usuário e cruza com a lista operacional fixa.
- `src/server/identity.server.ts` (`resolveServerIdentity`) — define o papel (admin / manager / user) a partir das permissões gravadas. Está correto: Thiago = admin, Larissa = manager, demais = user.
- `src/lib/teams.ts` (`OPERATIONAL_EXECUTIVE_IDS`) — lista operacional fixa usada pelos dois módulos.
- `src/routes/f.executivo.campanhas.tsx` — monta a lista do Painel de Campanhas: cruza a lista operacional fixa com o diretório lido do servidor; se a leitura falhar, cai para lista vazia.
- `src/lib/executive-directory.functions.ts` (`listarDiretorioExecutivos`) — leitura do diretório com a permissão do usuário (ponto onde o recorte encolhe).
- `src/components/executive/kpi/painel-campanhas.tsx` e `src/lib/kpi-manager.ts` — origem dos números (armazenamento local do navegador).
- Regras de leitura no banco: fichas dos executivos (admin vê tudo, demais só a própria) e situação ativo/inativo (leitura ampla).

## 3. Diferença entre os caminhos de Marton, Larissa e Thiago

```text
                 papel      lista de fichas recebida     ativos aplicados     resultado hoje
Marton           user       só a própria ficha           só ele               vê só a si
Larissa          manager    só a própria ficha           nenhum (ela inativa) vê equipe vazia
Thiago           admin      todas as fichas              Marton + Thiago      vê 2 pessoas
```

Divergência frente à regra de negócio:

- KPI — colaborador: correto (próprio). Gestora: incorreto (deveria ver a equipe, recebe lista vazia). Administrador: incorreto por dado (equipe reduzida a 2 por causa dos inativos) e sem números dos colegas.
- Campanhas — colaborador e gestora: incorreto (deveriam ver todos os ativos, veem só a si). Administrador: parcialmente correto, limitado pelos inativos e pelos números locais.

## 4. Correção mínima recomendada (para aplicar depois, mediante aprovação)

1. **Lista de pessoas vinda de uma leitura autorizada no servidor.** Fazer o KPI e o Painel de Campanhas montarem a lista de executivos por uma leitura server-side com privilégio, devolvendo apenas nome, identificador e situação — sem expor dado sensível. Isso corrige Marton e Larissa sem mexer em regras de permissão do banco.
2. **Escopo por módulo, explícito.** KPI: colaborador → só ele; gestora e administrador → equipe. Campanhas: sempre a equipe ativa completa, para os três perfis. Hoje os dois módulos usam o mesmo recorte individual.
3. **Revisar a situação ativo/inativo do cadastro.** Decisão do negócio: se Larissa, Milton, Paulo, Carlos e Talita devem aparecer, precisam voltar a "ativo" na Gestão de Usuários. Nenhum código resolve isso.
4. **Números compartilhados (etapa maior, separada).** Enquanto os lançamentos do KPI viverem no navegador de cada pessoa, nenhuma visão consolidada será real. Para equipe e ranking verdadeiros, os lançamentos precisam ser gravados no banco. Recomendo tratar isso como um comando próprio, depois dos itens 1 a 3.

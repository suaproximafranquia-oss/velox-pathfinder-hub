# Central dos Nomes — diagnóstico do lote e correção mínima

## O que foi verificado (somente leitura)

A tabela da Central existe e está **vazia: 0 nomes, nenhuma data de criação**. Ou seja, o lote não chegou a ser gravado — nem parcialmente.

## Respostas

1. **Não há lotes.** A tela envia o texto colado inteiro numa única chamada (`name-central-panel.tsx`, `handleAdd`, linha ~56). O "500" que existe no servidor é apenas o tamanho interno de cada consulta/gravação dentro da mesma chamada única.
2. O botão chama `adicionarNomesCentral` (`src/lib/relationship/name-central.functions.ts`, linhas 26-36), que executa `addCentralNames` (`src/server/relationship/name-central.server.ts`, linhas 48-94).
3. **Não chegou.** A tabela está zerada, sem nenhum registro nem horário de gravação.
4. Sim. Com ~100 mil nomes, a mesma chamada precisa fazer ~200 consultas de verificação + ~200 gravações + uma releitura completa da lista, tudo em uma requisição só. O ambiente de execução corta a requisição bem antes disso (tempo/CPU por requisição), e o navegador ficou "processando" até a conexão cair. Também há o limite prático de tamanho do corpo enviado.
5. Em tese o que já foi gravado ficaria salvo (cada bloco é gravado separadamente, não há transação única). Como a tabela está vazia, o corte aconteceu **antes** da primeira gravação — provavelmente ainda na fase de verificação de duplicados (linhas 62-71), que é a parte mais lenta.
6. Sim, o contador vem do servidor: é o tamanho da lista devolvida por `listCentralNames`. Ele mostra 0 porque o banco realmente tem 0.
7. A lista dos cards também vem do servidor a cada operação (`listarNomesCentral`), com teto de 20.000 registros na leitura (linha 31) — isso já seria um problema numa base de 100 mil.
8. **Não foi aplicada.** Não existe envio progressivo, barra de progresso, nem inserção incremental. A versão atual foi feita para volumes pequenos/médios.
9. O "Upload Word" **nunca foi construído** — não existe nenhum código de leitura de arquivo na Central. Só há a caixa de colagem.

## Correção mínima proposta (item 10)

Sem mexer em motor, cadência, CRM ou outros ambientes:

1. **Fatiar no navegador**: a tela quebra o texto colado em blocos de ~2.000 nomes e envia um bloco por vez, em sequência, mostrando "processando X de Y" e somando os resultados. Cada chamada passa a durar segundos, nunca minutos.
2. **Simplificar o servidor**: remover a fase de verificação prévia de duplicados e deixar o próprio banco resolver (já existe índice único). Grava-se o bloco ignorando repetidos e conta-se quantos entraram. Isso corta metade das idas ao banco.
3. **Não reler a lista inteira a cada bloco**: a inclusão devolve apenas os números (adicionados/já existentes); a lista é recarregada uma única vez ao final.
4. **Contador e listagem para base grande**: o contador passa a ser uma contagem direta no banco (sem trazer as linhas) e a listagem passa a ser paginada/limitada por busca, em vez do teto fixo de 20.000.
5. **Progresso visível**: os cards já carregados são exibidos e o total sobe conforme os blocos terminam.

Opcional, se desejado depois: botão "Upload Word/TXT/CSV", que apenas extrai o texto do arquivo no navegador e alimenta o mesmo caminho em blocos.

## Detalhes técnicos

- Arquivos envolvidos: `src/components/executive/name-central-panel.tsx` (envio único), `src/server/relationship/name-central.server.ts` (`addCentralNames` linhas 48-94, `listCentralNames` linhas 26-39), `src/lib/relationship/name-central.functions.ts` (assinatura das funções).
- Nenhuma migration é necessária: o índice único `name_central_normalized_key_uidx` já garante a deduplicação.
- Nada é alterado no motor de relacionamento, E0, Ação do Dia, Biblioteca ou demais ambientes.

# Investigação read-only — possível avanço E1 → E2

## Objetivo e limites

Reconstruir, sem qualquer alteração, se uma E2 pode nascer no motor atual apenas pelo prazo e pelo estágio `zero_contato`, sem conclusão válida da E1, e explicar os casos de Nicolas De Andrade, Carlos e Guilherme Ferreira Klippel com evidências persistidas.

- Somente leitura de código e consultas `SELECT`.
- Nenhum tick, reconciliação, função operacional, reprocessamento, teste que grave dados, correção, migração, publicação ou deploy.
- Separar explicitamente: **comprovado**, **tecnicamente possível**, **não determinável** e **hipótese mais consistente**.
- Um HAR será tratado apenas como fotografia parcial da interface, nunca como histórico completo.

## Estado inicial já confirmado

- Os três registros-alvo foram identificados sem ambiguidade: Nicolas De Andrade (`gs_59388`), Guilherme Ferreira Klippel (`gs_59344`) e o Carlos recente em `zero_contato` (`gs_59464`). Existe outro Carlos (`gs_59340`) em estágio comercial diferente, que será mantido fora do caso principal e citado para evitar mistura de identidades.
- A decisão vigente passa por `loadCadenceV2State()` → `decideNextAction()` → `decideCadenceV2()` → materialização em `relationship_queue`.
- No código atual, `decideCadenceV2()` só atravessa uma etapa quando todas as ações previstas estão `EXECUTED` ou `CANCELLED`, ou quando a etapa consta em `relationship_cadences.executed_steps` sem linhas de fila. Portanto, `zero_contato` sozinho não aparece como prova suficiente; falta verificar se cancelamentos, histórico consolidado ou dados antigos podem satisfazer essa condição nos casos reais.

## Investigação

### 1. Reconstruir o caminho E1/E2 ponta a ponta

- Mapear as funções que criam a decisão, gravam a obrigação, atualizam o ciclo e expõem a fila na Ação do Dia.
- Registrar exatamente quais campos são usados: estágio, fluxo, `executed_steps`, ações internas, status, `executed_at`, `cancel_reason`, `due_at`, `theoretical_date`, versão do fluxo e estado do ciclo.
- Confirmar quando E1/E2 nasce por conclusão imediata, por tick/reconciliação ou por rematerialização.
- Verificar se uma falha de materialização é visível, silenciosa ou recuperável em execução posterior.

### 2. Testar tecnicamente o cenário “E1 ausente → prazo → E2”

- Avaliar separadamente E1 sem linhas, E1 parcial, E1 `PENDING`, `PROCESSING`, `FAILED`, `CANCELLED` legítima, cancelada por neutralização e E1 presente apenas em `executed_steps`.
- Determinar se o calendário apenas agenda a etapa já liberada ou se consegue pular uma predecessora incompleta.
- Distinguir comportamento atual do motor V2, caminho legado e possíveis estados históricos inconsistentes.

### 3. Auditar mecanismos históricos

- Localizar upserts, proteção de `PROCESSING`/`EXECUTED`, rematerialização de `PENDING`/`CANCELLED`, neutralizações, mudanças de vencimento, versões congeladas, marco de ativação, resets e reconstrução de `executed_steps`.
- Para cada mecanismo, informar se ele pode: ocultar E1 da interface; alterar sua data; cancelá-la; recriá-la; marcar a etapa como realizada por histórico; ou permitir E2 sem execução válida.
- Não atribuir causalidade a uma mudança histórica sem registro que ligue o mecanismo ao lead analisado.

### 4. Reconstruir os três leads

Para `gs_59388`, `gs_59464` e `gs_59344`, cruzar:

- entrada, `entry_count`, estágio e identidade;
- todas as instâncias de `relationship_cadences`, inclusive inativas;
- todas as linhas E0/E1/E2 da `relationship_queue`, sem limitar aos estados atuais;
- eventos, decisões, jornada, ações E0, timeline e tarefas legadas aplicáveis;
- ordem temporal de `created_at`, `updated_at`, `due_at`, `theoretical_date`, `executed_at`, status, resultados, cancelamentos e chaves de ação/evento.

Responder individualmente A–J, indicando quando a evidência prova execução, cancelamento, recálculo, ordem de criação ou deixa uma lacuna.

### 5. Comparar interface/HAR com o histórico real

- Explicar por que uma E1 executada, cancelada, futura, filtrada ou já removida da fotografia atual pode não aparecer no HAR.
- Classificar cada lead no cenário A (E1 existiu/executou, mas não apareceu na captura) ou B (E2 nasceu sem E1 executada), somente se os registros sustentarem a conclusão.

## Relatório final

1. Resposta direta às duas perguntas centrais.
2. Fluxo real: lead/estágio → ciclo → planejador → materialização/reconciliação → fila → Ação do Dia.
3. Como E1 é criada e como E2 é criada.
4. Avaliação de cada possibilidade de falha ou perda de E1.
5. Linha do tempo e respostas A–J para Nicolas, Carlos e Guilherme.
6. Diferença entre ausência no HAR e ausência real de execução.
7. Quatro blocos finais: **comprovado**, **tecnicamente possível**, **não determinável** e **hipótese mais consistente**.

## Critério de conclusão

A investigação só será encerrada após reconciliar, para cada lead, ciclo, fila, eventos e decisões disponíveis, sem inferir execução pela simples existência da etapa seguinte e sem apresentar ausência de registro como prova automática de que um evento nunca ocorreu.
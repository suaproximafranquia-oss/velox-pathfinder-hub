# Correção — um único card blindado na Ação do Dia

## Objetivo
Separar o card efetivamente ativo na tela dos registros que apenas permanecem `PROCESSING`, garantindo uma única blindagem máxima sem modificar estados, histórico, cadência ou polling.

## Implementação
- Manter a informação de `PROCESSING` disponível para os fluxos que dependem dela, mas deixar de convertê-la automaticamente em prioridade máxima para todos os itens.
- Fazer a tela informar, nas releituras, a `actionKey` do único card atualmente ativo.
- Reordenar cada fotografia usando essa chave como única blindagem; se ela não existir mais, selecionar naturalmente a primeira ação pela hierarquia oficial.
- No primeiro carregamento ou reload, sem atendimento ativo herdado da interface, ordenar todos os registros pela hierarquia normal e promover somente o primeiro card efetivamente apresentado.
- Preservar o card ativo durante releituras silenciosas e permitir que compromissos, avisos, E0 e RE0 novos ocupem imediatamente as posições seguintes.
- Manter os 60 segundos, reconciliação, claims e transições `PENDING`/`PROCESSING`/`EXECUTED` intactos.

## Hierarquia aplicada
1. Único card ativo informado pela interface.
2. Agendamento ou compromisso prioritário.
3. Aviso operacional do Portal.
4. E0 ou RE0.
5. Ações atrasadas.
6. Demais ações normais.

## Segurança e consistência
- A chave ativa só poderá blindar uma ação que ainda exista na fotografia oficial e pertença à fila autorizada do executivo.
- As operações continuarão validadas pelo servidor contra a fotografia oficial; nenhuma ação será apagada, cancelada ou marcada como executada pela correção.
- Reload não herdará blindagem apenas do status `PROCESSING`; a hierarquia será reconstruída da fotografia atual.

## Testes focados
- Um único atendimento ativo permanece primeiro.
- Vários `PROCESSING` persistidos não recebem blindagem coletiva.
- E0 novo fica logo após o ativo e ocupa a primeira posição elegível quando não há ativo.
- Agendamento e aviso novos ficam abaixo do ativo e acima das demais ações.
- Releitura e reload preservam a mesma hierarquia.
- Estados e histórico não são alterados nem convertidos.
- Regressões existentes de claim, continuidade, E0/RE0, reunião urgente e ações normais permanecem aprovadas.

## Validação
Executar testes focados, verificação de tipos, compilação automática e Preview autenticado. Não publicar nem implantar.

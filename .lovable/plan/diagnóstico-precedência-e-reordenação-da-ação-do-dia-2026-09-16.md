# Diagnóstico — precedência e reordenação da Ação do Dia

## Objetivo
Entregar somente a explicação do comportamento atual, sem alterar código, banco, leads, fila, estados, testes ou publicação.

## Verificações confirmadas
- Conferir no HAR disponível a fotografia recebida pela tela e confrontá-la com o estado vigente da fila.
- Separar “card realmente aberto” de `PROCESSING` persistido e explicar como cada um vira `claimed` na lista.
- Documentar a hierarquia efetivamente aplicada hoje: itens reivindicados, compromissos em foco, avisos, E0/RE0, atrasadas, ações normais e compromissos futuros.
- Explicar o desempate entre vários itens da mesma classe e o efeito temporário da continuidade do mesmo lead.
- Confirmar como a releitura de 60 segundos substitui e reordena a fotografia da fila sem F5.

## Caso Tiago Nunes / Mislem / Cleberson
- Registrar que os três E0 estão materializados e `PENDING` para 16/09.
- Registrar que existem 13 E1 simultaneamente em `PROCESSING`, todos atribuídos a `usr_thiago`.
- Determinar se a implementação protege somente um atendimento real ou promove todos os registros `PROCESSING` acima dos E0.
- Escolher exatamente uma alternativa entre A, B, C ou D com base no código e no estado atual.

## Entrega
Responder diretamente aos nove pontos solicitados, distinguindo:
1. regra operacional desejada;
2. hierarquia real implementada;
3. estado persistido versus card efetivamente aberto;
4. entrada dinâmica de E0, compromisso e aviso;
5. reordenação automática e necessidade de F5;
6. coerência ou divergência entre a implementação atual e a prioridade descrita.

## Restrições
Diagnóstico estritamente somente leitura. Nenhuma correção, migração, teste, alteração de dados, deploy ou publicação.

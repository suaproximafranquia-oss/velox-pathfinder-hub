# Pré-gatilho na Ação do Dia (/f) — análise de viabilidade

Somente análise. Nenhum código foi alterado.

## 1. É tecnicamente possível?

Sim, com uma condição: o pré-gatilho tem de ser **exclusivamente leitura/cálculo em memória**. Hoje toda a gravação acontece em um único ponto (`registerQueueCallOutcome`), disparado apenas pelo "Concluído". Enquanto o pré-gatilho não escrever nada e não avançar o motor, ele não toca em nenhuma regra da cadência.

O que hoje consome tempo depois do "Concluído" são três etapas em série:

1. registro do desfecho na fila (escrita curta);
2. avanço do motor para o mesmo investidor (`tick`), que cria a próxima obrigação;
3. releitura da fila oficial para devolver a próxima ação.

Apenas a etapa 3 (e parte do preparo da etapa 2) pode ser antecipada. A etapa 2 é escrita e **não pode** ser antecipada sem criar ação fantasma.

## 2. Onde o pré-gatilho entraria

- No card da ação, no momento em que o executivo escolhe "Atendeu" / "Não atendeu" (o estado intermediário que já existe antes do botão "Concluído"). Esse é o único gatilho necessário — nenhum outro ponto do fluxo precisa mudar.
- No servidor, uma função nova **somente de leitura**, paralela à atual, que recebe o item da fila e o resultado escolhido e devolve uma previsão. Ela não entra no caminho de conclusão; é descartável.
- No overlay da Ação do Dia, um cache curto por chave (investidor + ação + resultado escolhido). Trocar a decisão invalida a chave e recalcula; sair do card descarta.

## 3. O que pode ser preparado sem efetivar

- Previsão da próxima obrigação do mesmo investidor, calculada em memória pelo módulo puro da régua (mesma lógica que o motor usaria), sem gravar.
- Texto oficial da Biblioteca correspondente à etapa/consequência prevista, já resolvido e pronto para copiar.
- Fila oficial atual já lida e ordenada, sem o item que está sendo concluído, junto com nome, telefone e rótulos do próximo investidor.
- Aquecimento dos módulos de servidor carregados sob demanda no caminho de conclusão.

O que **não** pode ser preparado: criar linha na fila, marcar reivindicação, avançar o motor, registrar histórico ou qualquer marca de execução.

## 4. Riscos

- Duplicação: nula enquanto for leitura. Se algum dia o pré-gatilho gravar a obrigação prevista, ela colidiria com a criada pelo motor no "Concluído" — cenário a evitar por completo.
- Ação fantasma: só ocorreria se a previsão fosse exibida como item real da fila. A previsão deve ficar em cache invisível e só ser aplicada depois que o servidor confirmar a conclusão.
- Corrida / resposta atrasada: risco real, já enfrentado hoje. Mitiga-se com a mesma versão de fila já usada no overlay mais a chave da decisão: previsão de uma decisão antiga é descartada.
- Mudança de decisão antes do "Concluído": resolvida por invalidação de chave e cancelamento da requisição em andamento.
- Divergência entre previsão e realidade (calendário, congelamento por compromisso, gates): a previsão nunca substitui a fila oficial devolvida pela conclusão — serve só para exibir mais cedo, sendo reconciliada em seguida.

## 5. Sem segundo motor ou segunda fila

Sim. A previsão usa o mesmo módulo puro de decisão da régua V2, sem persistência, e a autoridade continua sendo a fila oficial. Não há novo agendador, nova tabela, nova fila nem alteração das regras de cadência.

## Ganho esperado, com honestidade

O ganho fica concentrado na releitura da fila e no conteúdo da mensagem — normalmente a maior parte da espera percebida. O avanço do motor continua acontecendo depois do "Concluído" e não pode ser antecipado. A percepção deve melhorar, mas não vai a zero.

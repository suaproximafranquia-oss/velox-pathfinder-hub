# Diagnóstico técnico: cadência, Ação do Dia e atividade do Portal em `/f`

## Objetivo
Documentar exatamente o comportamento atual, sem implementar ou alterar código, banco, dados, filas, cadências, histórico, componentes ou migrations.

## Investigação
1. **Rastrear a E0 manual nos três cenários**
   - Seguir a criação da E0 desde a entrada do lead até `workspace_e0_actions`, abertura da cadência e itens de `relationship_queue`.
   - Verificar como os resultados “Atendeu” e “Não atendeu” afetam Ligação 1, Ligação 2 e Mensagem E0.
   - Identificar como cada obrigação e a conclusão da etapa são persistidas.
   - Comparar o comportamento encontrado, cenário por cenário, com a regra de negócio descrita.

2. **Localizar a decisão E0 → E1**
   - Identificar a função que considera E0 concluída, a função que escolhe a próxima etapa e quando E1 é criada ou programada.
   - Mapear chamadas imediatas após uma conclusão, reconciliação ao abrir a Ação do Dia e execução periódica do scheduler.
   - Verificar se a decisão usa o estado comercial vigente no momento da avaliação ou um estado congelado anteriormente.

3. **Explicar a montagem da Ação do Dia**
   - Rastrear do clique na interface até o adaptador e a função server-side que monta a fila.
   - Separar obrigações já persistidas de reconciliações executadas durante a abertura.
   - Identificar as consultas, ordenação, deduplicação, claims, continuidade e releituras após conclusão.
   - Explicar tecnicamente a espera de alguns segundos observada ao abrir ou atualizar.

4. **Auditar interferência dos estados comerciais**
   - Verificar o tratamento atual de Frios, Zero Contato, Agendamento, Vídeo Chamada e demais estados de pausa/retomada.
   - Confirmar quando esses estados bloqueiam, congelam, encerram ou retomam a próxima etapa.
   - Descrever o caso temporal da Micaela na sexta-feira e o que ocorreria na próxima janela operacional.

5. **Rastrear atividade e engajamento do Portal do Investidor**
   - Identificar os eventos reais de navegação, sua persistência e a consolidação de sessões, tempo ativo, módulos e retornos.
   - Mapear a regra atual de `viewed_at`, atividade posterior e classificação NOVO/EM ANDAMENTO.
   - Investigar especificamente João Figueiredo e distinguir “lead novo” de “nova atividade”.

6. **Avaliar o alerta operacional já existente**
   - Verificar a leitura de `portal_journey_events`, a regra de primeiro acesso/retorno após sete dias, a persistência de conclusão e o consumo pela Ação do Dia.
   - Confirmar se esse caminho já evita criar lead, etapa, ligação, mensagem, origem ou motor paralelo.
   - Apontar o encaixe mais seguro para uma futura regra, reutilizando apenas mecanismos existentes.

## Validação somente leitura
- Conferir testes existentes que formalizam E0, transição, fila, compromissos e alertas.
- Consultar somente os registros necessários do João e estruturas relacionadas para distinguir comportamento do código e estado real dos dados.
- Não executar funções de escrita, ticks, resets, migrations ou qualquer operação que altere estado.

## Entrega
Relatório organizado pelos nove itens solicitados, com:
- nomes de arquivos e funções;
- fluxo real e pontos exatos de decisão;
- tabelas/campos apenas quando confirmados;
- diferenças entre o comportamento atual e a regra desejada;
- distinção explícita entre fato confirmado, efeito dos dados atuais e hipótese não comprovada;
- nenhuma implementação ou proposta genérica.

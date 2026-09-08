# Fechamento das regras da cadência antes da construção

Somente leitura. Nada foi alterado: nem código, nem banco, nem mensagens, nem Biblioteca, nem Ação do Dia.

## 1. Âncora — comparação das duas opções

Régua: D0 · +1 · +2 · +2 · +2 · +4 · +3 (E8 teórico em D14). Deslocamento: sábado → segunda, domingo → terça.

**OPÇÃO A — conta a partir da execução real da etapa anterior.** Cada deslocamento de fim de semana empurra tudo o que vem depois, e os atrasos se somam.

| Entrada | E8 |
|---|---|
| Segunda | D18 (sexta) |
| Terça | D16 (quinta) |
| Quarta | D16 (sexta) |
| Quinta | D18 (segunda) |
| Sexta | D20 (quinta) |
| Sábado | D20 (sexta) |

**OPÇÃO B — data teórica a partir da origem do ciclo, com piso na conclusão da anterior.**

| Entrada | E8 |
|---|---|
| Segunda | D14 (segunda) |
| Terça | D14 (terça) |
| Quarta | D14 (quarta) |
| Quinta | D14 (quinta) |
| Sexta | D14 (sexta) |
| Sábado | D16 (segunda) |

**Recomendação: OPÇÃO B.** Ela preserva a intenção comercial dos ~15 dias em praticamente toda entrada, absorve fins de semana sem alongar o ciclo e continua impedindo que uma etapa aconteça antes da anterior. A opção A é mais simples de explicar, mas o ciclo vira uma variável de 16 a 20 dias, dependente do dia de entrada — exatamente o que você quer evitar.

Detalhe da opção B que precisa de regra explícita: quando um deslocamento faz duas etapas caírem no mesmo dia (por exemplo E3 empurrada de sábado para segunda e E4 teórica também na segunda), a segunda etapa vai para a próxima abertura operacional seguinte — nunca duas etapas do mesmo lead no mesmo dia. Isso já está considerado nos números acima.

## 2. E1 e a segunda ligação atravessando a janela

A sequência que você descreveu é consistente e é a forma correta:

ligação 1 segunda 16:00 → +3h cairia 19:00, fora da janela → ligação 2 fica pendente → executa na próxima abertura (terça, 09:00) → só então E1 é concluída → só então o motor calcula E2.

Consequência a assumir: E1 pode atravessar o dia. Na opção B isso não alonga o ciclo, porque E2 tem data teórica própria — a conclusão tardia de E1 só funciona como piso.

Se a ligação 1 for às 14:00, a ligação 2 sai às 17:00 no mesmo dia, dentro da janela. Correto.

## 3. Fila L1–L4 — o que precisa acontecer

Ela é usada em dois pontos: a Ação do Dia (que a agrega) e as funções de fila de ligações do CRM. Atende leads nas colunas ZERO CONTATO e FRIOS — os mesmos do fluxo E.

Não encontrei nenhuma funcionalidade legítima que dependa dela para algo **fora** da cadência de relacionamento: ela não alimenta KPI próprio, agenda, reuniões nem remarketing; é puramente geradora de tarefa de ligação.

Para eliminar duplicidade sem perder nada: parar de **gerar** novas obrigações por L2/L3/L4, mantendo intactos histórico, auditoria e as tarefas já registradas, que continuam aparecendo até serem concluídas. A leitura da Ação do Dia continua igual. L1 é manual e desaparece naturalmente quando E1 assumir as ligações.

## 4. Sábado

A separação é tecnicamente segura, porque calendário e janela são coisas distintas: a janela de sábado permite executar (atrasados, pendências, compromissos, novos leads pela regra própria), enquanto o deslocamento impede que sábado receba **vencimento teórico novo** de cadência. Uma coisa não interfere na outra.

## 5. Material enviado fora de E5

Forma mínima e coerente: um registro explícito de "apresentação digital enviada" no histórico do ciclo, feito pelo executivo em uma ação simples na ficha ou na própria Ação do Dia — o mesmo tipo de registro que a conclusão de E5 grava automaticamente. Assim a pergunta do motor continua sendo uma só ("existe registro de apresentação neste ciclo?") e não há dois critérios concorrentes. Nada de etiqueta, nada de interpretar texto.

## 6. Janelas

Podem ser centralizadas sem quebrar E0. Segunda a sexta 09:00–17:30, sábado 08:00–16:00, domingo fechado passam a ser a janela única das etapas de cadência, substituindo as janelas divergentes de hoje.

E0 mantém a sua própria configuração de execução, inclusive a janela própria e o modo manual/automático por executivo — que continua vindo apenas da configuração vigente do executivo, sem exceção por lead. A mudança das janelas gerais não toca nisso.

## 7. Agendamento

Sem conflito. Compromisso é data/hora real: não é deslocado por sábado, domingo ou feriado, mantém a prioridade máxima próxima do horário, e o fluxo do follow-up do GreenSales continua independente da matemática da cadência. O calendário sábado → segunda / domingo → terça vale só para vencimento de etapa.

## 8. Respostas diretas

1. **Âncora**: opção B.
2. **Horizonte do E8**: A = D16 a D20 conforme o dia de entrada; B = D14 em todas as entradas de segunda a sexta, D16 na entrada de sábado.
3. **E1 atravessando a janela**: a segunda ligação fica pendente e executa na próxima abertura; E1 só é concluída depois dela; só então E2 é liberada.
4. **L1–L4**: parar de gerar novas obrigações, preservando histórico, auditoria e tarefas em aberto.
5. **Sábado**: sim, operacional para executar, sem receber vencimentos novos.
6. **Material fora de E5**: registro explícito de "apresentação enviada" no histórico do ciclo, equivalente ao que a conclusão de E5 grava.
7. **Janelas**: sim, centralizáveis, com E0 preservando sua configuração própria.
8. **Agendamento**: nenhum conflito.
9. **Decisões restantes**: nenhuma indispensável — as duas escolhas que faltavam (âncora e destino da fila de ligações) estão respondidas acima e só dependem da sua confirmação de que segue a recomendação B e a desativação da geração por L2–L4.

ARQUITETURA PRONTA PARA CONSTRUÇÃO.

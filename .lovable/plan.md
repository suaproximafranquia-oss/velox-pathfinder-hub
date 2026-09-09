# Diagnóstico direcionado — E1 → E2 da Financeira /f

Somente leitura do código e da estrutura de `relationship_queue`. Nenhum código ou dado alterado, nenhuma sincronização, teste ou simulação executada. Este documento apresenta o diagnóstico, não uma construção a executar.

## Conclusão

**A regra definitiva ainda não está implementada.** Hoje:

- E1 prevê **duas ligações com intervalo de 3 horas**, seguidas de uma mensagem — não 2 horas.
- A segunda ligação **não expira ao encerrar o expediente**. Se a liberação cair fora da janela, é deslocada para a próxima abertura; se já estava liberada e não foi realizada, continua pendente e pode aparecer atrasada.
- E2 prevê **uma ligação e uma mensagem**, independentemente da quantidade de ligações feitas na E1.
- Não existe compensação E1 → E2 nem contador de compensações acumuladas. Existe risco de **pendência antiga persistir e segurar o avanço**, não uma regra que gere três ligações em E3.

## Respostas 1–18

### 1. Como são representadas as duas ligações da E1?

Como ações internas da mesma etapa na fila existente:

| Etapa | `action_order` | `action_kind` | Ação |
|---|---:|---|---|
| E1 | 1 | `call` | Ligação 01 |
| E1 | 2 | `call` | Ligação 02 |
| E1 | 3 | `message` | Mensagem |

O plano não cria três etapas: todas continuam E1. As ações seguintes são programadas progressivamente pelo motor conforme o resultado da anterior.

**Importante:** cumprir as duas ligações não equivale, hoje, a concluir toda a E1 quando ambas resultam em “Não atendeu”: ainda existe a mensagem prevista.

### 2. Onde é definida a ordem?

Em `stepActions("E1")`, em `cadence-v2.ts`. `nextReleasedAction()` exige que a ação anterior esteja concluída antes de liberar a seguinte. O motor grava a ordem em `relationship_queue.action_order`.

### 3. Qual é o intervalo atual?

**3 horas a partir de `executed_at` da primeira ligação**, pela propriedade `waitHoursAfterPrevious: 3`. Não é contado da abertura do card nem do horário originalmente previsto.

`nextReleasedAction()` soma o intervalo e passa o resultado para `nextOpenMoment()`.

A janela da cadência está definida como **segunda a sexta, 09:00–17:30; sábado, 08:00–16:00; domingo/feriado, fechado**. O limite final é exclusivo.

### 4. O código consegue saber se uma ou duas ligações foram realizadas?

**Os registros permitem saber; a decisão de compensação não existe.** Cada ação guarda etapa, ordem, tipo, estado, horário de execução e resultado. É possível identificar as ligações 1 e 2 efetivamente `EXECUTED`, sem confundir a mensagem com uma ligação.

`loadCadenceV2State()` já carrega esses dados para `decideCadenceV2()`. Entretanto, `stepFinished()` verifica conclusão da etapa, não “duas tentativas realizadas dentro do mesmo dia”.

### 5. O que acontece se a segunda ligação não ocorrer dentro da janela?

Há dois casos:

- **O intervalo termina fora da janela:** `nextOpenMoment()` desloca a liberação para a próxima abertura. Não descarta a tentativa.
- **A ligação já estava liberada, mas não foi realizada até o fechamento:** continua na fila com seu vencimento. Não há, nesse caminho, expiração diária específica da segunda ligação E1.

Pela regra atual, uma primeira ligação às 15:00 produziria liberação às 18:00 e, portanto, deslocamento para a próxima abertura — não às 17:00 como na regra solicitada.

### 6. Ela permanece pendente?

**Sim**, como `PENDING`, ou `PROCESSING` enquanto reivindicada. A reavaliação do motor reconhece a mesma etapa/ordem pendente, sem tratá-la como tentativa expirada pelo fim do expediente.

### 7. Ela vira atraso no dia seguinte?

**Pode virar, com uma distinção:**

- Se venceu em dia útil anterior e não foi executada, a Ação do Dia pode classificá-la como atrasada no próximo dia útil, mantidas as demais condições de elegibilidade.
- Se sua liberação foi deslocada para o próximo dia operacional, chega nesse dia como obrigação daquele dia, não atrasada por causa do dia anterior. Se continuar sem execução, também poderá atrasar depois.

A classificação usa dias úteis e `due_at`; não existe isenção específica para a segunda ligação E1. Não é correto afirmar que qualquer virada de meia-noite produz atraso.

### 8. É encerrada ou removida ao fechar a janela?

**Não por esse motivo.** Os caminhos examinados não encerram a tentativa por fim da janela. Cancelamentos por resultado ou mudança de fluxo são motivos diferentes e não implementam a regra solicitada.

### 9. Existe registro de E1 incompleta?

**Existe histórico suficiente para identificar uma ligação executada e outra não executada**, mas não um resultado específico “E1 incompleta por encerramento da janela” usado para compensar E2.

Também não basta verificar se a etapa consta como executada: o comportamento atual considera a etapa terminada quando uma ligação foi atendida, mesmo sem duas tentativas.

### 10. De onde vem a quantidade de ligações de E2?

Do plano fixo `stepActions("E2")`: **ordem 1 = ligação; ordem 2 = mensagem**. `decideCadenceV2()` usa esse plano para reconhecer conclusão e liberar a próxima ação.

### 11. Existe E2 com duas ligações por E1 incompleta?

**Não.** O plano atual não recebe a completude da E1 para determinar a quantidade de ligações da E2.

### 12. Qual é o ponto exato para introduzir essa decisão?

No **planejamento das ações internas de E2**, alimentado pelo histórico E1 já recebido por `decideCadenceV2()`.

A decisão precisa ser compartilhada por:

- `stepActions()` — plano aplicável àquela E2;
- `nextReleasedAction()` — ordem e intervalo das ações;
- `stepFinished()` — reconhecimento de conclusão no decisor;
- `isStepComplete()` — manter o mesmo contrato de conclusão onde utilizado.

**Não basta acrescentar uma ligação na tela nem apenas alterar a lista fixa:** atualmente a ordem 2 de E2 pertence à mensagem. A E2 compensada precisa distinguir ligação 2 e mensagem, sem reinterpretar registros existentes.

### 13. Se E1 fez as duas ligações, E2 tem somente uma?

**Sim quanto ao plano atual de E2**, mas não por reconhecer E1 completa: E2 tem uma ligação em todos os casos. A metade “E1 incompleta → E2 com duas” não existe.

### 14. Se E2 compensada também ficar incompleta, existe proteção contra atraso/acúmulo?

**Não existe proteção específica**, e E2 compensada ainda não existe. Se uma segunda ligação fosse apenas acrescentada ao plano, as regras atuais a manteriam pendente ou deslocariam sua liberação; não expiraria automaticamente.

Não há transferência numérica para E3 hoje. O risco imediato dessa alteração isolada seria conservar a pendência e impedir o encerramento da E2.

### 15. Existe mecanismo de acúmulo entre etapas?

**Não existe contador de dívida que some tentativas à etapa seguinte.** O que existe é retenção de ações não realizadas na própria etapa.

`decideCadenceV2()` percorre as etapas e para na primeira ainda não terminada. Uma segunda ligação E1 pendente pode impedir que a E2 seja programada pelo caminho normal. Portanto, existe acúmulo temporal de trabalho pendente, não compensação cumulativa de quantidade.

### 16. A quantidade depende só da etapa ou também do histórico anterior?

**Hoje depende apenas da etapa**, em `stepActions(step)`. O histórico já é usado para resultados, ordem e conclusão, mas não para escolher uma ou duas ligações na E2.

A arquitetura permite introduzir essa escolha por lead sem outra fila ou motor, utilizando os dados já carregados.

### 17. Qual é a menor alteração necessária, futuramente?

Não seria uma mudança apenas visual nem somente trocar `3` por `2`. O menor conjunto funcional seria:

1. Alterar o intervalo interno E1 para **2 horas**.
2. Reconhecer o fim da oportunidade diária da segunda ligação E1 e da segunda ligação compensatória E2, sem deslocá-las para outro dia.
3. Registrar a tentativa não realizada como encerrada na **mesma fila**, preservando a linha e um motivo específico; nunca marcá-la como executada.
4. Usar somente a incompletude pertinente da E1 para escolher o plano de E2: uma ou duas ligações, com 2 horas entre elas. A incompletude da E2 não alimentaria outra compensação.
5. Aplicar o mesmo plano na liberação e na conclusão, impedindo que a segunda ligação expirada reapareça ou seja aceita numa conclusão tardia. A Ação do Dia não deve considerar executável uma tentativa já expirada enquanto aguarda a próxima passagem do agendador.
6. Preservar `nextTransition()` e `planDue()`: a compensação não antecipa E2 nem redefine a distância entre etapas.

**Duas particularidades precisam ser respeitadas para uma implementação exata:**

- A E1 atual também tem mensagem. Cancelar somente a ligação 2 não basta: `nextReleasedAction()` exige a anterior `DONE` para liberar a mensagem, enquanto `stepFinished()` espera todas as ações aplicáveis. É necessário definir o tratamento dessa dependência, sem inventar envio, cancelar mensagem silenciosamente ou dar a etapa inteira como executada.
- Hoje “Atendeu” encerra as ações restantes da etapa. Isso não é equivalente a perder a segunda tentativa por falta de janela. O diagnóstico não presume que esse caso deva gerar compensação nem propõe mudar a regra de atendimento.

A escolha do plano deve permanecer estável após o início da E2 e usar o histórico pertinente ao ciclo do lead, não uma contagem indiscriminada de ligações antigas.

### 18. É possível reutilizar fila, ordem, histórico e motor?

**Sim.** A estrutura consultada já possui `action_order`, `action_kind`, `status`, `executed_at`, `result`, `cancel_reason`, `origin_date` e `theoretical_date`.

Pode-se preservar a tentativa não realizada usando o estado de cancelamento existente com motivo próprio e derivar a compensação desse histórico, sem tabela, fila ou motor novos. Hoje o carregador lê `cancel_reason`, mas não o repassa em `V2QueueAction`; esse motivo precisaria chegar à decisão para distinguir expiração de outros cancelamentos.

## Distância E1 → E2

`nextTransition("E1")` retorna **`{ to: "E2", days: 2 }`**. O cálculo é pela origem do ciclo e deslocamentos teóricos, com execução anterior como piso e proteção contra duas etapas no mesmo dia.

Isso **não significa simplesmente 48 horas após a última ligação**. A contagem de tentativas é independente dessa regra de datas e deve continuar assim.

## Arquivos e funções diretamente envolvidos

| Arquivo | Ponto confirmado |
|---|---|
| `src/lib/relationship/cadence-v2.ts:136–146, 204–224, 308–315, 351–387, 480–578` | `nextTransition`, `cadenceWindow`, `nextOpenMoment`, `planDue`, `stepActions`, `nextReleasedAction`, `isStepComplete` |
| `src/lib/relationship/cadence-v2-decide.ts:49–58, 95–121, 135–241` | `V2QueueAction`, `toActionState`, `stepFinished`, `decideCadenceV2`: histórico, conclusão e escolha da obrigação |
| `src/server/relationship/cadence-v2-state.server.ts:120–162, 197–219` | `loadCadenceV2State`: lê a fila e fornece o estado ao decisor |
| `src/server/relationship/call-outcome.server.ts:21–118` | `registerQueueCallOutcome`: grava resultado e solicita reavaliação da mesma cadência |
| `src/lib/relationship/engine.ts:198–280, 647–656` | `evaluate`, `tick`: persistência da obrigação e reconhecimento de pendência existente |
| `src/server/relationship/repository.server.ts:203–267` | `upsertQueueItem`, `updateQueueItem`: gravação por etapa/ordem e atualização do estado/motivo |
| `src/server/relationship/scheduler.server.ts:136–190` | `runRelationshipTick`: acionamento regular do mesmo motor |
| `src/server/crm/daily-actions.server.ts:334–388` | `buildDailyActions`: inclui ações pendentes e calcula apresentação/atraso |
| `src/lib/crm/daily-actions-overdue.ts:47–57` | `availabilityFromDate`, `isOverdueByBusinessDays`: classificação por dias úteis |

**Resultado:** diagnóstico concluído; nenhuma correção implementada ou autorizada por este documento.

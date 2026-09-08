# Construção do motor de cadência + Ação do Dia (Financeira /f)

Escopo exclusivo da Financeira `/f`. Nada de `/`, `/s`, `/s/portal`, `/seg`, Solar ou Seguros. Nenhum dado, histórico, versão de Biblioteca, auditoria ou registro é apagado. Safety Lock intocado, nenhum envio real.

## O que passa a existir

**Etapas oficiais** — E0, E1, E2, E3, E4, E5, E6, E7, E8, R1–R4, RE0–RE3. Nenhuma outra. E12, E20, E27, E30, RF e ER ficam fora da régua comercial (registros antigos são preservados, apenas não geram obrigação nova).

**Régua E (sem resposta)**: E0 = D0 · E1 +1 · E2 +2 · E3 +2 · E4 +2 · E7 +4 · E8 +3.
**Ramo com material**: E4 → E5 imediato · E6 +7 · E7 +2 · E8 +3.
**R**: R1 · +2 R2 · +2 R3 · +4 R4; com material R2 · +4 R4 (R3 pulada).
**RE**: RE0 imediato · RE1 +1 · com nova apresentação RE2 +2 e RE3 +5; sem ela RE3 +3.

**Âncora**: data teórica contada a partir da origem do ciclo, com a execução da etapa anterior como piso. Atraso desloca, nunca comprime nem empilha.

**Calendário**: dias de calendário; vencimento teórico no sábado vai para segunda, no domingo para terça, feriado para o próximo dia operacional. Duas etapas do mesmo lead nunca no mesmo dia — a segunda desloca.

**Janelas da cadência**: seg–sex 09:00–17:30, sábado 08:00–16:00, domingo fechado. E0 mantém a configuração própria por executivo (manual/automático e janela), sem mistura.

**Ações internas**: E1 = ligação 1 → 3h → ligação 2 → mensagem. E2, E3, E4 = ligação → mensagem. Tudo dentro da mesma etapa; nunca E1.1/E2.1. A Ação do Dia mostra só a próxima ação liberada, e ligação sempre antes de mensagem. Se a ligação mudar o fluxo (atendeu, virou agendamento, mudou de estágio, ciclo encerrado), as ações seguintes da etapa saem da fila e o histórico é preservado.

**Contexto de E7/E8**: um par de etapas, dois textos. Com registro estruturado de apresentação enviada → MATERIAL_ENVIADO; sem ele → SEM_CONTATO. Nunca por leitura de texto.

**Material fora do E5**: ação explícita "apresentação digital enviada" registrada no histórico do ciclo, equivalente à conclusão de E5. Sem etapa nova, sem etiqueta, sem mudar estágio.

**Agendamento**: mover para AGENDAMENTO congela E/R/RE imediatamente; nada novo é gerado enquanto o lead estiver lá. R só é liberado pela movimentação humana AGENDAMENTO → FRIOS. O espelhamento do follow-up e a prioridade do compromisso permanecem como estão.

**L1–L4**: param de gerar novas obrigações. Histórico, auditoria e tarefas já registradas continuam existindo e podem ser concluídas normalmente.

## Como será feito (técnico)

Checkpoint de segurança antes de qualquer alteração.

1. **Configuração do fluxo** (`src/lib/relationship/config.ts`, `types.ts`): novas definições de etapa com intervalos em dias de calendário, sequências `sem_resposta`, ramo material, `reengajamento` (R1–R4) e `reentrada` (RE0–RE3), mais o plano de ações internas por etapa. E12/E20/E27/E30 saem das sequências ativas sem serem removidos como chave histórica.
2. **Calendário e janelas** (`src/lib/relationship/calendar.ts`): unidade de dias de calendário, deslocamento sábado→segunda / domingo→terça / feriado→próximo dia operacional (usando a fonte central de feriados já existente), janela única 09:00–17:30 e sábado 08:00–16:00, e a regra de não repetir etapa do mesmo lead no mesmo dia. A janela do E0 permanece separada.
3. **Decisão e máquina** (`decide.ts`, `machine.ts`, `flow-plan.ts`): âncora teórica + piso de execução; bifurcações por contexto de material; congelamento por AGENDAMENTO; liberação de R por transição humana para FRIOS.
4. **Ações internas persistidas**: cada etapa passa a materializar suas ações ordenadas com estado próprio (pendente/concluída/cancelada) e liberação sequencial; a etapa só conclui quando a última ação aplicável termina.
5. **Ação do Dia** (`src/server/crm/daily-actions.server.ts`): passa a expor apenas a ação liberada, com ligação antes de mensagem, e a descartar ações obsoletas após mudança de fluxo. Continua apenas lendo obrigações.
6. **Fila L1–L4** (`src/server/crm/cadence.server.ts`): geração de novas tarefas L2/L3/L4 desativada; leitura e conclusão das existentes mantidas.
7. **Biblioteca** (`message-library.server.ts`, `step-message.server.ts`): as etapas oficiais passam a ser E0–E8, R1–R4 e RE0–RE3; E7 e E8 ganham eixo de contexto (SEM_CONTATO / MATERIAL_ENVIADO) além de COM NOME / SEM NOME, que continua consultando a Central dos Nomes. Nenhuma versão existente é alterada ou apagada.

**Banco**: será necessária uma migration mínima para (a) ações internas da etapa com ordem, estado e horário de liberação, (b) referência teórica separada da operacional na fila, e (c) o registro estruturado de apresentação enviada no ciclo. Antes de escrevê-la, verifico se `relationship_queue`, `relationship_events` e `relationship_cadences` já comportam parte disso, para reaproveitar colunas em vez de criar tabelas paralelas. Nenhum dado existente é migrado ou removido; ciclos em andamento seguem com as obrigações que já possuem.

## Testes direcionados

Simulações de entrada em segunda, sexta, sábado e domingo; E1 com ligação às 14:00 e às 16:00 (atravessando a janela); ordem ligação→mensagem em E2, E3 e E4; mudança para AGENDAMENTO durante a etapa; ramo E5/E6; contextos de E7/E8; R com e sem material; RE com e sem nova apresentação; ausência de novas obrigações L2/L3/L4; nenhuma etapa dupla no mesmo dia; atraso deslocando sem comprimir. Mais TypeScript e build limpos.

## Ponto que exige sua ciência

O motor de relacionamento e a Ação do Dia são compartilhados com outros ambientes. A implementação será feita de modo que apenas a Financeira `/f` use a nova régua, mantendo o comportamento atual para os demais. Se durante a construção algum ponto não puder ser isolado, eu paro e informo antes de alterar.

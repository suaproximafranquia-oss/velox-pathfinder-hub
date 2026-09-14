# Diagnóstico ponta a ponta — Ação do Dia da Financeira `/f`

## Objetivo
Entregar uma verificação somente leitura, sem alterar código, dados ou configurações, cobrindo toda a conexão entre origem comercial, motor de cadência e Ação do Dia.

## Verificações
1. **Jornada E**
   - Rastrear E0–E8 desde a criação do ciclo, decisão da próxima etapa, gravação na fila, exibição no card e conclusão.
   - Confirmar os ramos condicionais do fluxo E e identificar qualquer etapa que possa não nascer ou ficar órfã.

2. **Agendamentos**
   - Rastrear GreenSales → espelho de compromisso → Ação do Dia.
   - Confirmar congelamento da cadência E, tratamento de reagendamentos, encerramento e ausência de ações conflitantes.

3. **FRIOS e jornada R**
   - Verificar a transição estruturada de agendamento/vídeo para FRIOS.
   - Confirmar criação e progressão de R1–R5, inclusive a condição vigente para R4.

4. **Reentrada e jornada RE**
   - Verificar detecção de nova entrada comercial, identidade canônica e abertura idempotente de RE0.
   - Confirmar RE0–RE5, cancelamento das obrigações anteriores, não reinício de E0 e proteção contra duplicidade.

5. **Fila, prioridade e execução**
   - Comparar a ordem efetivamente codificada com: PROCESSING → agendamento/emergência → alerta do Portal → E0/novos → atrasados → ações do dia → futuros.
   - Confirmar que lista, card principal, trava de posição, conclusão e recálculo usam as mesmas funções oficiais.

6. **Sincronização visível**
   - Verificar como mudanças do GreenSales/Portal chegam ao Workspace e à Ação do Dia, incluindo atualização sem recarregar a página.

7. **Estado atual dos dados e proteções**
   - Conferir ciclos ativos, itens pendentes, múltiplos fluxos simultâneos, itens sem ciclo/card e índices de unicidade.
   - Separar garantia estrutural de evidência operacional atual, especialmente porque o marco zero deixou as filas sem casos ativos para observação.

## Entrega
Relatório objetivo com:
- conexões corretas;
- conexões incompletas ou quebradas;
- bifurcações problemáticas;
- risco de ações órfãs ou duplicadas;
- prioridade real aplicada;
- arquivo, função e linha de cada constatação.

Nenhuma alteração ou proposta de refatoração será incluída.

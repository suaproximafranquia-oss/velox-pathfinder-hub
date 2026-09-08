# Diagnóstico — Resolver pendência dentro da Central de Operações (/f)

Somente leitura. Nada foi alterado.

## Respostas

**1. A pendência guarda informação suficiente?**
No histórico, SIM. O registro do pulo (`acao_do_dia_pulada` em `relationship_engine_log`) grava `actionKey`, `leadId`, `kind`, `step`, `title`, `motivo`, executivo e data operacional.
O que a Central recebe hoje é MENOS que isso: `SkipRecord` (operations-center.server.ts) expõe apenas dia, hora, executivo, investidor, etapa, motivo e "recuperada" — **não** expõe `actionKey` nem `kind`. Sem esses dois campos a Central não sabe qual ação abrir.

**2. O card da Ação do Dia pode ser reaproveitado?**
SIM, conceitualmente — é o mesmo contrato (`DailyActionsAdapter`) e as mesmas funções de servidor. Porém o card hoje vive dentro de `daily-actions-overlay.tsx` (arquivo único de ~1.270 linhas, com fila, seleção, trava de posição 1 e pendências juntos). Para usar na Central é preciso extrair o card em um componente próprio que receba UMA ação e o adaptador, sem duplicar regra.

**3. A recuperação já funciona quando a pendência é concluída depois?**
SIM. `recordSkipRecovery` grava `acao_do_dia_pulo_recuperado` uma única vez, só se houver pulo anterior, e a Central deixa de contar aquele item como pulo (marca "Recuperada").

**4. Por tipo de ação hoje:**
- Mensagem: **SIM** — `registerDailyActionMessage` chama `recordSkipRecovery` quando a etapa é concluída.
- Reunião: **SIM** — `resolveMeetingOutcome`, apenas quando "compareceu".
- Ligação: **NÃO** — o caminho da ligação da régua V2 (`registerQueueCallOutcomeFn` / adaptador `completeCall`) não chama `recordSkipRecovery` em lugar nenhum.

**5. Ligação pulada e depois resolvida é registrada como recuperada?**
NÃO. É exatamente a lacuna do item 4.

**6. Histórico do pulo preservado?**
SIM. Nada é apagado ou reescrito: pulo, retomada (`acao_do_dia_pulo_retomado`) e recuperação são três registros distintos.

**7. Os indicadores refletem a recuperação?**
PARCIALMENTE. Mensagem e reunião: sim — sai de "Pulos", entra em "Mensagens"/"Reuniões" e também em "Pendências recuperadas". Ligação: não — permanece como pulo e a ligação recuperada não aparece nas ligações do período, porque as ligações são contadas por `relationship_queue` mas a baixa do pulo depende do registro de recuperação, que não existe para ligação.

**8. Trocar o link do Workspace por "Resolver pendência" na própria Central?**
SIM, é viável reaproveitando a estrutura existente: mesma `actionKey`, mesmas funções de servidor, mesmo adaptador. Nenhuma segunda fila, tabela ou motor é necessário.

## Resumo

**Já existe:** registro completo do pulo; retomada da mesma ação; recuperação para mensagem e reunião; contadores "Pulos" e "Pendências recuperadas"; funções de servidor de todas as ações (ligação, mensagem, reunião) já protegidas por autenticação.

**Está faltando:**
1. `actionKey` e `kind` no que a Central entrega para a tela.
2. Registro de recuperação no desfecho de ligação.
3. Um card operacional isolado, hoje preso dentro da tela da Ação do Dia.
4. Na Central, a coluna do investidor abre o Workspace em vez de resolver a pendência.

## Menor ajuste necessário (quando autorizado)

1. Acrescentar `actionKey` e `kind` ao `SkipRecord` (só leitura, sem migration).
2. Chamar `recordSkipRecovery` também no desfecho da ligação da fila V2 (uma chamada, idempotente).
3. Extrair o card da ação do overlay para um componente reutilizável e abri-lo em uma janela sobre a Central, alimentado pela mesma ação da fila.
4. Substituir o link externo por um botão "Resolver pendência", mantendo o acesso à ficha como ação secundária.

Nada disso exige migration, nova tabela, nova fila ou alteração em cadência, Biblioteca ou outros ambientes.

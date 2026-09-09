# Ação do Dia — lentidão e card fora da posição 1 (Financeira /f)

Diagnóstico feito sobre o código atual e sobre os dados reais. Nada foi alterado.

## 1. Causa exata da lentidão

Ao clicar em "Concluído", a tela fica esperando uma corrente **sequencial** de chamadas ao servidor, e cada uma delas **recalcula o dia inteiro**:

1. `registerQueueCallOutcomeFn` (ou `resolveMeetingOutcomeFn` / `resolveFollowUpContactFn` / `registerDailyActionMessageFn`) faz:
   - duas verificações de permissão (`has_role` x2) + `current_executive_id`;
   - `assertCurrent…` → `currentDailyAction` → **`buildDailyActions` completo** (reconciliação de E0, reuniões, agenda, fila, fechamentos, pulos, identidades);
   - a gravação em si, que ainda chama o motor (`productionEngine().tick`) de forma síncrona;
   - `queueAfterOutcome` → **`buildDailyActions` completo de novo**.
2. Só depois disso o navegador ainda espera uma **segunda chamada**, `recordDailyActionHistoryFn` (histórico), antes de devolver o resultado.
3. Só então a interface troca o card.

Ou seja: por clique são no mínimo 2 recálculos completos do dia + tick do motor + histórico, todos em série, mais o custo de "acordar" o servidor. O banco em si está rápido (a consulta da fila roda em milissegundos), então o tempo vem do encadeamento e do número de idas e voltas — por isso varia de 3 a 40 segundos.

Sobre as perguntas específicas:
- **Bloqueia a troca visual:** sim, tudo acima. A troca só acontece em `applyResult`, depois de todos os `await`.
- **Espera revalidação?** Sim, indiretamente: a "fila oficial" já vem na resposta, mas ela é calculada do zero dentro da mesma requisição.
- **Polling de 5/10/15s?** Não existe polling na Ação do Dia. Há timers de 20s e 60s no Portal dos Leads e um relógio de 30s da janela operacional — nenhum deles interfere na transição.
- **O servidor já devolve a próxima ação?** Sim, para ligação e mensagem (`queue`). Para reunião, agendamento GreenSales e verificação 24h **não devolve** — nesses casos a tela apenas remove o card localmente.

## 2. Causa exata da divergência Michel x Antônio

Michel é um **agendamento do GreenSales marcado para 09/09 às 11:00**, ou seja, **amanhã** (o teste foi feito em 08/09 à noite). Confirmado no banco: `gsfu_59115`, Michel, 09/09 11:00, PENDENTE.

O que acontece:
- a lista do dia carrega compromissos com até 2 dias de antecedência;
- um compromisso de amanhã recebe a classificação **"futura"**;
- na ordenação, reunião/compromisso tem prioridade máxima e fica **à frente** das ligações E0 — por isso Michel virou o card principal;
- o painel direito só desenha três grupos: "Agora", "Atrasadas" e "Para hoje". **"Futura" não é desenhado** — por isso Michel não aparece na lista, enquanto Antônio (E0 de hoje) aparece como posição 1 visual.

Não é cache, não é estado otimista e não é `relationship_queue`: é a mesma lista, com um item que o painel direito simplesmente não sabe exibir. Também há o problema de fundo: **um compromisso de amanhã não deveria ser a ação corrente de hoje**.

## 3. Qual fonte deve ser a autoridade

A lista devolvida pelo servidor (`currentDailyAction().list`), já ordenada. O card principal é sempre o item 1 dessa lista, e o painel direito deve desenhar **exatamente essa lista, na mesma ordem** — sem grupos que possam esconder itens.

## 4. Menor correção possível

Sem novo motor, nova fila ou polling.

**Divergência**
- Compromisso/reunião de outro dia deixa de disputar a posição 1: só entra como ação de hoje quando é do dia corrente (ou está em atraso).
- O painel direito passa a listar a mesma sequência do servidor (com etiqueta de situação por item), em vez de grupos que descartam "futura". Assim é impossível existir card principal fora da lista.

**Lentidão**
- O card sai da tela **imediatamente** ao concluir; a gravação continua em segundo plano e, quando o servidor responde, a fila oficial dele substitui o estado local. Se o servidor recusar (fora de ordem), a lista é recarregada e a mensagem aparece — o servidor continua sendo a autoridade.
- O registro de histórico deixa de ser esperado antes da troca do card.
- O servidor deixa de recalcular o dia duas vezes por conclusão: reaproveita o cálculo já feito na verificação de ordem.
- Reunião, agendamento GreenSales e verificação 24h passam a devolver a fila oficial junto com o resultado, como já acontece com ligação e mensagem.

## 5. Arquivos e funções exatos

- `src/lib/crm/daily-actions.ts` — `actionRank` / `resolveBucket`: compromisso futuro não ocupa a posição 1.
- `src/components/crm/daily-actions-overlay.tsx` — lista "Ordem do dia" renderizada na ordem do servidor; `applyResult` com troca imediata.
- `src/components/crm/daily-action-card.tsx` — `completeCall`, `handleMeetingOutcome`, `handleFollowUpContact`, `handleFollowUpReview`, `handleRegisterMessage`: troca do card antes da confirmação.
- `src/components/crm/daily-actions-real-adapter.ts` — histórico fora do caminho crítico.
- `src/lib/crm/daily-actions.functions.ts` — `queueAfterOutcome` reaproveitado; `resolveMeetingOutcomeFn`, `resolveFollowUpContactFn`, `resolveFollowUpReviewFn` passam a devolver a fila.
- `src/server/crm/daily-actions-gate.server.ts` — devolver a lista já calculada para evitar o segundo recálculo.

Fora do escopo e intocados: `/s`, `/s/portal`, `/seg`, Biblioteca, GreenSales e regras de cadência.

## Decisão que preciso confirmar

Compromisso de **amanhã** (caso Michel): ele deve **sumir da Ação do Dia de hoje** e aparecer só no dia, ou continuar visível hoje em um grupo "Próximos dias" (sem nunca ocupar a posição 1)? Se não houver resposta, sigo com "Próximos dias", que preserva a visibilidade sem quebrar a ordem.

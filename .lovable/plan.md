# Diagnóstico — arquitetura ATUAL de cadência, agendamento e Ação do Dia

Somente leitura. Nada foi alterado. Abaixo, apenas o que existe hoje no código e no banco.

## 1. Entrada do lead e decisão do primeiro contato

O lead entra por `runLeadSync` (`src/server/crm/lead-sync.server.ts`), acionado pelo agendador `runScheduledLeadSync`. Quem decide que o lead precisa do primeiro contato é `registerFirstContact` (`src/server/crm/first-contact.server.ts`), chamado durante a sincronização. Se o momento cai fora da janela operacional, `deferFirstContact` registra o adiamento e a fila `processDeferredFirstContacts` retoma na abertura da janela.

Não existe hoje E1–E8 como agenda. O único contato automatizado de entrada é o que o código chama de E0.

## 2. Onde a decisão fica registrada

- `crm_lead_events` — eventos `e0_adiada`, `e0_simulada`, `boas_vindas_enviada`. É por esses eventos que o sistema sabe se o primeiro contato já ocorreu.
- `crm_sync_runs` — execução da sincronização, com status `RUNNING/DONE` e contadores (`welcome_sent_count`).
- `crm_messages` e `relationship_message_sends` — registro da mensagem e snapshot congelado do que foi montado.
- `relationship_queue` — fila do motor de relacionamento (item por lead + etapa).
- `crm_cadence_tasks` — tarefas de ligação (legado), com `step_day`, `cycle_date`, `status`, `outcome`.

Não existe tabela de "ação individual" com prazo e estado próprios. `action_items` não existe.

## 3. Como a cadência é representada hoje

- As etapas são **constantes de código**, em `STEPS` (`src/lib/relationship/config.ts`), identificadas por chave (E0, E20 etc.). Não são linhas de banco.
- A próxima etapa é **recalculada em memória** a cada ciclo por `decide.ts` / `machine.ts`, a partir do estado do lead e dos eventos já registrados. O sistema não guarda "próxima etapa"; ele deduz.
- Planejada x pendente x executada: existe apenas parcialmente, dentro de `relationship_queue`, pelos status `PENDING`, `PROCESSING`, `EXECUTED`, `FAILED`. Uma etapa que o motor decidiu mas ainda não materializou não deixa rastro de "planejada".

## 4. Caminho técnico de uma mensagem

`runRelationshipTick` → `createEngine().tick(leadId)` → `decide` escolhe a ação → verificações (destinatário, janela, template, vínculo de conteúdo) → `upsertQueueItem` em `relationship_queue` → `claimQueueItem` (reserva atômica) → `dispatcher.send` → `src/server/whatsapp.server.ts` → **Global WhatsApp Safety Lock** → (bloqueado até 2029) → Graph API.
Caminho paralelo da E0: `e0.server.ts` → `sendTemplateWithDestinations` → mesma trava.

## 5. Agendamento

- `pg_cron` chama as rotas públicas a cada minuto: `crm/sync`, `remarketing/run`, `backup/process`.
- `runScheduledLeadSync` respeita `crm_automation_settings.sync_interval_minutes` e ignora execuções concorrentes enquanto houver run `RUNNING` com menos de 15 minutos (`STALE_RUN_MINUTES`).
- O processamento é **em lote**: varre leads elegíveis e processa todos no mesmo ciclo. Não há execução individual agendada por ação.
- Fila existe apenas como `relationship_queue` (mensagens) e `crm_cadence_tasks` (ligações).
- Retry: contador `attempts` no item da fila, com limite `maxAttempts`; esgotado, o item vira `FAILED` e para.
- Concorrência: reserva atômica por item (`claimQueueItem`) + trava antiabandono de 15 min no run de sincronização. Foi exatamente essa combinação que gerou o lote represado das 10:51.

## 6. Etapa que não pode ser executada

Fica em `relationship_engine_log` como `blocked`, com motivo textual (sem executivo, janela fechada, sem template oficial, sem vínculo de conteúdo). O item permanece `PENDING` na fila e será reavaliado no próximo tick — não existe backoff, prazo de bloqueio nem responsável designado pela pendência.

## 7. Rastreabilidade "deveria às X, executada às Y, resultado Z, lead L"

**Não existe** de forma completa. `relationship_queue` tem `due_at`, `executed_at` e `result`, mas só para mensagens do motor e apenas enquanto o item vive; ligações ficam em outra tabela com semântica de dia (não de horário) e reuniões em `portal_meetings`. Não há uma visão única, imutável e por ação.

## 8. Como os conceitos estão separados hoje

| Conceito | Onde vive |
|---|---|
| Etapa de cadência | Constante em código (`STEPS`) |
| Mensagem | `relationship_queue` + `crm_messages` + `relationship_message_sends` |
| Ligação/tarefa | `crm_cadence_tasks` (legado, por dia) |
| Reunião | `portal_meetings` |
| Compromisso livre | `workspace_agenda_events` |
| Ação manual x automática | Não é um campo; é inferido pela fonte |

`buildDailyActions` (`src/server/crm/daily-actions.server.ts`) apenas **lê** essas quatro fontes, normaliza e ordena. Não cria, não persiste, não guarda resultado.

## 9. Pontos capazes de gerar saída de WhatsApp

`src/server/whatsapp.server.ts` (ponto único de rede), alcançado por: `e0.server.ts`, `src/server/crm/messaging.server.ts`, `src/server/remarketing/engine.server.ts` e `conversations.server.ts`. Todos passam pela trava global.

## 10. Caminhos concorrentes

Sim, há mais de um: a E0 pode sair por `registerFirstContact`/fila de adiadas **ou** pelo tick do motor; remarketing tem executor próprio; e o disparo manual pelo CRM é um terceiro caminho. A convergência só acontece na camada de rede, não na camada de decisão.

## 11. Fluxo atual

```text
LEAD ENTRA (GreenSales/Portal)
 → runLeadSync (cron 1 min)
 → crm_leads + crm_lead_events
 → registerFirstContact (ou deferFirstContact → fila de adiadas)
 → runRelationshipTick → decide (em memória)
 → relationship_queue (PENDING → claim → EXECUTED/FAILED)
 → whatsapp.server → SAFETY LOCK (bloqueado)
 → relationship_engine_log + crm_messages
```

---

# Recomendação de separação (Decisão → Planejamento → Execução)

## Reaproveitar
- `decide.ts` / `machine.ts` como **motor de decisão puro** — ele já é determinístico e não toca rede.
- `relationship_engine_log` como trilha de decisão.
- `buildDailyActions` como camada de apresentação, passando a ler uma fonte única em vez de quatro.
- A Safety Lock e o dispatcher, intactos.

## Mudar de responsabilidade
- `relationship_queue` deixa de ser "fila que dispara" e passa a ser plano de ações (ou é substituída pela nova tabela, com migração de histórico).
- `engine.ts` deixa de chamar `dispatcher.send` no mesmo ciclo em que decide: decidir e executar viram passos distintos.
- `crm_cadence_tasks` vira somente histórico; ligações passam a ser ações como as demais.

## Estruturas futuras necessárias
- `action_items`: id, lead_id, etapa, tipo (mensagem/ligação/reunião/tarefa), modo (manual/automático), responsável, `due_at`, estado, `idempotency_key` determinística (lead+etapa+ciclo), motivo de bloqueio, tentativas.
- `action_events`: histórico imutável (criada, adiada, bloqueada, executada, pulada com justificativa, resultado).

## Maiores riscos
1. Dois motores ativos: o tick atual continuar disparando enquanto o novo planejador materializa ações — duplicidade real de envio.
2. Backfill retroativo criando avalanche de ações antigas.
3. Perda de vínculo lead↔ação se a chave de identidade não for obrigatória e validada na escrita da nota/resultado.

## Ordem lógica de implantação
1. Criar `action_items` / `action_events` em modo **sombra** (o motor grava, ninguém executa).
2. Comparar por alguns dias a sombra com o comportamento atual.
3. Ligar a Ação do Dia sobre a nova fonte, ainda em leitura.
4. Transferir a execução manual (ligação, reunião, resultado) para as ações.
5. Só então desligar o disparo dentro do tick, deixando o motor apenas decidir.
6. Congelar os caminhos legados de execução.

Nada disso será implementado sem sua aprovação.

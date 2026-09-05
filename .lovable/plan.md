# AUDITORIA + PLANO — Ação do Dia como fila operacional (Financeira /f)

Somente leitura. Nada foi construído, alterado, migrado ou executado.

## A) Safety Lock — evidências e conclusão

Evidências (`src/server/whatsapp-safety-lock.server.ts`, `src/server/whatsapp.server.ts`, `src/server/remarketing/engine.server.ts`):

1. **Existe caminho técnico para a Meta?** Sim: 5 chamadas `fetch` a `graph.facebook.com/v20.0/...` — 4 em `whatsapp.server.ts` (texto, template, mídia/upload, envio) e 1 em `remarketing/engine.server.ts`. São os únicos pontos de saída no projeto (`rg graph.facebook.com` retorna apenas esses arquivos).
2. **A trava bloqueia?** Sim. `blockRealWhatsappSend` é chamado em **todas as 5** rotas de saída, e cada uma retorna antes do `fetch` quando a trava responde.
3. **O bloqueio é imediatamente antes da Graph API?** Sim — a checagem está no mesmo bloco, linhas antes do `fetch` (ex. linha 65 → fetch 75; 175 → 182; 249 → 265; 445 → 474).
4. **Caminhos alternativos?** Não encontrados. Nenhum outro arquivo referencia a Graph API, e não há cliente HTTP genérico apontando para a Meta.
5. **Permite envio hoje?** Não. `whatsappSafetyLockStatus` exige `now >= 2029-01-01` **e** `WHATSAPP_REAL_SEND_ENABLED=true`. Hoje (2026) a trava temporal já é suficiente; ambas as condições falham.
6. **Algum comando anterior poderia ter disparado envio real?** Não pelo código: as evoluções recentes (Biblioteca, confirmação manual, Blocos 1 e 2) trabalham com cópia de texto e registro de histórico; `registerDailyActionMessage` conclui a fila sem tocar em canal. NÃO COMPROVADO em termos de logs de runtime — a menor auditoria seria contar registros `whatsapp_safety_lock` em `relationship_engine_log` (leitura, sem alteração).
7. **Jobs/schedulers/webhooks capazes de furar a trava?** Não: qualquer job só envia através de `whatsapp.server.ts`/remarketing, e ambos passam pela trava. Além disso `resolveExecutionMode`/`resolveChannelMode` já forçam simulação fora de produção e em lead de teste — segunda camada independente.

**Conclusão: envio real está bloqueado por construção, em ponto único e correto. Nada nesta evolução exige tocar na trava.**

## B) Estado atual encontrado

- **Motor**: `src/lib/relationship/config.ts` é o dicionário executável real. Etapas existentes hoje: `E0`, `E0_V1`, `E1`, `E3`, `E4`, `E12`, `E30`, `V3`, `V4`, `R1`, `R2`, `R3`, `RE0`–`RE3`, `RF0`, `RF1`. Fluxos: `sem_resposta: E0→E1→E3→E4→E12→E30`, `visualizacao: E0→E1→V3→V4`, `reengajamento`, `reentrada`, `frio`.
  **Divergência explícita: a sequência conceitual do pedido (E1–E8, E5=material, E6=cobrança, E7, E8=finalização) NÃO existe hoje.** Não há E2, E5, E6, E7, E8. Renomear ou renumerar quebraria chaves persistidas em `relationship_queue.step`, `crm_cadence_tasks.step_key` e no histórico.
- **Ação do Dia** (`src/server/crm/daily-actions.server.ts`): agregador de leitura de 6 fontes — E0 pendente (`workspace_e0_actions`), `portal_meetings`, `workspace_agenda_events`, fechamento E20/E27, `relationship_queue` (mensagens) e `buildCadenceQueue("call")` sobre `crm_cadence_tasks` (ligações). Recalcula em tempo real; não persiste fila diária.
- **Dois motores confirmados**: `relationship_queue` (mensagens, motor persistente) e `crm_cadence_tasks` (ligações, fila legada com `step_day`, `channel`, `outcome`, `note`, `completed_at`, `canonical_investor_id`).
- **Ligação**: o fluxo "atendeu? / chamou?" **já existe** (`cadence.server.ts` linhas 181–226) e grava `outcome` + `rang` + nota — mas em `crm_cadence_tasks`, fora do motor.
- **Reunião**: `MEETING_FOCUS_WINDOW_MS = 5 min` já implementado; `priorityMax` já garante topo da fila; desfecho/reagendamento gravam em `portal_meetings` + ledger.
- **Pular / observação**: `daily-actions-log.server.ts` grava em `relationship_engine_log` + `crm_timeline`; supressão só vale para a data operacional (volta no dia seguinte). Não avança cadência.
- **Identidade**: `canonical_investor_id` já existe em `relationship_queue` e `crm_cadence_tasks`.

## C) O que já existe e deve ser reutilizado

`relationship_queue` (ações de mensagem), `relationship_message_library` (conteúdo + `content_url`/`content_label`), `workspace_e0_actions` (E0 por titularidade), `portal_meetings` (reuniões), `workspace_agenda_events`, `relationship_engine_log` (auditoria) + `crm_timeline` (leitura humana), `confirmManualExecution` no engine, `MEETING_FOCUS_WINDOW_MS`, `listSkippedActionKeys`, `resolveBucket`/`normalizeDailyActions`, e o adaptador `DailyActionsAdapter` (real x demo).

## D) Parcialmente implementado

| Item | Situação |
|---|---|
| Ligação atendeu/chamou | Lógica pronta, mas no motor legado `crm_cadence_tasks`, sem vínculo a etapa/ciclo do motor |
| Snapshot da mensagem executada | Conclui a fila e loga o passo, mas **não grava o texto/versão efetivamente usado** |
| Pular | Justificativa e auditoria OK; retorno é "no próximo dia calendário", não "próximo dia útil" |
| Reunião | Desfecho/reagendamento OK, mas reagendar **sobrescreve** `scheduled_at` em vez de criar nova ocorrência ligada à anterior |
| Vínculo ação↔ciclo | `canonical_investor_id` existe nas duas filas, mas a Ação do Dia agrupa por `lead_id`/card, não por ciclo |
| Relatório administrativo | Inexistente como tela; os dados-base já estão no ledger, mas **"devidas" não são persistidas** — só o executado |

## E) O que precisa ser construído

1. Unificação da ligação como **canal de etapa** dentro de `relationship_queue` (novo `channel`), com desativação progressiva de `crm_cadence_tasks` sem apagar histórico.
2. Snapshot histórico da mensagem executada (texto + versão da Library) no registro de execução.
3. Reagendamento de reunião como **nova ocorrência encadeada** (`rescheduled_from`), preservando a anterior.
4. Regra de retorno do pulo por **próximo dia útil** (usando o calendário já existente em `relationship_non_business_days`).
5. Relatório administrativo agregado (devidas × executadas × puladas), com "devidas" capturadas de forma reprodutível.
6. Overlay do card do investidor a partir do relatório.

## F) Arquitetura recomendada

**Um motor, uma fila, uma leitura.**

```text
relationship_cadences (ciclo)
   └─ relationship_queue (AÇÃO planejada: step + channel + due_at + canonical_investor_id)
         ├─ channel = "mensagem"  → Library (texto + link)
         ├─ channel = "ligacao"   → atendeu?/chamou?
         └─ portal_meetings       → reunião (ocorrências encadeadas)
                    ↓
        daily-actions.server.ts  (LEITURA: normaliza + prioriza + esconde puladas do dia)
                    ↓
    relationship_engine_log (auditoria) + crm_timeline (histórico humano)
                    ↓
        Relatório administrativo = agregação do MESMO ledger
```

Regras: a Ação do Dia continua sem tabela própria; toda execução escreve no ledger com o `queue.id` original; o motor continua dono de ordem, transição, idempotência e Safety Lock; a Central Única lê a mesma agregação.

**Ponto crítico do relatório:** "devidas" não podem ser reconstruídas depois que a fila avança. Recomendação mínima: um **snapshot diário de planejado** (uma linha por ação devida por dia, gravada na primeira leitura do dia) — não é uma segunda operação, é a fotografia do que a fila mostrou. Sem isso, o relatório só consegue contar executadas e puladas.

## G) Riscos de regressão

- **E0**: risco alto se a ligação migrar de fila — E0 tem janela e origem próprias. Manter E0 intacta no Bloco seguinte.
- **Ownership/redistribuição**: `ownership_seq` participa do `cycleKey` das E0; qualquer chave nova de ação deve incluí-lo.
- **Identidade**: múltiplos cards por investidor — agregar por `canonical_investor_id` no relatório, mas **executar** sempre por card.
- **`crm_cadence_tasks`**: desligar a fonte sem migrar histórico apagaria o passado das ligações. Coexistência obrigatória.
- **`relationship_message_library`**: uma versão ativa por combinação — não introduzir concorrência.
- **Reuniões**: mudar `rescheduleMeeting` afeta `portal_meetings`, usada também fora da Ação do Dia.
- **Safety Lock / `/s` / `/seg` / `/`**: intocados. `whatsapp.server.ts` é compartilhado — não alterar.

## H) Dependências e bloqueios

- **BLOQUEADOR mantido**: vínculo GreenSales. `user_id` observado no payload não está comprovado como vendedor. Sem confirmação externa (lista ID|Nome da Administração GreenSales), nenhuma redistribuição real deve ser ativada.
- Snapshot de "devidas" é pré-requisito do relatório administrativo.
- Calendário de dias úteis é pré-requisito da regra de pulo.

## I) Ordem recomendada dos próximos blocos

1. **Bloco 3** (pendente): auditorias mínimas + ativação do vendor ID, sem redistribuição real.
2. **Bloco 4** — Execução registrada: snapshot da mensagem usada + pulo por próximo dia útil.
3. **Bloco 5** — Ligação como canal do motor (coexistência com o legado).
4. **Bloco 6** — Reunião com ocorrências encadeadas.
5. **Bloco 7** — Snapshot de planejado + relatório administrativo + overlay do card.

## J) Respostas objetivas

1. **Melhor arquitetura**: manter a Ação do Dia como leitura pura e mover a ligação para dentro de `relationship_queue` como canal — nenhum motor novo.
2. **Fontes de verdade**: ações → `relationship_queue`; E0 → `workspace_e0_actions`; ligações → hoje `crm_cadence_tasks`, futuro `relationship_queue`; mensagens → `relationship_message_library`; reuniões → `portal_meetings`; pulos/observações/execuções → `relationship_engine_log` + `crm_timeline`; relatório → agregação desse ledger.
3. **Registro sem duplicar**: um evento por execução, chaveado pelo `queue.id`; `relationship_engine_log` é a auditoria, `crm_timeline` a leitura humana. Idempotência via claim já existente em `confirmManualExecution`.
4. **Vínculo ação↔etapa/ciclo/card**: executar sempre por `card_id` + `cycle`; agregar por `canonical_investor_id`; incluir `ownership_seq` na chave quando houver redistribuição.
5. **Pular**: nunca chamar o motor; apenas gravar evento e suprimir na data operacional, com retorno no próximo dia útil. Já é assim, faltando a regra de dia útil.
6. **Reunião 5 min antes**: já funciona via `MEETING_FOCUS_WINDOW_MS` + `priorityMax`; nenhuma mudança no scheduler é necessária.
7. **Ligação no motor**: reaproveitar `outcome`/`rang`/`note` já implementados, gravando na fila do motor; "atendeu" alimenta `hasRealHumanContact`, "chamou" não.
8. **Relatório**: leitura agregada do ledger + snapshot diário de planejado; nenhuma fila paralela.
9. **Já existe parcialmente**: ligação atendeu/chamou, pulo auditável, reunião 5 min, conclusão da fila. **Falta**: snapshot da mensagem, ocorrências de reunião, dia útil, relatório, unificação da ligação.
10. **Riscos**: ver seção G — os maiores são E0, `crm_cadence_tasks` e reuniões compartilhadas.
11. **Próximo bloco**: Bloco 3 (vendor ID), bloqueado pela confirmação externa GreenSales; se essa confirmação demorar, iniciar pelo Bloco 4, que é independente.
12. **Auditorias mínimas antes de "fila sem ciclo" e "card principal"**: (a) quantos itens de `relationship_queue` estão sem `cadence`/ciclo; (b) quantos investidores têm mais de um card ativo em `/f`; (c) cobertura de `canonical_investor_id` nas duas filas; (d) quantos itens pendentes pertencem a ciclos históricos. As quatro são consultas de leitura.

## Observação de escopo

Este pedido inclui "registrar a tarefa em roadmap.md". Em modo de planejamento só posso escrever este arquivo; o roadmap será atualizado no primeiro bloco de construção aprovado.

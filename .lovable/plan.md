# Diagnóstico — leads já abertos voltando para "NOVO"

Nenhuma alteração foi feita em código, banco, leads ou Portal. Abaixo, a cadeia causal real.

## A) O que significa "NOVO" no Workspace

Existem **dois "Novo" diferentes** no sistema — essa é a distinção mais importante do diagnóstico.

1. **Indicador operacional do card (etiqueta verde "Novo")** — estado derivado em tempo de renderização, não existe coluna "status" no banco. Regra: `encerrado` se houver `closed_at`; `novo` se não houver `viewed_at` **ou se a última atividade for posterior ao `viewed_at`**; caso contrário `em_andamento`.
2. **Coluna "Status" da tela Investidores (`/f/executivo/investidores`)** — outro campo, derivado do progresso de leitura: sem leitura registrada ⇒ `"novo"` (rótulo "Novo"). Esse rótulo **nunca muda por abrir o lead** — ele só muda com leitura do Manual, simulador ou conclusão. Se a reclamação inclui essa tela, ali não há regressão nenhuma: é o comportamento atual por definição.

## B) Arquivos e funções responsáveis

- `src/lib/lead-state.ts` → `resolveLeadState()` (etiqueta do card), `markLeadViewed()`, `persist()`.
- `src/lib/executive-data.ts` → `listAllInvestors()`, que calcula `lastActivity` (linha ~154) e o `status` derivado de leitura (linha ~138, o fallback literal `: "novo"`).
- `src/components/executive/workspace/investor-card.tsx` (linhas 104-108, 133-134, 156) — renderiza a etiqueta.
- `src/routes/f.executivo.dashboard.tsx` (linhas 140-172, 223-227) — hidratação e ordenação por `stateScore`.
- `src/lib/portal-leads-sync.ts` → `pullLeads()` / `toLocal()` — espelho servidor → cache local.

## C) Cadeia ao abrir um lead

Clique no card → `markLeadViewed(id)` → `persist()` grava `viewed_at = now` via `updateWorkspaceOperational` → RPC `set_lead_operational` → confirma linhas afetadas → `patchCachedLead` mantém o cache → emite `lead.status.changed` → card vira "em andamento". **Esse trecho está correto e realmente persiste** (55 de 56 leads têm `viewed_at` gravado no banco).

## D) Cadeia ao voltar/recarregar o Workspace

F5 / troca de tela / foco na janela / evento realtime → `pullLeads()` → `listPortalLeads()` (`select *`, inclui `viewed_at`) → `toLocal()` mapeia `viewedAt` corretamente → `replaceLeads()` → `listAllInvestors()` recalcula `lastActivity` → cada card chama `resolveLeadState()`.

## E) Onde o estado correto é perdido

Não é perdido no banco nem no transporte. Ele é **recalculado para "novo" na renderização**, dentro de `resolveLeadState`, pela regra:

```text
se lastActivity > viewedAt  ⇒  volta a "NOVO"
```

E `lastActivity` (executive-data.ts:154) é o **maior** valor entre `createdAt`, `lastActivityAt`, `journeyLastEventAt`, `lastInboundAt` **e a data de todos os eventos locais do barramento** (`velox:events:v1`), com um único tipo excluído: `lead.status.changed`.

Ou seja: qualquer evento local gravado **depois** da visualização reclassifica o lead como NOVO. Emissores confirmados no código, todos disparados por ação do EXECUTIVO (não do investidor):

- `src/lib/investor-comments.ts:60` → `profile.updated` ao adicionar comentário/anotação;
- `src/lib/workspace-lead-edit.ts:135` → `profile.updated` ao editar a ficha;
- `src/lib/meetings.ts:186/249/330/370/421` → `meeting.created/confirmed/rescheduled/...`;
- `src/lib/workspace-alerts.ts:124` → `investor.reactivated` emitido dentro de `pushAlert()`, ou seja, **toda vez que um alerta novo é criado para aquele lead**;
- `src/components/shared/executive-contact-dialog.tsx:81` → ainda emite `lead.status.changed` (esse é o único filtrado em executive-data, então hoje ele é inofensivo para a etiqueta).

O filtro paliativo criado no Bloco anterior cobriu **apenas** `lead.status.changed`. Todos os demais eventos administrativos continuam entrando no cálculo de atividade do investidor — exatamente o comportamento que a regra oficial proíbe ("abrir/operar o card não é atividade do investidor").

## F/G) Dados no banco x dados que chegam ao frontend

Consulta em `portal_leads` (56 leads):

- 55 com `viewed_at` preenchido, 1 sem (`gs_58673`, nunca aberto — correto).
- **Zero** leads com `last_activity_at`, `journey_last_event_at`, `last_inbound_at` ou `created_at` maiores que `viewed_at`.
- Nenhuma rotina de servidor grava `viewed_at`; só `set_lead_operational`. Sincronização GreenSales grava `last_activity_at = created_at` do lead e nunca `now()`.

Amostras: `gs_58674` (atividade 27/08 22:52, visto 28/08 00:22), `ld_mt3w9q2zytov` (atividade 27/08 21:08, visto 28/08 02:41), `gs_58659` (atividade 27/08 17:01, visto 27/08 21:06). Todos deveriam renderizar "em andamento".

Conclusão de camada: **BANCO correto → API correta → CACHE correto → o "NOVO" nasce na camada de RENDERIZAÇÃO/derivação (executive-data + lead-state)**.

## H) Regra que faz reaparecer o "NOVO"

`resolveLeadState()` comparando `viewedAt` contra um `lastActivity` contaminado por eventos locais de origem administrativa. Secundariamente, na tela Investidores, o `status` derivado de leitura (`readingPct === 0 ⇒ "novo"`).

## I/J) Relação com Bloco 1 e Bloco 2

- **Bloco 1**: relacionado indiretamente. O Bloco 1 removeu a persistência otimista e passou a confirmar a gravação no servidor — isso está funcionando (o `viewed_at` está gravado). Mas o Bloco 1 tratou só do evento `lead.status.changed`; não fechou a porta dos demais eventos administrativos.
- **Bloco 2 (Identidade)**: **não relacionado**. Não há duplicidade nem troca de `id` envolvida — os mesmos registros mantêm `viewed_at`; o problema é reclassificação visual.

## K) Recomendação (sem implementar)

1. Definir uma lista branca explícita de eventos que constituem **atividade do investidor** (jornada, leitura, simulador, WhatsApp de entrada, resposta inbound) e usar só ela no cálculo de `lastActivity` — em vez da lista negra atual de um único tipo.
2. Mover o critério "há novidade não vista" para o servidor (comparar `viewed_at` com colunas de atividade real já existentes), eliminando a dependência do barramento `localStorage`, que é por navegador e não sobrevive a outra máquina/sessão.
3. Renomear o rótulo derivado de leitura na tela Investidores (ex.: "Sem leitura") para não colidir com o indicador operacional "Novo".
4. Verificação sugerida antes de qualquer correção: com o Workspace aberto, inspecionar `velox:events:v1` e confirmar, para 2-3 leads afetados, o evento pós-`viewed_at` que está elevando a atividade — isso fecha a prova empírica do item E.

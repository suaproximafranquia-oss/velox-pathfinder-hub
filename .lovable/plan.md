# Diagnóstico — Regra RE (Reentrada) x R (Reengajamento) — Financeira /f

Somente leitura. Nenhum arquivo operacional, banco, migration ou teste foi alterado.

## A) O que o código faz hoje

**1. Identificação de nova entrada como RE**
- `src/lib/relationship/entry.ts` → `resolveEntryFlow({ entryCount, hasPreviousRelationship, newCommercialEntry })` devolve `flow: "reentrada"` quando existe relacionamento anterior + nova entrada comercial.
- Chamado em `src/server/crm/lead-intake.server.ts` (linha ~283). O resultado hoje **só gera um evento de auditoria** (`e0_reentrada`). O `flow` retornado **não é propagado** para a abertura do ciclo.
- A abertura real do ciclo manual acontece em `createPendingE0Action` → `openManualE0Cadence(cardId, 0)` (`src/server/relationship/e0-manual.server.ts`), que emite `LEAD_CREATED` com `data: { manualE0: true }` — **sem `reentry: true`**.
- A máquina (`src/lib/relationship/machine.ts:156`) só entra em `reentrada` quando o evento traz `data.reentry === true` (caminho usado por `src/server/crm/first-contact.server.ts:132`, do fluxo antigo/reativação).

**2. Histórico de "já passou pela E"**
- Existe estrutura suficiente: `relationship_cadences` guarda **instâncias** por lead (`instance_seq`, `flow`, `active`, `close_reason`, `executed_steps`) — `src/server/relationship/instances.server.ts`. E `relationship_queue` guarda cada etapa executada.
- Mas o estado da V2 (`src/server/relationship/cadence-v2-state.server.ts`) é montado **apenas a partir da instância ativa** (`record.flow`, `record.executedSteps` e as linhas da fila daquele ciclo). Nenhuma consulta agrega instâncias anteriores.

**3. Histórico de "já passou/concluiu R"**
- Não existe nenhuma leitura de "R já consumido". O único marcador é o evento `REENGAGEMENT_RELEASED` (chave `r_release_<leadId>_<at>`), que é idempotente **por transição**, não por lead.

**4. AGENDAMENTOS/VÍDEO → FRIOS**
- Detectado em `src/server/crm/lead-sync.server.ts` (~linha 460) comparando `stage_key` anterior x atual, e decidido em `releaseReengagementOnFrios` (`src/server/crm/greensales-followup.server.ts:681`), que usa `isCommitmentStageToFrios` (`src/lib/crm/greensales-followup.ts:212`).
- A regra hoje é puramente **transicional**: se a transição é compromisso → frio e o evento daquele instante ainda não existe, abre nova instância `flow: "reengajamento"` via `openInstance`, cancela pendências não-R e o motor programa R1.
- A única trava histórica dentro de `openInstance` é o estágio terminal OPORTUNIDADE.

## B) O que está errado ou faltando

1. **RE não nasce como RE.** Uma nova entrada de lead conhecido volta para E0 pela régua V2 (`openManualE0Cadence`), porque o `flow: "reentrada"` resolvido no intake não chega ao evento de abertura. O caso 4 do cenário **não funciona hoje**.
2. **Risco real de R duplicado.** Um lead que já concluiu E + R, se voltar a compromisso e depois a FRIOS, abre **outra** instância de reengajamento: nada consulta o histórico de instâncias `reengajamento` anteriores.
3. **Risco de R não criado**: baixo pela regra atual (a transição sempre abre R), mas o inverso é verdadeiro após a correção do item 2 — se a trava for feita só por "já existiu instância R", o caso legítimo "fez E, entrou em RE, agendou, voltou a FRIOS e nunca fez R" continua correto **desde que** a trava seja por R consumido, não por E concluída.
4. Não há campo/consulta que responda "este lead já consumiu o R desta rodada de relacionamento".

## C) Ponto exato de construção

Dois pontos, ambos dentro do que já existe — sem nova tabela, fila ou motor:

1. **Nascer em RE:** propagar o `flow` de `resolveEntryFlow` até a abertura do ciclo.
   - `src/server/crm/lead-intake.server.ts` (onde `entry` já é calculado) → passar `reentry` para `createPendingE0Action` → `openManualE0Cadence(cardId, 0, { reentry: true })` → evento `LEAD_CREATED` com `data.reentry = true` (a máquina em `machine.ts:156` já sabe tratar isso e abre em RE0).
2. **Decidir se a transição abre R:** dentro de `releaseReengagementOnFrios` (`src/server/crm/greensales-followup.server.ts:681`), imediatamente antes de `openInstance`, consultando o histórico de instâncias via `listInstances` (`src/server/relationship/instances.server.ts`). A regra pura pode viver ao lado de `entry.ts` (ex.: `canOpenReengagementInstance(history)`), mantendo o servidor apenas como leitor.

## D) Regra técnica: "RE → R permitido" x "RE → R já consumido"

Fonte de verdade: as instâncias em `relationship_cadences` (mais os passos executados em `relationship_queue`), sem tabela nova.

```text
R_CONSUMIDO(lead) =
  existe instância com flow = "reengajamento" que
    (a) esteja encerrada (active = false) OU
    (b) tenha ao menos uma etapa R executada (R1/R2/R3 em relationship_queue com executed_at)
  E que tenha nascido DEPOIS do início da rodada de relacionamento vigente

RODADA VIGENTE = instância aberta pela entrada atual
  (E inicial, ou a instância "reentrada" mais recente)

Permitir abrir R quando:
  transição estruturada compromisso → FRIOS
  E NÃO existe instância R ativa
  E NÃO R_CONSUMIDO dentro da rodada vigente
```

Consequências desejadas, todas cobertas:
- E completa sem R → RE → agendamento → FRIOS: nenhuma instância R nasceu **dentro da rodada RE** ⇒ **abre R**.
- E + R concluídos → nova RE → agendamento → FRIOS: a rodada RE atual ainda não tem R... por isso a ancoragem correta é a **rodada de relacionamento**, e não a instância RE isolada: se o par E+R já se completou antes, a nova RE **encerra sem R**. Tecnicamente: marcar, no fechamento do R, o consumo (via `close_reason` da instância R, já existente) e considerar uma RE posterior como continuação da mesma rodada até que um novo ciclo E nasça.
- Duas transições compromisso → FRIOS na mesma rodada: já bloqueadas pelo evento idempotente + instância R ativa.

Decisão pendente para a construção: se "concluir R" deve ser reconhecido por **R3 executado** ou por **qualquer encerramento da instância R** (inclusive resposta do investidor / encerramento humano).

Nada de RF, E, Library, V1/V2/V3, `/s` ou `/seg` é tocado por esta regra.

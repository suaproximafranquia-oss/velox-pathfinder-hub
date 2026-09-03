# Auditoria — execução manual da E0 por origem (TikTok/Meta)

Somente leitura. Nada foi alterado.

## 1. O que está gravado hoje

`workspace_e0_actions.origin` guarda o scope real, em minúsculas. Dados atuais no banco:

```text
greensales  1 PENDENTE
meta        1 PENDENTE
tiktok      1 PENDENTE
```

Ou seja: a origem correta CHEGA na fila. O rótulo só se perde na execução.

## 2. Fluxo atual de uma ação manual TikTok/Meta

```text
executeE0Action (src/server/crm/e0-actions.server.ts)
  → lê a ação (origin = "tiktok" | "meta")
  → executionMode (simulado x real)
  → registerFirstContact({
        origin:      action.origin === "portal" ? "Portal do Investidor" : "GreenSales"   // linha 128
        entryOrigin: action.origin === "portal" ? "PORTAL" : "GREENSALES"                 // linha 129
     })
  → dispatchFirstContact (e0.server.ts) → grava crm_timeline.origin = input.origin
  → engine.handleEvent FIRST_CONTACT_SENT com data.entryOrigin
```

Resultado: tiktok e meta caem no `else` e viram literalmente "GreenSales" / `GREENSALES`.

## 3. Onde a conversão acontece

Um único ponto: `src/server/crm/e0-actions.server.ts`, linhas 128-129 (ternário binário portal/else).

Para comparação, quem alimenta a fila já está correto:
- `portal-first-contact.server.ts:73` grava `origin: input.scope` (tiktok/meta/portal);
- `lead-intake.server.ts:252` grava `greensales`/`portal`.

## 4. Impacto real

Não é só rótulo de tela — há dado persistido:

- `crm_timeline.origin` (e0.server.ts:255) grava a string "GreenSales" para leads TikTok/Meta. Isso é histórico/auditoria e fica errado permanentemente.
- `entryOrigin` alimenta a máquina de estados (`machine.ts:166`): `PORTAL` abre em `E0_V1`, qualquer outra abre em `E0`. Como TikTok/Meta devem abrir em `E0` mesmo, **a etapa de abertura hoje já sai correta por acaso** — não há corrupção de cadência.
- `crm_lead_events`: só é escrito quando `action.crm_lead_id` existe. Para TikTok/Meta é `null`, então nenhum evento é gravado hoje.

Conclusão: o dano concreto é o rótulo de origem gravado na timeline; o motor em si não é desviado.

## 5. Correção mínima recomendada

Uma alteração, num arquivo, sem migration:

`src/server/crm/e0-actions.server.ts` — substituir o ternário por um mapa explícito de origem:

```text
"greensales" → origin "GreenSales"          | entryOrigin GREENSALES
"portal"     → origin "Portal do Investidor"| entryOrigin PORTAL
"tiktok"     → origin "TikTok"              | entryOrigin TRAFEGO_PAGO
"meta"       → origin "Meta"                | entryOrigin TRAFEGO_PAGO
default      → mantém o comportamento atual (GreenSales)
```

`TRAFEGO_PAGO` já existe em `src/lib/relationship/origin.ts` e já resolve abertura em `E0` — nada novo é criado. Se preferir granularidade máxima (TIKTOK/META como valores próprios de `EntryOrigin`), isso é uma mudança maior de tipo e de `resolveInitialStep`, e não é necessária para corrigir o rótulo.

Nenhuma migration é necessária: `workspace_e0_actions.origin` já é texto livre e já contém os valores certos.

## 6. Quem depende de GREENSALES / PORTAL

Busca no código: os únicos consumidores de `entryOrigin` são
`resolveInitialStep` / `normalizeEntryOrigin` (`origin.ts`) e a máquina de estados
(`machine.ts:166`). A regra é binária: `PORTAL` → `E0_V1`; todo o resto → `E0`.
Nenhuma tela, relatório, RLS ou consulta filtra por `entryOrigin === "GREENSALES"`.

## 7. Risco de regressão

Baixo e delimitado:
- GreenSales: continua caindo em `greensales` → mesmo par de valores de hoje.
- Portal: continua em `portal` → `PORTAL` → `E0_V1`, inalterado.
- TikTok/Meta: passam de `GREENSALES` para `TRAFEGO_PAGO`, ambos abrindo em `E0` — mesma etapa, rótulo correto.
- Registros de timeline já gravados como "GreenSales" não são reescritos (não é backfill).

## 8. Auditoria da execução manual

Hoje a auditoria de TikTok/Meta existe em três lugares, todos por `card_id`:
`workspace_e0_actions` (state/executed_at/executed_by/result),
`crm_timeline.investor_id = portal_leads.id` e o snapshot da mensagem.
O identificador correto é o **`card_id` (= `portal_leads.id`)**, não `crm_lead_id`.

Criar `crm_lead_events` para TikTok/Meta exigiria inventar um espelho em `crm_leads`
que hoje não existe — recomendo **não** incluir isso na correção mínima e tratá-lo
como decisão separada.

## Resumo

- Arquivo envolvido: `src/server/crm/e0-actions.server.ts` (linhas 128-129).
- Correção: mapa explícito de origem, ~10 linhas.
- Migration: não.
- Safety Lock: intocada.

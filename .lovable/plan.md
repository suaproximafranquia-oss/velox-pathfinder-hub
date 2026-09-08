# Financeira /f — Leads NOVOS que não chegam ao Workspace

## Resposta (somente leitura — nada foi alterado)

GREENSALES: 36 na origem (35 já espelhados em `crm_leads` na etapa NOVOS; 1 ainda não ingerido)

PORTAL: 21 dos 35 (todos ativos, todos com responsável `usr_thiago`)

WORKSPACE: 21 (card operacional existe exatamente para os mesmos 21)

AÇÃO DO DIA E0: 21 (todos com Ligação 1 — Etapa E0 pendente na fila V2)

LEADS QUE ESTÃO NO PORTAL MAS NÃO NO WORKSPACE: 0 — a perda não é entre Portal e Workspace; é ANTES do Portal. 14 leads NOVOS existem só em `crm_leads` e nunca ganharam espelho no Portal, card nem E0 (59034, 59044, 59050, 59056, 59066, 59076, 59081, 59092, 59096, 59108, 59114, 59148, 59168, 59196).

CAUSA EXATA DO BLOQUEIO:
Os 14 entraram no GreenSales entre 05/09 e 07/09, mas a sincronização só os devolveu hoje, 08/09, às 10:49 e 10:55 UTC (duas execuções do cron: 8 e 15 encontrados, 7 + 7 criados). Ao chegar, o classificador `classifyScannedLead` (`src/lib/crm/sync-classification.ts`, linha 43-49) comparou a data de entrada do lead (`last_register_at` / `register` / `created_at`, dias atrás) com a janela `since` da execução (~10:37 UTC de hoje). Como a data de entrada é anterior à janela, o lead foi classificado como **CASO B — histórico nunca ingerido**, e o `lead-sync.server.ts` (linhas 376-412) o gravou via `upsertLead({ historical: true })`: sem espelho no Portal, sem card, sem E0, `welcome_status = NOT_APPLICABLE` (os 14 têm exatamente essa marca). O caminho único de entrada (`intakeLead`, que cria espelho → card → E0 manual) nunca foi chamado para eles.

Em resumo: um lead NOVO real que a origem entrega com atraso é tratado como carga histórica. O modo MANUAL do E0 não tem participação nenhuma — os 21 que passaram pelo intake ganharam card e E0 manual normalmente.

CORREÇÃO NECESSÁRIA:
1. Regra de classificação: lead ausente do espelho e que está na etapa NOVOS da origem (ou com entrada dentro do corte operacional de 01/09) deve ser CASO A (intake), não B. "Histórico" só quando a entrada for anterior ao corte operacional ou o lead já estiver fora de NOVOS.
2. Reprocessar os 14 pelo caminho único de entrada (`intakeLead`), preservando as datas reais de entrada (05–07/09) — o que cria espelho no Portal, card no Workspace e a E0 manual (Ligação 1 → 10 min → Ligação 2 → Copiar mensagem) na Ação do Dia, atrás do que já está em posição 1.
3. Verificar o 36º lead da origem que ainda não foi ingerido e o erro recorrente do cron ("Follow-up 58992: ON CONFLICT sem constraint"), que hoje não bloqueia NOVOS mas está falhando em toda execução.

## Detalhes técnicos

- Arquivos envolvidos: `src/lib/crm/sync-classification.ts` (classificação A/B), `src/server/crm/lead-sync.server.ts` (ramo B → `upsertLead({historical:true})` vs A/C → `intakeLead`), `src/server/crm/lead-service.server.ts` (linha 325: `historical` ⇒ `NOT_APPLICABLE`).
- Evidência: os 21 com card têm `ingested_at` = `stage_entered_at` (chegaram em tempo real); os 14 sem card têm `stage_entered_at` 05–07/09 e `ingested_at` 08/09 10:49–10:55.
- Nenhuma alteração foi feita nesta análise.

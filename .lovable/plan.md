# Estabilização GreenSales → Portal dos Leads: reconciliação de existência, carga controlada e calendário §16

## Diagnóstico (comprovado por código + HAR + banco)

**Estado medido agora:** origem reporta **554 leads** (HAR, `total=554`, 6 páginas de 100); o espelho `crm_leads` tem **315**; o Workspace tem apenas **17 cards** `gs_*`. Ou seja, ~239 leads existem na origem e não existem no Portal — o caso Reginaldo (ID 54339, 4COF/CONTR) é a prova concreta.

**Causa raiz da ausência (Reginaldo):** a sincronização incremental (`runLeadSync`) varre a base inteira, mas só processa (a) leads com `updated_at` dentro da janela e (b) leads **já presentes no espelho** com coluna divergente. O laço de reconciliação tem a guarda `if (!storedStage.has(externalId)) continue;` — **um lead que nunca foi ingerido é ignorado para sempre** pelo ciclo incremental. Reginaldo (atualizado em 23/07) está fora da janela e nunca entrou no espelho: invisível para os dois caminhos. Só a carga histórica manual (`runGreenSalesBackfill`) o recuperaria — e ela não foi executada após a correção da paginação.

**Contrato real da API (HAR novo):** `POST /lead/list`, `filters.status="allExceptInactive"`, `withs:["Tags","Views","Photo","Forms"]`, `orderby:"register"` (ordenação por atualização é ignorada), paginação `page`/`pagina` + `total_pagina` (100/página comprovado; `per_page` é ignorado). Nosso código já está aderente; apenas `PAGE_SIZE=50` → 100 para eficiência.

**Demais lacunas confirmadas no código:**
- Deduplicação só por `external_id` — **não há segunda trava por telefone normalizado** (§5).
- NÃO LOCALIZADOS roda após varredura "completa", mas **sem prova de completude**: qualquer resposta parcial/inconsistente poderia mover leads em massa (§10/§24).
- **Não existe movimentação manual** "Mover para" no quadro (§12) — busca no código confirma ausência.
- Calendário: E0 hoje opera 07:00–22:30 **todos os dias**; decisão registrada: **aplicar §16** (Sáb 07:00–12:00, Dom fechado). E1+ passa a Seg–Sex 07:00–**22:00** (alinhando ao fechamento 22:00 já existente).
- E30 permanece **integrada mas travada** (`E30_ENABLED=false`) até template oficial aprovado — decisão registrada.

## Classificação explícita de entrada (regra central da correção)

"Lead inexistente no espelho" **NÃO** significa "lead novo". Todo lead vindo da origem é classificado ANTES de qualquer ação, e essa separação fica explícita no código e nos testes:

```text
lead visto na varredura
├─ existe no espelho?
│  ├─ SIM, estágio mudou ........ CASO C: só atualiza o espelho.
│  │                               Sem nova E0, sem reiniciar cadência.
│  └─ SIM, estágio igual ........ CASO D: nenhuma ação desnecessária.
└─ NÃO existe no espelho?
   ├─ entrada recente elegível ... CASO A: lead realmente novo → intake
   │  (janela temporal/cutover)    normal → cria registro → E0 conforme
   │                               regras existentes → cadência normal.
   └─ fora da janela ............. CASO B: histórico ausente do espelho →
                                  recuperação histórica → upsert no estágio
                                  do GreenSales → origem GreenSales →
                                  SEM E0, SEM nova cadência, NUNCA tratado
                                  como lead novo.
```

## O que será feito (mínimo e cirúrgico)

### 1. Reconciliação de existência no ciclo incremental — `src/server/crm/lead-sync.server.ts`
- No laço de reconciliação, remover a guarda que ignora leads ausentes do espelho: lead varrido e **inexistente no espelho** entra no processamento do **CASO B** (`upsertLead` com `historical: true`) — cria o registro, resolve a coluna pelo board, **nunca dispara E0**, não cria cadência nova.
- Leads dentro da janela temporal continuam pelo `intakeLead` (**CASO A**, caminho único, E0 conforme regras atuais) — comportamento de lead novo preservado.
- Casos C e D permanecem exatamente como estão (já implementados em `upsertLead`).
- Métricas novas no sumário e em `crm_sync_runs`: recuperados (criados históricos), atualizados, duplicidades evitadas.

### 2. Segunda trava de deduplicação por telefone — `src/server/crm/lead-service.server.ts`
- Antes de inserir (quando `external_id` não existe no espelho): buscar por `normalizePhone(phone)` já existente na base.
- Encontrou com outro `external_id` → **não cria**; registra evento de duplicidade evitada no lead existente e conta no sumário. Nome/e-mail servem só de terceira validação informativa.
- A mesma trava vale no caminho de intake (um lead duplicado por telefone não gera segundo card nem segunda E0).

### 3. NÃO LOCALIZADOS — somente com varredura comprovadamente completa — `src/server/crm/reconcile.server.ts`
Sem limiar arbitrário. A movimentação para NÃO LOCALIZADOS só executa quando **todas** as condições de completude forem verdadeiras:

- todas as páginas esperadas foram percorridas (página 1 até `last_page`, sem página ausente);
- o **total declarado pela API** é coerente com o total efetivamente processado (soma dos registros por página, descontadas duplicidades de ID);
- nenhuma página retornou erro, vazio inesperado ou resposta parcial;
- nenhuma inconsistência entre `total`, `last_page` e registros recebidos.

Se **qualquer** condição falhar: a reconciliação **aborta somente a movimentação para NÃO LOCALIZADOS**, registra a execução como ERRO com o motivo e **preserva todos os estágios atuais do Portal**. Uma falha transitória jamais transforma leads em NÃO LOCALIZADOS. O backfill e a reconciliação diária passam a compartilhar esta mesma prova de completude.

### 4. Eficiência de paginação — `src/server/greensales.server.ts`
- `PAGE_SIZE` 50 → **100** (contrato comprovado no HAR: 6 páginas para 554) e rastreio da completude da varredura (páginas percorridas, total declarado, total processado) para alimentar o item 3. Nenhuma outra mudança no contrato.

### 5. Calendário §16 — `src/lib/relationship/config.ts` (+ ponto de consumo da janela E0)
- E0: Seg–Sex 07:00–22:30 (inalterado), **Sáb 07:00–12:00**, **Dom fechado** — a exceção "todos os dias" deixa de existir; madrugada 22:30–07:00 continua adiando, nunca cancelando.
- E1+ (e demais etapas): Seg–Sex 07:00–**22:00**, Sáb 07:00–12:00, Dom fechado.
- Domingo/feriado: etapa reagendada para a próxima abertura — nenhuma etapa é perdida.

### 6. Movimentação manual de contingência — `src/components/crm/portal-leads-board.tsx` + nova server fn
Ação "Mover para" disponível em **todos os cards** do quadro, como contingência local:

- altera **somente o espelho local** (`crm_leads.stage_key` + `stage_entered_at`), com salvamento imediato;
- **não chama** a GreenSales e **não altera nada** na origem (somente leitura preservada);
- **não reinicia cadência**, **não cria E0**, **não cria nova cadência**;
- registra a movimentação no histórico/auditoria (evento com ator, estágio anterior, estágio novo e motivo);
- **não vira segunda fonte de verdade**: na próxima sincronização, se a GreenSales estiver no mesmo estágio, o espelho é confirmado e mantido; se a GreenSales estiver em outro estágio, a reconciliação já existente **corrige o espelho para refletir a origem** — sem conflito permanente.

### 7. Carga controlada (uma vez, após os itens 1–4)
- Executar `runCrmBackfillNow` (já existente): varredura completa comprovada → reconciliação → criação histórica dos ausentes (CASO B).
- Resultado esperado: **Reginaldo (54339) criado uma única vez**, etapa 4COF/CONTR, origem GreenSales, **sem E0**; Marcelo permanece em ZERO CONTATO (sem regressão); métricas completas no relatório final.

## O que NÃO será tocado (não-regressão)
Motor de relacionamento estrutural, E0/E1 estruturais, fluxos V/R/RE/RF, E30 (integrada, porém bloqueada para envio real até template oficial aprovado), textos de WhatsApp/Meta (nenhum texto novo inventado), Portal do Investidor, TikTok/Meta, Revista, Reuniões, Alertas, blindagem dos Leads (triggers — nada é apagado), homologação, redistribuição, módulos institucionais.

## Testes de prova
- **Classificação A/B/C/D explícita:** A (novo elegível → intake + E0), B (histórico ausente → criado no estágio da origem, sem E0, sem cadência), C (mudança de estágio → só espelho), D (sem mudança → nenhuma ação).
- **Duplicidade por telefone:** mesmo telefone com `external_id` diferente → sem segundo registro, sem segundo card, sem E0.
- **NÃO LOCALIZADOS:** varredura parcial/inconsistente → aborta e não move ninguém; varredura comprovadamente completa → comportamento atual preservado.
- **Janelas E0:** sábado após 12h e domingo → reagenda; dia útil dentro da janela → executa; madrugada → adiada para 07:00.
- **Movimentação manual:** salva estágio imediato, audita, não reinicia cadência; sync posterior com origem no mesmo estágio mantém; com origem em estágio diferente corrige o espelho.
- **Regressões:** Marcelo (ZERO CONTATO preservado); Reginaldo (54339 presente, único, etapa correta, sem E0).
- **Fluxo E0→E1→E3→E4→E12** comprovado via simulação temporal existente (homologação: transporte simulado, motor íntegro). E30: presença estrutural no fluxo validada; fora da fila real até template oficial.
- **Carga controlada real** com métricas: encontrados na origem / existentes / criados / atualizados / duplicidades evitadas / ignorados / erros.

## Critérios de aceite
Reginaldo no Portal (único, etapa correta, sem E0 nova); Marcelo sem regressão; novos leads GreenSales aparecem e recebem E0 conforme janela; E1 bloqueada em NOVOS e elegível após saída; nenhum lead apagado ou movido a NÃO LOCALIZADOS por falha parcial; movimentação manual local funcionando exatamente como contingência; duplicidades impedidas pelas duas chaves; build/typecheck e testes passando; nenhum módulo homologado alterado.

## Relatório final obrigatório
Causa raiz; arquivos alterados; métricas da reconciliação (encontrados/existentes/criados/atualizados/duplicados/ignorados); confirmação Reginaldo e Marcelo; resultado de cada teste de prova; riscos restantes; build e contagem de testes.

## Detalhes técnicos
- Arquivos: `src/server/crm/lead-sync.server.ts`, `src/server/crm/lead-service.server.ts`, `src/server/crm/reconcile.server.ts`, `src/server/greensales.server.ts`, `src/lib/relationship/config.ts`, `src/lib/crm/e0-window.ts` (janela E0 por dia), `src/components/crm/portal-leads-board.tsx`, nova server fn em `src/lib/crm/leads.functions.ts`, testes (vitest).
- Prova de completude da varredura: `fetchAllLeads`/`fetchLeadsSince` passam a devolver `{ pagesExpected, pagesScanned, totalReported, totalProcessed, complete }`; a reconciliação de NÃO LOCALIZADOS só roda com `complete === true`.
- Nenhuma migration estrutural necessária; se um tipo novo de evento for exigido pelo enum de `crm_lead_events` (ex.: "movimentacao_manual", "duplicidade_evitada"), será migration mínima e isolada, sem tocar em dados.
- Nenhuma alteração destrutiva: nada é apagado, nenhum histórico é perdido, GreenSales permanece somente leitura.

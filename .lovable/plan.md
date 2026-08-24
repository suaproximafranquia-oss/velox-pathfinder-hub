# Estabilização GreenSales → Portal dos Leads: reconciliação de existência, carga controlada e calendário §16

## Diagnóstico (comprovado por código + HAR + banco)

**Estado medido agora:** origem reporta **554 leads** (HAR, `total=554`, 6 páginas de 100); o espelho `crm_leads` tem **315**; o Workspace tem apenas **17 cards** `gs_*`. Ou seja, ~239 leads existem na origem e não existem no Portal — o caso Reginaldo (ID 54339, 4COF/CONTR) é a prova concreta.

**Causa raiz da ausência (Reginaldo):** a sincronização incremental (`runLeadSync`) varre a base inteira, mas só processa (a) leads com `updated_at` dentro da janela e (b) leads **já presentes no espelho** com coluna divergente. O laço de reconciliação tem a guarda `if (!storedStage.has(externalId)) continue;` — **um lead que nunca foi ingerido é ignorado para sempre** pelo ciclo incremental. Reginaldo (atualizado em 23/07) está fora da janela e nunca entrou no espelho: invisível para os dois caminhos. Só a carga histórica manual (`runGreenSalesBackfill`) o recuperaria — e ela não foi executada após a correção da paginação.

**Contrato real da API (HAR novo):** `POST /lead/list`, `filters.status="allExceptInactive"`, `withs:["Tags","Views","Photo","Forms"]`, `orderby:"register"` (ordenação por atualização é ignorada), paginação `page`/`pagina` + `total_pagina` (100/página comprovado; `per_page` é ignorado). Nosso código já está aderente; apenas `PAGE_SIZE=50` → 100 para eficiência.

**Demais lacunas confirmadas no código:**
- Deduplicação só por `external_id` — **não há segunda trava por telefone normalizado** (§5).
- NÃO LOCALIZADOS roda após varredura completa, mas **sem trava de sanidade**: uma resposta parcial/200 com poucas páginas moveria em massa (§10/§24).
- **Não existe movimentação manual** "Mover para" no quadro (§12) — busca no código confirma ausência.
- Calendário: E0 hoje opera 07:00–22:30 **todos os dias**; decisão registrada: **aplicar §16** (Sáb 07:00–12:00, Dom fechado). E1+ passa a Seg–Sex 07:00–**22:00** (alinhando ao fechamento 22:00 já existente).
- E30 permanece **integrada mas travada** (`E30_ENABLED=false`) até template oficial aprovado — decisão registrada.

## O que será feito (mínimo e cirúrgico)

### 1. Reconciliação de existência no ciclo incremental — `src/server/crm/lead-sync.server.ts`
- No laço de reconciliação, remover a guarda que ignora leads ausentes do espelho: lead varrido e **inexistente no espelho** entra no processamento como **recuperação histórica** (`upsertLead` com `historical: true`) — cria o registro, resolve a coluna pelo board, **nunca dispara E0** e não cria cadência nova.
- Leads dentro da janela temporal continuam pelo `intakeLead` (caminho único, E0 conforme regras atuais) — comportamento de lead novo preservado.
- Métricas novas no sumário e em `crm_sync_runs`: recuperados (criados históricos), atualizados, duplicidades evitadas.

### 2. Segunda trava de deduplicação por telefone — `src/server/crm/lead-service.server.ts`
- Antes de inserir (quando `external_id` não existe no espelho): buscar por `normalizePhone(phone)` já existente na base.
- Encontrou com outro `external_id` → **não cria**; registra evento de duplicidade evitada no lead existente e conta no sumário. Nome/e-mail servem só de terceira validação informativa.
- A mesma trava vale no caminho de intake (um lead duplicado por telefone não gera segundo card nem segunda E0).

### 3. Trava de sanidade do NÃO LOCALIZADOS — `src/server/crm/reconcile.server.ts`
- A movimentação para NÃO LOCALIZADOS só executa se a varredura for **comprovadamente completa**: se o total varrido for menor que um limiar de sanidade (ex.: < 50% do espelho conhecido), a reconciliação **aborta**, marca a execução como ERRO e **não move ninguém**. Falha transitória nunca mais transforma leads em não localizados.

### 4. Eficiência de paginação — `src/server/greensales.server.ts`
- `PAGE_SIZE` 50 → **100** (contrato comprovado no HAR: 6 páginas para 554). Nenhuma outra mudança no contrato.

### 5. Calendário §16 — `src/lib/relationship/config.ts` (+ ponto de consumo da janela E0)
- E0: Seg–Sex 07:00–22:30 (inalterado), **Sáb 07:00–12:00**, **Dom fechado** — a exceção "todos os dias" deixa de existir; madrugada 22:30–07:00 continua adiando, nunca cancelando.
- E1+ (e demais etapas): Seg–Sex 07:00–**22:00**, Sáb 07:00–12:00, Dom fechado.
- Domingo/feriado: etapa reagendada para a próxima abertura — nenhuma etapa é perdida.

### 6. Movimentação manual de contingência — `src/components/crm/portal-leads-board.tsx` + nova server fn
- Ação "Mover para" em cada card do quadro: escolhe a coluna destino; persiste em `crm_leads` (`stage_key`, `stage_entered_at`) com evento auditado ("movimentacao_manual", ator e motivo).
- Contingência **local**: não chama o GreenSales, **não reinicia cadência**, **não dispara E0**. Na próxima sincronização, o espelho volta a refletir a origem se houver divergência (comportamento já existente).

### 7. Carga controlada (uma vez, após os itens 1–4)
- Executar `runCrmBackfillNow` (já existente): varredura completa → reconciliação → criação histórica dos ausentes.
- Resultado esperado: **Reginaldo (54339) criado uma única vez**, etapa 4COF/CONTR, origem GreenSales, **sem E0**; Marcelo permanece em ZERO CONTATO (sem regressão); métricas completas no relatório final.

## O que NÃO será tocado (não-regressão)
Motor de relacionamento estrutural, E0/E1 estruturais, fluxos V/R/RE/RF, E30 (travada até template), Portal do Investidor, TikTok/Meta, Revista, Reuniões, Alertas, blindagem dos Leads (triggers), homologação, redistribuição, módulos institucionais.

## Testes de prova
- **Automatizados (vitest):** reconciliação de existência (ausente → criado histórico sem E0); duplicidade por telefone (sem segundo registro/sem E0); trava de sanidade (varredura parcial não move ninguém); janelas E0 (sábado após 12h e domingo → reagenda; dia útil dentro da janela → executa); regressão Marcelo (ZERO CONTATO preservado); Reginaldo (54339 presente, único, etapa correta); movimentação manual (atualiza espelho, não reinicia cadência, sync posterior reflete origem).
- **Fluxo E0→E1→E3→E4→E12** comprovado via simulação temporal existente (homologação: transporte simulado, motor íntegro). E30: presença estrutural no fluxo validada; fora da fila real até template oficial.
- **Carga controlada real** com métricas: encontrados na origem / existentes / criados / atualizados / duplicidades evitadas / ignorados / erros.

## Critérios de aceite
Reginaldo no Portal (único, etapa correta, sem E0 nova); Marcelo sem regressão; novos leads GreenSales aparecem e recebem E0 conforme janela; E1 bloqueada em NOVOS e elegível após saída; nenhum lead apagado ou movido a NÃO LOCALIZADOS por falha parcial; movimentação manual local funcionando; duplicidades impedidas pelas duas chaves; build/typecheck e testes passando; nenhum módulo homologado alterado.

## Relatório final obrigatório
Causa raiz; arquivos alterados; métricas da reconciliação (encontrados/existentes/criados/atualizados/duplicados/ignorados); confirmação Reginaldo e Marcelo; resultado de cada teste de prova; riscos restantes; build e contagem de testes.

## Detalhes técnicos
- Arquivos: `src/server/crm/lead-sync.server.ts`, `src/server/crm/lead-service.server.ts`, `src/server/crm/reconcile.server.ts`, `src/server/greensales.server.ts`, `src/lib/relationship/config.ts`, `src/lib/crm/e0-window.ts` (janela E0 por dia), `src/components/crm/portal-leads-board.tsx`, nova server fn em `src/lib/crm/leads.functions.ts`, testes em `src/lib/**`/`src/server/**` (vitest).
- Nenhuma migration necessária (eventos usam tipos existentes em `crm_lead_events`; se um tipo novo de evento for exigido pelo enum, será migration mínima e isolada).
- Nenhuma alteração destrutiva: nada é apagado, nenhum histórico é perdido, GreenSales permanece somente leitura.

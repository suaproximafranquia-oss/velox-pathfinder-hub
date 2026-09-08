# DIAGNÓSTICO — follow_up do GreenSales x coluna VÍDEO (somente Financeira /f)

Nenhum código, banco, migration ou teste foi alterado. Diagnóstico de leitura.

## Achado central (muda o enunciado da pergunta)

No GreenSales, "agendamento" e "vídeo chamada" **não são duas colunas de dados do lead**: são duas **colunas do quadro (etapas)**. O campo de horário é **um só**: `follow_up`.

Confirmado no banco (`crm_pipeline_stages`):

```text
position 4  key=agendamentos  label=AGENDAMENTOS  external_tag=28
position 6  key=video         label=VÍDEO         external_tag=27
```

E existem hoje leads reais parados na coluna VÍDEO **com follow_up preenchido e ignorados**:

```text
59056  Marcelo Lira   stage_key=video  follow_up=2026-09-10 15:00:00
57239  Yuri Araújo    stage_key=video  follow_up=2026-08-27 20:00:00
```

## A) O QUE O SISTEMA FAZ HOJE

A cada rodada de sincronização, ao final de `runLeadSync`, o Portal varre os leads GreenSales cujo `stage_key = 'agendamentos'`, lê o campo `follow_up`, interpreta o horário em America/Sao_Paulo e espelha um único registro em `portal_meetings` (criar / atualizar / cancelar / nada). Fora de AGENDAMENTOS, nada é criado; e se o lead sai de AGENDAMENTOS com espelho pendente, o compromisso é **cancelado** (`CANCELADO_SAIDA_AGENDAMENTOS`).

## B) ONDE O CÓDIGO CONSULTA O FOLLOW_UP

- `src/server/crm/lead-sync.server.ts` (~linhas 496-511): coleta `follow_up` da listagem da origem e chama `syncGreenSalesFollowUps(overrides)`.
- `src/server/crm/greensales-followup.server.ts`: `syncGreenSalesFollowUps` (busca `crm_leads` com `.eq("stage_key", AGENDAMENTOS_STAGE)`), `syncOneFollowUp`, `loadMirror`, gravação em `portal_meetings`.
- `src/lib/crm/greensales-followup.ts`: `planFollowUpSync` (regra pura), `parseFollowUp`, `followUpExternalRef`, `followUpMeetingId`.

## C) QUAL CAMPO É CONSULTADO HOJE

Um único campo: `raw_payload->>'follow_up'` (ou o override vindo da listagem). A elegibilidade vem de `stage_key === 'agendamentos'` — comparação literal em `planFollowUpSync`.

## D) COMO "VÍDEO CHAMADA" É TRATADA HOJE

Não é tratada. A etapa `video` existe no quadro e é espelhada em `crm_leads.stage_key`, mas nenhum ponto do código de follow-up, agenda ou Ação do Dia menciona essa etapa. O lead em VÍDEO cai no ramo `ignore` ("Lead fora de AGENDAMENTOS").

## E) O CAMPO JÁ CHEGA NA SINCRONIZAÇÃO?

Sim, integralmente. O `follow_up` já chega e já é armazenado para os leads em VÍDEO (evidência acima). Não falta dado, falta leitura.

## F) portal_meetings JÁ SUPORTA OS DOIS TIPOS?

Estruturalmente sim, sem migration obrigatória. A tabela tem `topic`, `origin`, `external_source`, `external_ref`, `meeting_provider`, `meet_url`, `notes (jsonb)`. Não existe campo dedicado de **modalidade**. Hoje o tipo é implícito em `topic = "Agendamento (GreenSales)"`. Identificar videochamada pode ser feito por `topic` (ex.: "Videochamada (GreenSales)") — zero alteração estrutural — ou, se quiser filtro estruturado, uma coluna `meeting_kind` seria a extensão mínima e aditiva.

## G) RISCO DE DUPLICIDADE

Nenhum. A identidade é por lead, não por coluna: `external_ref = f:greensales:lead:<externalId>:follow_up` e `id = gsfu_<externalId>`, com índice único `portal_meetings_external_ref_uidx (external_source, external_ref)` e upsert `ignoreDuplicates`. Como o horário vem de um único `follow_up`, é impossível gerar dois compromissos para o mesmo lead — o registro é o mesmo, mude o lead de AGENDAMENTOS para VÍDEO ou vice-versa.

## H) CASO "AGENDAMENTO + VÍDEO CHAMADA"

Não existe esse caso no modelo real: o lead ocupa **uma** coluna por vez e possui **um** `follow_up`. Portanto não há dois compromissos a fundir. Se o lead migrar de AGENDAMENTOS para VÍDEO mantendo o mesmo horário, o mesmo registro seria reaproveitado.

## I) CASO "SOMENTE VÍDEO CHAMADA"

Hoje: nada acontece (ramo `ignore`). Pior: se o lead estava em AGENDAMENTOS com espelho pendente e é movido para VÍDEO, o compromisso existente é **cancelado** como se tivesse saído do fluxo — este é o efeito colateral mais relevante do estado atual.

## J) MENOR ALTERAÇÃO NECESSÁRIA

Tratar VÍDEO como uma segunda etapa elegível do mesmo mecanismo:

1. `greensales-followup.ts`: constante `VIDEO_STAGE = "video"` e um conjunto de etapas elegíveis; `planFollowUpSync` passa a aceitar as duas, devolvendo também a modalidade (`AGENDAMENTO` | `VIDEOCHAMADA`) derivada do `stage_key`.
2. `greensales-followup.server.ts`: consulta com `.in("stage_key", [...])` em vez de `.eq(...)`; `topic` conforme a modalidade; troca de coluna entre as duas etapas vira **atualização de modalidade**, não cancelamento.
3. Sem nova fila, motor, tabela ou agenda. O mesmo `portal_meetings` alimenta a mesma Ação do Dia e a mesma prioridade/foco.

## K) ARQUIVOS/FUNÇÕES REALMENTE ENVOLVIDOS

- `src/lib/crm/greensales-followup.ts` — `planFollowUpSync`, constantes de etapa.
- `src/server/crm/greensales-followup.server.ts` — `syncGreenSalesFollowUps`, `syncOneFollowUp`, `MIRROR_TOPIC`.
- (opcional, só apresentação) rótulo do card em `src/server/crm/daily-actions.server.ts` / `daily-action-card.tsx`.

## L) O QUE NÃO PRECISA SER ALTERADO

Ação do Dia, `relationship_queue`, motor V2, Biblioteca, E0/E4/E7/E8, R1–R4, Central de Operações, Central dos Nomes, GreenSales (leitura), estrutura de `portal_meetings`, Safety Lock, `/s`, `/s/portal`, `/seg`.

## Itens 22-25

- **22. Sincronização:** a atualização é amarrada ao par (lead, `follow_up`), não à coluna. Passa a funcionar igual para VÍDEO assim que a etapa for elegível.
- **23. Cancelamento:** hoje some o `follow_up` → `CANCELADO_ORIGEM`. Mesma estrutura serve para VÍDEO sem nada novo.
- **24. Reagendamento:** já é genérico (compara `scheduled_at` e o texto bruto do `follow_up`); só o filtro de etapa é específico.
- **25. T-5:** a constante `FOLLOW_UP_FOCUS_MINUTES = 5` e o foco da Ação do Dia atuam sobre o registro de `portal_meetings`, sem olhar a etapa de origem — videochamada usaria exatamente a mesma prioridade.

## RESPOSTAS FINAIS

1. **Hoje o Portal olha somente a coluna agendamento?** Sim. A elegibilidade é `stage_key = 'agendamentos'`, literal, em um único ponto.
2. **A coluna vídeo chamada já chega ao Portal?** Sim. A etapa VÍDEO já está mapeada e o `follow_up` desses leads já está gravado — só não é lido.
3. **Dá para reaproveitar a mesma lógica sem segundo motor?** Sim. É trocar uma comparação de etapa por um conjunto de etapas elegíveis e carregar a modalidade; tudo desemboca no mesmo `portal_meetings` e na mesma Ação do Dia.

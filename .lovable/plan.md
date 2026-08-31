# Fotografia técnica — GreenSales → Lead → Motor → E0 → Biblioteca → Envio

Auditoria somente leitura. Nenhum código, dado, vínculo ou configuração foi alterado.

## 1. Fonte real das mensagens

A fonte de verdade é a tabela `relationship_message_library` (escopo `production`), lida por `getActiveLibraryMessage` / `renderFromLibrary` (`src/server/relationship/message-library.server.ts`). Uma única versão ativa por `step_key`; editar publica versão nova e desativa a anterior. `HOMOLOGATION_MESSAGES` (`src/lib/relationship/messages.ts`) só é semente da v1 e `CONTENT_GROUPS` não é mais lido pelo motor.

Estado real no banco (25 etapas ativas, 56 versões):

| Chave | v ativa | Título gravado | Botão | Situação do texto |
|---|---|---|---|---|
| E0 | 4 | "E0 — Primeiro contato" | portal | texto real, com nome do executivo fixo |
| E0_V1 | 3 | "E1 — Primeiro acompanhamento" | portal | texto real, rótulo trocado |
| E1 | 3 | "E2 — Segundo acompanhamento" | content | texto real, rótulo trocado |
| E3, E4, E12, E20, E27, R1, R2, R3, FINALIZACAO | 2–3 | rótulos deslocados (R1/R2/RF0/RE2…) | vários | texto real |
| E2, E5, E6, E7 (aliases do Word) | 2 | rótulos do Word | — | **ativos**, embora o código os declare legado inativo |
| RE1, RE2, RE3, RF0, RF1, V3, V4, RESPOSTA_AUTOMATICA | 2 | "Liberado para novas mensagem" | vários | **corpo = "Liberado para novas mensagem" (28 caracteres)** |

Ordem e rótulos de apresentação vêm de `WORD_STEP_ORDER` + `DEFAULT_STEP_LABELS` (`step-labels.ts`); a ordem de execução vem de `FLOW_SEQUENCE`/`STEPS` (`src/lib/relationship/config.ts`), que é a única fonte de intervalos e finalidade.

## 2. Como o motor escolhe a mensagem e o momento

`createEngine` (`src/lib/relationship/engine.ts`) aplica o evento em `machine.ts`, e `decideNextAction` (`decide.ts`) devolve a próxima etapa: primeira não executada de `FLOW_SEQUENCE[flow]`, respeitando ordem, `executedSteps`, estado bloqueante, etapa terminal (OPORTUNIDADE), `awaitingFirstHumanAction` (em NOVOS só E0/E0_V1) e o vencimento em dias úteis (`businessDaysAfterReference` a partir da saída de NOVOS ou da última interação). O executor é `scheduler.server.ts` (lote de 200, disparado pelo cron junto da sincronização); a entrega é `dispatch.server.ts`.

## 3–4. Versão COM NOME / SEM NOME e regra do primeiro nome

Decisão em `renderFromLibrary`: `resolveTreatment` (`names.ts`) → se `personalized` usa `body`, senão usa `body_without_name` quando existir. Prioridade: nome confirmado pelo executivo → nome informado pelo executivo → nome bruto reconhecido pela base (`name-base.ts`) → fallback "caro investidor". `normalizeName` remove dígitos/símbolos e capitaliza; `firstName` pega a primeira palavra; nome composto só sai completo quando as duas palavras estão na base. Origem do nome bruto: `portal_leads.name` (fallback `crm_leads.name`) em `dispatch.server.ts` / `step-message.server.ts`; na E0, o `name` que veio da entrada.

**Porém**: nenhum texto ativo da Biblioteca contém `{{nome_investidor}}` — todos usam o literal `[nome]`/`[Nome]`. Como `renderMessageSpec` só substitui `{{...}}`, o tratamento é calculado e gravado no snapshot, mas o investidor recebe "Olá, [nome]".

## 5. Central de Nomes

Não existe. A lógica hoje vive em `src/lib/relationship/names.ts` (+ base em `name-base.ts`), consumida por `renderFromLibrary` e `renderMessageSpec`. É esse o ponto de entrada de uma futura Central. Não implementado nesta rodada.

## 6. Acentos

`foldName` remove diacríticos **apenas para comparação** com a base. O texto enviado usa `normalizeName`/`displayName`, que preservam a acentuação original do cadastro.

## 7–9. E0, link e WhatsApp do executivo

`registerFirstContact` (elegibilidade, cutover, janela noturna, chave `welcomeEnabled`) → `dispatchFirstContact` (`e0.server.ts`). Destinos por `resolveLeadDestinations` com `portalRequired: true`, `contactRequired: false`: o link do Portal é `investorPortalUrl(slug do executivo responsável)`; sem slug a E0 é bloqueada e logada em `relationship_engine_log` (`e0_bloqueada`). O WhatsApp do executivo (`executive_profiles`, via `resolveLeadExecutive`) é destino do **botão de contato** do template — sem ele a E0 é criada e registrada e só a entrega externa fica pendente. Texto: v4 ativa da Biblioteca; template Meta: `crm_meta_templates` com `purpose = primeiro_contato` e status aprovado — **a tabela está vazia hoje**, então toda E0 real cai em "Template oficial da Meta para a E0 não cadastrado — entrega externa pendente".

## 10–11. Estados de mensagem e horário

- criada = render OK; registrada = `INSERT crm_messages` com id determinístico `msg_e0_<lead>` / `msg_<etapa>_<lead>`; tentativa = chamada da Graph API; aceito pelo provedor = HTTP 2xx (`delivered: true`); entrega efetiva ao aparelho = **não existe** (nenhum consumo de webhook de status `delivered/read`); falha = `delivered: false` + motivo em `crm_timeline` e `relationship_engine_log`.
- `crm_messages.at`, `crm_timeline.at` e o `sent_at` do snapshot recebem o mesmo `new Date()` capturado **antes** da chamada à Meta: representam decisão/registro, não aceite nem entrega.

## 12–13. Cadência e reprocessamento

Nasce em `FIRST_CONTACT_SENT` (E0) ou `LEAD_CREATED` com `reentry`. Avança por tempo (dias úteis) e por evento; `MESSAGE_RECEIVED`, `SCHEDULE_CREATED`, interrupção manual e encerramento cancelam a fila. Duplicidade é barrada em três camadas: `executedSteps`, PK determinística da mensagem (erro 23505 → "envio duplicado evitado") e a fila `relationship_queue`. O reprocessamento é `bootstrapMissingCadences`, que lê os 200 `msg_e0_%` mais recentes e reemite o evento com id fixo `e0_<lead>` — cria estado, não mensagem. Risco de lote existe apenas se a Biblioteca tiver texto errado ativo (ver item 22).

## 14. Logs

`relationship_engine_log` grava `etapa_enviada`, `etapa_simulada`, `envio_bloqueado`, `envio_duplicado_evitado`, `etapa_desconhecida`, `e0_bloqueada` (lead, etapa, motivo, template, conteúdo, entregue, erro, bloqueadores, executivo). Snapshot imutável em `relationship_message_sends`; leitura humana em `crm_timeline`.

## 15. GreenSales

`fetchPage` com `status: allExceptInactive`, `withs: [Tags, Forms]`, `total_pagina: 100`, sem parada precoce. Espelho `crm_leads`; card operacional `portal_leads` (`gs_<external_id>`). Mudança de coluna é detectada por comparação de `stage_key`; quando a listagem não traz etiquetas, há verificação por detalhe limitada a **80 leads por execução** — acima disso a mudança daquele ciclo não é vista (fica para o próximo). Lead ausente do espelho entra como histórico (sem E0).

## 16–21. Biblioteca × motor

Vínculo real: `relationship_step_content_bindings` (ativo, com `position`). `relationship_content_groups` está congelado e não é lido. `loadStepContentBindings` só devolve vínculo explícito quando a etapa tem exatamente 1 conteúdo; com N, rotação determinística por posição/data/id. Sem vínculo não há sorteio nem inferência — hoje existem 4 vínculos ativos (E1, E3, E4, R2) para 17 conteúdos. Adicionar, trocar, limpar e desativar funcionam por desativação (nada é apagado). Etapas presentes na Biblioteca que o motor não executa: `E2`, `E5`, `E6`, `E7` (aliases do Word, deveriam estar inativos) e `E0_V1`/`V3`/`V4` (legado). Etapas do motor sem texto utilizável: `RE1`, `RE2`, `RE3`, `RF0`, `RF1`, `V3`, `V4`, `RESPOSTA_AUTOMATICA`, e `E30` (sem texto, desativada por `E30_ENABLED`).

## 22–23. Inconsistências

| # | Grav. | Arquivo → função | Causa | Comportamento hoje | Correção necessária |
|---|---|---|---|---|---|
| 1 | CRÍTICA | `relationship_message_library` (dados) × `messages.ts → renderMessageSpec` | textos ativos usam `[nome]` em vez de `{{nome_investidor}}` | investidor recebe "Olá, [nome]"; toda a regra de nome vira decorativa | republicar versões com as variáveis oficiais |
| 2 | CRÍTICA | Biblioteca (dados), etapas RE1–RF1, V3, V4, RESPOSTA_AUTOMATICA | versão ativa com corpo "Liberado para novas mensagem" | se o fluxo chegar nessas etapas, sai essa frase para o investidor | despublicar/republicar texto oficial |
| 3 | CRÍTICA | Biblioteca (dados), E0 v4 | nome do executivo escrito no texto, sem `{{nome_executivo}}` | toda E0 assina "Thiago Rodrigues", qualquer que seja o responsável | reintroduzir a variável |
| 4 | IMPORTANTE | Biblioteca (dados), etapas com `content` | corpo sem `{{conteudo_*}}` | conteúdo vinculado nunca é anexado e nada bloqueia | restaurar o marcador nos textos de conteúdo |
| 5 | IMPORTANTE | `crm_meta_templates` vazio → `e0-template.server.ts` | nenhum template aprovado cadastrado | E0 registrada, entrega externa sempre pendente | cadastrar o template aprovado |
| 6 | IMPORTANTE | Biblioteca (dados) — títulos | rótulos deslocados uma etapa (E1 exibido como "E2") | operação lê etapa errada na tela | corrigir só os títulos (não gera versão) |
| 7 | IMPORTANTE | Biblioteca — `E2/E5/E6/E7` ativos | importação do Word criou aliases executáveis | duplicam textos das chaves reais | desativar mantendo histórico |
| 8 | IMPORTANTE | `e0.server.ts`, `dispatch.server.ts` | `at` gravado antes da chamada à Meta e sem webhook de status | CRM mostra "enviado" para o que foi só registrado | separar registrado / aceito / entregue |
| 9 | BAIXA | Biblioteca — `E0_V1.body_without_name` | versão "sem nome" contém `[nome]` | variante sem nome também sai errada | corrigir junto do item 1 |
| 10 | BAIXA | `lead-sync.server.ts` — `DETAIL_CHECK_LIMIT = 80` | teto por execução | mudança de coluna pode atrasar um ciclo | tornar o teto observável |

## 24. Correto — não alterar

Versionamento imutável e proteção de texto editado manualmente na reimportação do Word; snapshot congelado em `relationship_message_sends`; idempotência por PK determinística e por `executedSteps`; "sem vínculo é sem vínculo" em `step-media.server.ts`; `step-registry` recusando etapa desconhecida; guardas de destinatário (`guard.server.ts`) e ambiente antes de credencial (`execution-mode`); slug do Portal resolvido pelo executivo responsável; WhatsApp do executivo como pendência de entrega, nunca bloqueio; paginação completa e reconciliação do GreenSales.

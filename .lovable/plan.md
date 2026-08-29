# Refino Final — Etapas 1, 2 e 3 (pré-homologação)

Consolidação da Bateria 3/3. Nada aqui foi implementado ainda.

## Bloqueantes reais (impedem homologação)

1. **Chave de OPORTUNIDADE divergente.** O banco grava `stage_key = "oportunidades"` (36 leads), o código considera terminal apenas `"oportunidade"` (`src/lib/relationship/closing.ts` → `TERMINAL_STAGES`). Consequência: `terminalStageLeadIds()` retorna vazio, `reconcileOpportunityClosures` não encerra nada e E27/Finalização poderiam nascer para leads já em OPORTUNIDADE. Correção só em código: aceitar as duas grafias na leitura e padronizar a gravação nova.
2. **Todos os 7 executivos com WhatsApp vazio** em `executive_profiles.whatsapp`. Sem isso, E0, E20, E27, Finalização e resposta automática ficam bloqueadas por `resolveLeadExecutive`. Exige dado do usuário.
3. **Textos oficiais ausentes:** `E20`, `E27`, `FINALIZACAO` e `RESPOSTA_AUTOMATICA` existem na Biblioteca mas com `active = false` (sem texto). Exige conteúdo do usuário.
4. **Etapas ativas sem vínculo de conteúdo:** `E12`, `V4`, `R3`, `RE0`, `RE3`, `RF0`, `RF1` têm mensagem ativa e zero linha em `relationship_step_content_bindings`.
5. **E0 sem WhatsApp ainda não bloqueia integralmente** (decisão travada na Bateria 2). `resolveDestinations` só bloqueia quando `contactRequired = true`; se o template não exigir botão, o envio segue.

## Ajustes importantes (não bloqueantes)

- `nextBusinessDay` de `src/server/relationship/e20.server.ts` usa `getUTCDay()`/`toISOString()` — deve usar o calendário oficial (`src/lib/relationship/calendar.ts`, America/São Paulo).
- `RELATIONSHIP_CONFIG.nonBusinessDays` está vazio: feriados nacionais + estaduais SP precisam ser cadastrados e editáveis.
- `usage_count` da Biblioteca nunca é incrementado no envio; contagem deve registrar apenas envio efetivo (fora: simulação, bloqueio, falha, retry repetido).
- `importWordLibrary` continua exposto por `src/lib/relationship/library.functions.ts` e pode sobrescrever edições manuais mesmo sem botão na tela — precisa de trava explícita.
- Rótulo visual de `FINALIZACAO` ainda não definido pelo usuário.
- Obrigação bloqueada por texto ausente aparece na Ação do Dia sem estado próprio "bloqueada".

## Legados removíveis com segurança

`processWelcome` (`src/server/crm/automation.server.ts`), `retryCrmWelcome` + botão em `portal-leads-board.tsx`, `src/lib/responsible-executive.ts`, `getDefaultExecutive` em `whatsapp-floating.tsx`/`executive-data.ts`, e o telefone repetido `5517997727337` nos 7 `SEED_USERS` de `src/lib/executive-auth.ts`.

## Migrations

Necessária: nenhuma estrutural. Padronização de `stage_key` (`oportunidades` → leitura dupla) pode ser feita só em código; se optarmos por normalizar dados, é UPDATE controlado com registro de auditoria.
Proibidas: qualquer alteração em `portal_leads`, `crm_leads` (histórico), `relationship_message_sends` (snapshots), `relationship_e20_occurrences` já fechadas, tabelas do Portal dos Leads e GreenSales.

## Testes obrigatórios antes do reset

E27/Finalização (idempotência por ocorrência, retry, dois ticks), OPORTUNIDADE entre E20→E27 e E27→Finalização, webhook duplicado, ausência de WhatsApp, feriados e virada de meia-noite em America/São Paulo, resposta automática (1/24h, máx 2, reset 30 dias).

## Decisões pendentes do usuário

1. Textos oficiais E20, E27, Finalização e Resposta Automática.
2. Rótulo visual da etapa Finalização.
3. Conteúdos das 7 etapas sem vínculo.
4. Obrigação bloqueada: visível com selo ou oculta.
5. CRM manual permanece com `CRM_TEMPLATES` ou migra para a Biblioteca.
6. Responsável na resposta automática/E27: congelado na ocorrência ou recalculado.
7. Simulação consome (ou não) o histórico de rotação de conteúdo.

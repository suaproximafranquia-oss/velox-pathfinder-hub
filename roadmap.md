# Roadmap

- [x] Cobrir workspace_e0_actions no backup (capturar + nunca restaurar)
- [x] Modo Demonstração da Ação do Dia (overlay agnóstico + fixture em memória + rota /f/executivo/acao-do-dia-demo)
- [x] Central de Homologação (abas Motor + Ação do Dia Demo) e fotografia temporária das etapas (Word deixa de ser fonte operacional)
- [x] Landing institucional do Grupo Velox na rota / (componentes isolados em src/components/group/landing)
- [ ] FASE 1 — Fundação de identidade canônica (investors + investor_identifiers + vínculos investor_id, aditiva, sem alterar operação)
- [x] Alavanca 1 de homologação — mover `cadence_activation_date` da Financeira para o marco oficial (2026-09-03), medindo a Ação do Dia antes/depois (sem reset destrutivo)
- [ ] Teste controlado pós-corte: 1 lead fictício com responsável definido (Thiago) e E0 Automático — BLOQUEADO: o laboratório atual cria o lote sem responsável (intakeLead sem connectionUserId), o que força E0 Manual

## E0 fora da janela (04/09)
- [x] Card criado antes da trava de janela no intakeLead (responsável + is_test preservados)
- [x] processDeferredFirstContacts reutiliza card, preserva responsável/teste e respeita Automático x Manual
- [x] Corrigir telefone sintético do Laboratório para ser único por `batchId + índice`
- [ ] Segundo lead de teste dentro da janela (a criar manualmente)

## Bloco 1 — Marco operacional + contato real (05/09)
- [x] `operational_since` no ciclo (`relationship_cadences`) e função única `classifyCycle`/`isOperationalCycle` em `src/lib/relationship/cycle.ts`
- [x] Motor deixa de gerar obrigação nova em ciclo histórico (evaluate + scheduleFollowUp)
- [x] Ação do Dia ignora fila de ciclo histórico (`listHistoricalCycleLeadIds`)
- [x] Definição única de CONTATO HUMANO REAL (`human-contact.ts` + `human-contact.server.ts`, somente leitura)
- [ ] Bloco 2 — itens de fila sem ciclo registrado, histórico de titularidade e redistribuição

## Bloco 2 — Identidade canônica + titularidade + redistribuição GreenSales (05/09)
- [x] `executive_profiles.greensales_vendor_id`: responsável vem da ORIGEM (`vendedor_id`), não do dono do cron
- [x] `lead_ownership_history` append-only e idempotente (`change_key`), incluída no backup
- [x] Resolução única de identidade canônica (`src/lib/crm/identity.ts` + `src/server/crm/identity.server.ts`), vínculo sem fusão
- [x] Redistribuição real detectada por responsável origem × responsável do card (`ownership.server.ts`), sem ZERO CONTATO como bloqueador
- [x] Nova entrada operacional por titularidade (`workspace_e0_actions.ownership_seq` + `cycleKey` da E0), decidida pelo NOVO responsável
- [ ] PENDENTE DE CADASTRO: mapear `greensales_vendor_id` de cada executivo — sem isso a redistribuição não é reconhecida
- [ ] Bloco 3 — itens de fila sem ciclo registrado, card principal entre múltiplos cards da mesma identidade

## Bloco 4 — Fluxo administrável com versão congelada (05/09)
- [x] Tabelas `relationship_flow_versions` + `relationship_flow_steps` (versão publicada imutável)
- [x] `relationship_cadences.flow_version_id/flow_version` e `relationship_queue.flow_version_id`
- [x] Resolvedor server-side único de versão de fluxo (etapas, ordem, prazo)
- [x] Motor lê ordem/prazo da versão do ciclo; ciclo legado usa fallback do config.ts
- [x] Área administrativa de Fluxos (rascunho, associação, drag-and-drop, publicação)

- [x] Central de Operações (/f/executivo/central-operacoes): leitura consolidada por período, executivo e tipo, com drill-down e snapshot de responsável na fila.

- [x] Central de Operações /f: obrigações de ligação persistidas como PENDING, responsável histórico congelado, Produção x Aderência separadas, overdue como subconjunto de pendentes, filtros de produção/teste.
- [ ] Central de Backup: backup horário do dia corrente + snapshot diário das 23:00 dos últimos 7 dias (bloco futuro, não implementar agora).

- [x] Corrigir escopo do Painel de Campanhas (colaborador deve ver todos os executivos ativos) — somente /f/executivo/campanhas

- [x] Central de Alertas /f: servidor como fonte de verdade (etapa 1) — alertas derivados de portal_leads, portal_journey_events, portal_engagement, portal_meetings e lead_ownership_history; "Contato Solicitado" pendente de persistência server-side.

## Refinamento único (06/09)
- [ ] 1. Manual: remover vídeos dos capítulos 1, 7 e 14 + referências textuais; relatar outros capítulos com vídeo
- [ ] 2. Remarketing: largura do CRM, identidade "CRM de Remarketing"
- [ ] 3. Central de Templates (Meta) para campanhas de Remarketing
- [ ] 4. Larissa gestora: permissões e visibilidade
- [ ] 5. Portal dos Leads: visão gerencial com filtro por executivo
- [ ] 6. KPI e Campanhas: escopos por perfil
- [ ] 7. Central de Operações: recuperação de ações puladas
- [ ] 8. Brian Analytics: remover ponto de entrada da IA Executiva
- [ ] 9. Apresentação Digital: reconstrução simples (texto + 1 vídeo)
- [ ] 10. Homologação: remover simulador antigo
- [ ] 11/12. Rotas definitivas + ambiente conjunto "Solar + Seguros" (/solar-seguros)
- [ ] 13. Apresentação Digital em Módulos, menu por permissão

### Situação (06/09, fim do bloco)
- [x] Manual: vídeos dos capítulos 1, 7 e 14 removidos (não havia outros)
- [x] CRM de Remarketing ampliado e isolado
- [x] Central de Templates com ativo/inativo (snapshots preservados)
- [x] Permissões definitivas da Gestora
- [x] Portal dos Leads com filtro gerencial por executivo (server-side)
- [x] KPI e Campanhas com equipe ativa dinâmica
- [x] Recuperação de ações puladas (registro append-only + Central de Operações)
- [x] Ponto de entrada de IA removido do Brain (relatórios preservados)
- [x] Simulador antigo removido definitivamente
- [x] /solar-seguros criado + item "Solar + Seguros" no Workspace
- [x] Apresentação Digital: uma apresentação vigente por ambiente (simples)
- [x] KPI: persistência server-side dos lançamentos (tabela kpi_entries; localStorage deixa de ser fonte de verdade)

### Biblioteca de Mensagens — fundação (07/09)
- [x] Configuração do motor passa a ser a única fonte das etapas; Biblioteca guarda só mensagens/versões
- [x] Nova versão herda a posição da etapa (fim do salto para o final)
- [x] Rotina de posição faltante conservadora (nunca sobrescreve posição existente)
- [x] Chave livre deixa de criar etapa real; registros órfãos preservados como legado
- [ ] Próxima etapa: organizar conscientemente os nomes exibidos (títulos deslocados)

## Central dos Nomes (07/09)
- [x] Central dos Nomes em /f: menu (Admin), tela de colagem, servidor, dedupe, cards por faixa, busca, contador, exclusao
- [x] Importação assíncrona: fila server-side (name_central_imports + blocos), digestão em segundo plano com retomada, progresso persistente
- [x] Upload Word (.docx) usando o mesmo pipeline da colagem
- [x] Listagem paginada + contador real no banco (fim do limite de 20.000)

## Biblioteca — régua editorial (07/09)
- [x] Comparação histórico x atual: nenhum texto oficial desapareceu (E3 e R1 preservados como versões inativas)
- [ ] Camada editorial E0–E8 / R1–R4 / RE0–RE3 / RF0–RF1 sobre as chaves técnicas (sem renomear step_key)
- [ ] Reativar/republicar E3 (chave E3 v1) e R1 (chave R1 v1) após decisão do administrador
- [ ] Renumeração de display_position na ordem editorial (construção separada)
- [ ] Janela temporária de domingo em resolveOperationalWindow (se aprovada)

## Motor de cadência final /f (08/09)
- [x] Régua final como módulo puro e isolado (`src/lib/relationship/cadence-v2.ts`): E0–E8, R1–R4, RE0–RE3, âncora teórica + piso de execução, calendário sáb→seg / dom→ter / feriado, janelas 09:00–17:30 e sáb 08:00–16:00, ações internas, contexto E7/E8, congelamento de Agendamento
- [x] Testes direcionados (28) cobrindo A–W
- [x] L2/L3/L4 deixam de gerar obrigação nova (histórico e tarefas existentes preservados)
- [x] Ação do Dia: ligação tem precedência sobre mensagem no mesmo lead
- [ ] Persistência das ações internas + separação data teórica/operacional na fila (exige migration)
- [ ] Scheduler/closure passarem a consumir a régua nova (hoje ainda usam `config.ts`)
- [ ] Eixo de contexto SEM_CONTATO/MATERIAL_ENVIADO na Biblioteca (E7/E8) + registro manual de "apresentação enviada"

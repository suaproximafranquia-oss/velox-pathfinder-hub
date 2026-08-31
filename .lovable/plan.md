# Fotografia técnica — Infraestrutura, integrações e operação

Auditoria somente leitura: nenhum código, banco, dado, cron, migração ou integração foi alterado.
Método: leitura de código + migrações + consultas de leitura ao banco. `cron.job` não é legível pelo usuário de leitura (`permission denied for schema cron`); a existência dos jobs foi confirmada por migração e pelo comportamento observado nos dados. Onde nem um nem outro confirma, está escrito **NÃO CONFIRMADO NO CÓDIGO**.

## 1. Banco e persistência

| Tabela | Finalidade | Grava | Lê | Verdade ou espelho |
|---|---|---|---|---|
| `portal_leads` | card operacional do Lead | sync, Portal, motor | Workspace, CRM, motor, agenda | verdade operacional |
| `crm_leads` | espelho bruto da origem | `lead-sync.server` | reconciliação, CRM | espelho do GreenSales |
| `crm_messages` / `crm_timeline` | mensagens e linha do tempo | dispatch, E0, inbound | CRM, jornada | verdade |
| `relationship_message_library` / `_sends` / `_engine_log` / `_step_content_bindings` | texto oficial, snapshot, auditoria, vínculos | Biblioteca, motor | motor, telas | verdade |
| `executive_profiles` / `executive_user_status` / `user_roles` | identidade, status, papel | Gestão de Usuários (parcial) | motor, guards, RLS | verdade contaminada pelo seed |
| `workspace_module_permissions` | permissão por módulo | Admin | UI e guards | verdade |
| `portal_backups` / `_blobs` / `_requests` / `portal_restores` | pontos de restauração e fila | rotina de backup | Central de Backup | verdade |
| `group_unit_leads` / `_events` | leads de Solar e Seguros | formulários das unidades | painel das unidades | verdade isolada |
| `remarketing_*` | campanhas, contatos, conversas, mensagens | motor de remarketing | módulo Remarketing | verdade isolada |
| `crm_meta_templates` / `meta_templates` | templates oficiais | Admin | E0, campanhas | verdade duplicada em duas tabelas |

UI ≠ persistido (confirmado): **status Ativo/Inativo** dos usuários (tela mostra o seed, banco tem 6 inativos, servidor usa slug do código) e **permissões de módulo** enquanto o espelho local não é atualizado. Dados operacionais que só existem no navegador estão no item 2.

## 2. localStorage — varredura por chave

| Arquivo | Chave | Finalidade | Seguro no navegador? | Deveria estar no servidor? |
|---|---|---|---|---|
| `executive-auth.ts` | `atlas:session:v3` | sessão do workspace | aceitável (token real é do backend) | não |
| `executive-auth.ts` | `atlas:users:v3` | cadastro/edição de usuários | **não** — perfil, slug e senha editados | **sim** |
| `executive-auth.ts` | `atlas:activeRole:v1` | papel ativo | não (papel decide o que aparece) | sim |
| `workspace-permissions.ts` / `-store.ts` | `atlas:workspace-permissions:v1` | permissões por módulo | espelho; risco se virar fonte | permanece no servidor |
| `responsible-executive.ts` | `atlas:manual:responsibleExecutiveSlug` | executivo responsável do visitante | parcial | sim, após identificação |
| `platform-settings.ts` | `atlas:platform-settings:v1` | configurações da plataforma | **não** | **sim** |
| `resources.ts` | `atlas:resources:v1` | materiais/vídeos | **não** | **sim** |
| `knowledge-base.ts` | documentos da IA | base de conhecimento | não | sim |
| `kpi-manager.ts` | KPIs mensais + contexto | metas e resultados | não | sim |
| `workspace-alerts.ts` | `atlas:workspace-alerts:v1`, `:read`, `investor-last-seen` | alertas e lidos | não | sim |
| `crm/timeline.ts`, `crm/distribution.ts`, `crm/lead-intake.ts`, `crm/conversation-read.ts` | `crm.*` | linha do tempo local, distribuição, leads privados, lidos | **não** — dado operacional de CRM | **sim** |
| `crm/backup-access.ts` | `crm.backup.access/grants` | concessão de acesso a backup | **não** — decisão de acesso no cliente | **sim** |
| `portal/redistribution.ts` | cursor e histórico de redistribuição | rodízio de leads | **não** | **sim** |
| `acquisition/sources.ts` | config e histórico de captação | canais | não | sim |
| `meetings.ts`, `google-calendar.ts`, `meeting-providers.ts`, `notifications.ts` | agenda e preferências | reuniões locais | parcial | parcialmente (agenda já tem tabela) |
| `recognition/engine.ts` | eventos, homologação, agendados | reconhecimento | sim | não |
| `portal-session.ts`, `portal-identity.ts`, `portal-entry.ts`, `portal-journey.ts` | sessão/identidade do investidor | jornada | sim (com espelho no servidor) | não |
| `audit-log.ts` | `atlas.audit.log.v1` | auditoria local | **não** — auditoria no cliente é apagável | **sim** |
| `events/bus.ts`, `sync-bus.ts` | eventos entre abas | coordenação | sim | não |
| `simulator-history.ts`, `creative/*`, `brain-data.ts`, `custom-fields.ts` | históricos e rascunhos | apoio | sim | opcional |

Nenhum desses sobrevive a troca de dispositivo; a maioria também não sobrevive a limpeza de navegador. Nada foi migrado.

## 3. Backup

Nasce em `enqueueBackupRequest` (`backup-queue.server.ts`), chamado por `POST /api/public/backup/run` — grava só a hora cheia (chave única, idempotente). É processado por `processNextBackupRequest` via `POST /api/public/backup/process`, com lease de 10 min, teto de 5 tentativas e conclusão apenas após o ponto estar gravado e validado. Conteúdo: 22 tabelas de `BACKUP_TABLES`, metadados em `portal_backups`, payload desduplicado por hash em `portal_backup_blobs` (hoje 63 pontos, 363 MB).

Fora do backup — lacuna real: todo o motor (`relationship_*`: Biblioteca, snapshots, vínculos, fila, log), `crm_meta_templates`, `group_unit_leads`, todas as `remarketing_*`, `workspace_module_permissions`, `executive_user_status`, `workspace_agenda_events`, pipelines.

Crons versionados: `crm-lead-sync` (*/5), `portal-backup-automatico` (0 * * * *), `remarketing-engine` (* * * * *). O agendamento do **processador** não existe em nenhuma migração, mas o processamento comprovadamente ocorre: 96 solicitações entre 27/08 14:00 e 31/08 13:00 UTC, **todas `concluido`**, ponto gravado ~10 s após a hora cheia. Ou seja, o job existe fora do versionamento — **NÃO CONFIRMADO NO CÓDIGO**, confirmado nos dados. Não há hoje backup "preso na fila". Falhas são registradas em `portal_backup_requests.last_error`/`attempts`; a rota usa `console.error`, que não persiste.

## 4. Retenção

`pruneBackups` atua só sobre `origin='automatico'` e não `protected`: ≤48 h mantém tudo; entre 48 h e 7 dias mantém um por bucket `floor(timestamp / 86.400.000)`; acima de 7 dias remove; blobs órfãos são limpos depois.

Medição real (horário de São Paulo):

```text
29/08: 15 pontos    30/08: 24 pontos    31/08: 11 pontos     ← dentro das 48 h
24 a 28/08: 1 ponto por dia, sempre às 20:00 / 17:00 / 19:00 / 20:00 / 20:00
```

O bucket é **UTC**: o último ponto do dia UTC é 23:00 UTC = **20:00 em São Paulo**. Duas divergências em relação ao projetado: (a) o "dia" não é America/Sao_Paulo, então o fechamento perde as três últimas horas de operação; (b) o corte por dia só começa depois de 48 h — na virada da meia-noite local não acontece nada e convivem dois dias inteiros de pontos horários. Backups manuais e protegidos ficam fora da varredura (é por isso que 09/08, 17/08 e 21/08 seguem vivos), então não há risco de perder ponto válido criado à mão.

## 5. Crons, jobs e automações

| Nome / origem | Frequência | Executa | Altera | Dispara mensagem? | Risco |
|---|---|---|---|---|---|
| `crm-lead-sync` | 5 min | `runScheduledLeadSync` → sync + fila E0 + tick do motor + reconciliação | leads, mensagens, fila | **sim** | trava por `crm_sync_runs` RUNNING < 15 min |
| `portal-backup-automatico` | 1 h | enfileira a hora | fila de backup | não | nenhum |
| processador de backup (fora das migrações) | ~1 min | captura e grava ponto | backups e blobs | não | não reproduzível em ambiente novo |
| `remarketing-engine` | 1 min | motor de remarketing | tabelas de remarketing | **sim** | sem trava equivalente à do CRM |
| webhook da Meta | por evento | grava resposta, aciona resposta automática | mensagens, cadência | **sim** | sem assinatura |
| gatilhos do banco | por operação | blindagem de exclusão, `updated_at`, papel admin | leads, papéis | não | corretos |
| `setInterval` de tela (20 s em 4 telas; 30–60 s em 5) | contínuo | leitura e `sync()` | nada diretamente | não | carga; reexecuta a cada F5 e login |

Nenhum job apaga dados de negócio — só a retenção de backup apaga, e apenas pontos automáticos. Sinal de saúde encontrado: `crm_sync_runs` tem 2.072 OK, 1 ERRO e **106 linhas em RUNNING** — execuções que morreram sem fechar; hoje só poluem o histórico (a trava usa idade < 15 min), mas escondem falhas reais.

## 6. Meta / WhatsApp (CRM → motor → servidor → Meta → webhook → CRM)

Chamada em `src/server/whatsapp.server.ts`: `POST graph.facebook.com/v20.0/<phoneNumberId>/messages` (e `/media`), credenciais `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_VERIFY_TOKEN` lidas dentro do handler. Templates consultados em `crm_meta_templates` por `purpose` + status aprovado — **a tabela está vazia**, então a E0 é registrada e a entrega externa fica pendente com motivo legível; nada é inventado. WhatsApp do executivo ausente: não bloqueia a E0; vira pendência de entrega quando o template exige o botão de contato.

Armazenado da resposta da Meta: apenas `delivered: boolean` e a string de erro. **O `wamid` é descartado.** Webhook existe, mas trata só `messages`; o array `statuses` (sent/delivered/read/failed) não é consumido em lugar nenhum, e não há reconciliação posterior. Sem timeout, sem retry, sem backoff nas três chamadas.

Distinção de estados hoje: **tentativa/registro** e **falha** existem; "aceite da Meta" só vive em memória durante a chamada; **entrega e leitura não existem tecnicamente**. Eventos desconhecidos pelo sistema: entregue, lido, falha assíncrona da Meta, bloqueio pelo destinatário, expiração de janela informada pela Meta.

## 7. Custos e IA

| Função | Serviço | Quando | Automática? | Custo |
|---|---|---|---|---|
| `askKnowledge`, `askKpiInsights` (`ai.functions.ts`) | gemini-2.5-flash | clique no assistente | não | sim, sob clique |
| `generateBrainReport` (`brain-ai.functions.ts`) | gemini-3.5-flash | clique | não | sim, sob clique |
| `generateCampaignDraft` (`campaign-ai.functions.ts`) | gpt-5.6-sol | clique | não | sim, sob clique |
| `lead-import.functions.ts` | visão | envio de arquivo | não | sim, sob clique |
| `meta-templates.functions.ts` (protegida) | visão | envio de arquivo | não | sim, sob clique |
| `creative.server.ts`, `creative-photo.server.ts` | imagem | clique | não | sim, sob clique |
| heurística de interesses, perfil, simulador | local | render | sim | **sem custo externo** |
| Meta (motor e remarketing) | Meta | cron | **sim** | **custo automático** |
| GreenSales | API própria | cron | sim | sem custo por chamada |
| armazenamento de backups | banco | 1 h | sim | custo automático crescente |

Não há chamada de IA ao abrir tela, ao abrir ficha, em cron ou em background — verificado nos `useEffect` e nos jobs. Nenhum retry de IA. Ressalva importante: `ai.functions.ts`, `brain-ai.functions.ts`, `campaign-ai.functions.ts` e `lead-import.functions.ts` **não têm `requireSupabaseAuth`** — no site publicado são endpoints públicos, o que transforma custo "sob clique" em custo potencialmente automático provocado por terceiros.

## 8. GreenSales

Entrada por `runLeadSync` (cron de 5 min, intervalo efetivo em `crm_automation_settings`): login por token, `lead/list` com `total_pagina = 100` paginado até o fim, espelho em `crm_leads`, card em `portal_leads` (`gs_<external_id>`). Identificação por `external_id` e telefone normalizado. Alterações são detectadas por **comparação de estado** (`stage_key`, status, etiquetas do payload), nunca por evento; quando a listagem não traz etiqueta, há consulta de detalhe limitada a **80 leads por execução**. Não existe webhook: é 100% polling. Reconciliação uma vez por dia, dentro do mesmo cron, marcando como não localizado quem sumiu da origem — nada é apagado.

Alterações que podem passar despercebidas: mudança que não altera nenhum campo trazido pela listagem e cujo lead não entra nos 80 detalhes daquele ciclo. Duplicação: improvável, pela chave estável. Perda de lead: impossível por exclusão (gatilhos de blindagem), possível apenas como sumiço da visão filtrada. F5 continua sendo necessário em telas cujo estado depende de leitura local (Workspace, CRM) quando o poll não cobre aquele dado.

## 9. Portal dos Leads — lead que muda de coluna

O sistema procura o lead em `portal_leads` pelo `external_id`, e a coluna exibida vem do `stage_key` capturado no último ciclo. Consideradas: todas as colunas da listagem, não só NOVOS — mas apenas com os campos que a listagem devolve. A reconciliação roda 1x/dia. Saindo de NOVOS, o card muda de coluna no ciclo em que a mudança for percebida; o motor continua enxergando o lead (a cadência não depende da coluna, e sim do estado). Cenário em que fica invisível para o **usuário**: o ciclo não percebeu a mudança, ou o responsável está vazio/inativo e o filtro de carteira o esconde. Cenário em que fica invisível para o **motor**: nenhum encontrado — o motor lê por lead, não por coluna. Causa estrutural: fotografia paginada, sem evento de mudança e **sem carimbo visível de "verificado em"**, o que torna indistinguível "não mudou" de "não foi verificado".

## 10. Isolamento dos ambientes

| Ambiente | Home | Rota | Dados | Sessão | Permissões | Isolamento |
|---|---|---|---|---|---|---|
| Grupo | sim | `/` | — | pública | — | real |
| Financeira | sim | `/f` | leads, CRM | operacional única | por módulo | real na rota |
| Solar | sim | `/s` | `group_unit_leads` | pública | — | real |
| Seguros | sim | `/seg` | `group_unit_leads` | pública | — | real |
| Workspace do Executivo | sim | `/f/executivo` | várias | operacional única | por módulo | guard + visual |
| Portal dos Leads | sim | `/f/portal-leads` | `portal_leads` | operacional única | por módulo | carteira via `can_access_investor` |
| CRM | sim | `/f/crm` | `crm_*` | operacional única | por módulo | guard + visual |
| Remarketing | sim | `/remarketing` | `remarketing_*` | operacional única | por módulo | dados reais isolados |

Uma única sessão para todos os ambientes internos e **nenhuma tabela com `workspace_id`/`tenant_id`**: o isolamento é por nome de tabela e por rota. Templates Meta são globais entre CRM, campanhas e Remarketing. RLS de remarketing usa `is_portal_member()` — qualquer membro lê tudo.

## 11. Rotas e redirects que atravessam ambientes

- `src/routes/__root.tsx:45` — tela de erro/404 leva a `/` (Home do Grupo) mesmo quando o usuário estava em `/f`.
- `src/routes/f.index.tsx:554` — o logotipo da **Financeira** aponta para `/`, ejetando para o institucional do Grupo.
- `src/components/editorial/module-chrome.tsx:66` e `src/components/journey/journey-chrome.tsx:41` — "voltar" dos módulos e da jornada vai para `/`.
- `src/routes/s.index.tsx:61` e `seg.index.tsx:61` — corretos: são as próprias homes de unidade voltando ao Grupo.
- `src/routes/manual/concluido.tsx:38` — fim do manual volta ao Grupo; aceitável, mas não é a home do ambiente de origem.

Regra "HOME = home do ambiente atual" ainda não é respeitada nos quatro primeiros casos.

## 12. Módulos que talvez não devessem existir

| Item | Rotas | Classificação |
|---|---|---|
| Homologação do Motor | `f.executivo.homologacao.tsx` + espelho `executivo.homologacao.tsx` | **NÃO REMOVER** — `homologation.server.ts` contém lógica de Biblioteca usada em produção |
| Laboratório | `f.executivo.laboratorio.tsx` + espelho | REQUER CUIDADO — hospeda o adaptador interno de recebimento |
| Teste de cadência | `f.executivo.teste-cadencia.tsx` + espelho | REQUER CUIDADO — usa lotes `is_test` e polling de 30 s |
| Unidades do Grupo | `f.executivo.unidades.tsx` | **NÃO REMOVER** — é a carteira real de Solar/Seguros |
| ~28 rotas espelho `executivo.*` (pré-`/f`) | várias | PODE REMOVER COM BAIXO RISCO, depois de conferir links antigos |

## 13. Remarketing

Rota própria em aba separada, motor próprio, cron próprio de 1 min, quatro tabelas próprias. O webhook decide por número **antes** de gravar (`isRemarketingPhone`), então mensagem de remarketing não entra no CRM e o motor de relacionamento não lê tabelas de remarketing — uma campanha não muda cadência de lead. Compartilhados: sessão operacional, `OperationalGuard`, número de origem da Meta, o webhook e as tabelas de template. Dependência escondida: todo o isolamento operacional depende de `isRemarketingPhone` acertar o número; um contato presente nos dois mundos é decidido por essa única função. Interface: shell operacional próprio, sem alteração visual proposta aqui.

## 14. Segurança operacional (risco real)

- Senhas dos 7 executivos em texto puro em `src/lib/executive-auth.ts`, dentro do bundle do cliente (existência e local; sem exibir valores).
- Chave publicável do projeto literal nas três migrações de cron e usada como **única** autorização das 4 rotas públicas — a mesma chave já está no bundle: `/api/public/crm/sync`, `/backup/run`, `/backup/process` e `/remarketing/run` são acionáveis por qualquer visitante.
- Webhook da Meta sem verificação de assinatura `X-Hub-Signature-256`.
- 4 funções de IA sem `requireSupabaseAuth`.
- Concessão de acesso a backup e log de auditoria armazenados no navegador (`crm.backup.grants`, `atlas.audit.log.v1`) — decisão de acesso e evidência editáveis pelo usuário.
- Permissão de módulo aplicada essencialmente na interface.
- Não encontrados no cliente: token da Meta, service role, credencial do GreenSales, senha do banco — corretamente server-side.

## 15. Dados temporários e resíduos

`SEED_USERS` ainda sobrepõe o banco; rotas espelho `executivo.*` duplicando `/f/executivo/*`; duas tabelas de template (uma vazia); `relationship_content_groups` congelada mas presente; aliases de etapa `E2/E5/E6/E7` ativos na Biblioteca; chave `atlas:recognition:homolog:v1` de homologação no navegador; lotes `is_test`/`test_batch_id` e `test_batches`; `whatsapp_validations` alimentada por adaptador interno. Nada removido.

## 16. Integrações cruzadas — o que quebra o quê

```text
Usuários (seed) ─→ slug e WhatsApp ─→ E0 e botão do template ─→ Meta
Biblioteca ──────→ motor ──────────→ mensagens ─→ CRM ─→ jornada
GreenSales ──────→ portal_leads ───→ motor, Workspace, agenda, Portal dos Leads
Templates Meta ──→ E0, campanhas e Remarketing (tabela global compartilhada)
Webhook Meta ────→ Remarketing OU CRM (decisão única por número)
Backup ──────────→ 22 tabelas; NÃO cobre Biblioteca, permissões, unidades e remarketing
Permissões ──────→ toda a navegação interna dos ambientes
```
Alterar o cadastro de usuários mexe em E0, RLS e permissões. Alterar a tabela de templates mexe em CRM e Remarketing ao mesmo tempo. Alterar o roteamento do webhook mistura dois ambientes. Alterar a Biblioteca não tem rede de proteção, porque não está no backup.

## 17. Problemas novos, classificados

🔴 CRÍTICO
1. `src/server/backup.server.ts` → `BACKUP_TABLES` → Biblioteca, snapshots, vínculos, permissões, unidades e remarketing fora do backup → perda irrecuperável desses domínios → ampliar a lista.
2. `src/routes/api/public/*` → `authorized()` → autorização pela chave publicável já exposta no bundle → sync, backup e remarketing acionáveis por terceiros → segredo dedicado por rota.
3. `src/routes/api/public/whatsapp/webhook.ts` → POST → sem assinatura → payload forjado altera cadência → validar `X-Hub-Signature-256`.
4. `src/lib/ai.functions.ts`, `brain-ai.functions.ts`, `campaign-ai.functions.ts`, `crm/lead-import.functions.ts` → sem middleware → IA paga exposta → aplicar `requireSupabaseAuth`.
5. `src/server/whatsapp.server.ts` → provedor `meta` → `wamid` descartado e `statuses` ignorado → entrega e leitura inexistentes, sem reconciliação → persistir id e consumir `statuses`.
6. `src/lib/crm/backup-access.ts` e `audit-log.ts` → concessão de acesso e auditoria em localStorage → controle e evidência manipuláveis no cliente → mover para o servidor.

🟠 IMPORTANTE
7. Job do processador de backup fora das migrações → ambiente recriado nasce sem backup → versionar o agendamento.
8. `pruneBackups` → bucket diário em UTC e corte apenas após 48 h → "último do dia" é o das 20:00 locais → adotar America/Sao_Paulo.
9. `crm_sync_runs` com 106 linhas em `RUNNING` → execuções que morreram sem fechar → falhas silenciosas → fechar no `finally` e marcar abandono.
10. `greensales.server.ts` → `fetchPage`/`fetchLead` sem timeout e sem retry → erro transitório perde o ciclo inteiro.
11. `remarketing-engine` a cada minuto sem trava de concorrência equivalente à do CRM.
12. `recordReply` sem idempotência nem comparação de timestamp → webhook repetido ou fora de ordem sobrescreve status.
13. Duas tabelas de template, uma delas vazia → fonte dupla para CRM, campanhas e Remarketing.
14. Ausência de `workspace_id`/`tenant_id` → isolamento por nome de tabela; qualquer módulo novo herda o problema.
15. Dados operacionais de CRM só no navegador (`crm.timeline`, `crm.distribution`, `crm.private-leads`, redistribuição, plataforma, recursos).
16. Redirects que ejetam para a Home do Grupo (`__root.tsx`, `f.index.tsx`, `module-chrome.tsx`, `journey-chrome.tsx`).

🟡 BAIXO
17. ~28 rotas espelho `executivo.*` duplicando `/f/executivo/*`.
18. Polling de 20 s em quatro telas simultâneas.
19. Tabelas de log e auditoria sem expurgo (crescimento indefinido).
20. `console.error` nas rotas públicas não deixa rastro persistente.
21. URL e chave literais nas migrações de cron.
22. Resíduos de homologação e teste convivendo com produção (item 15).

## 18. O que está correto — não alterar

Fila de backup com hora única, lease, teto de tentativas e conclusão validada (96/96 concluídas, zero pendentes); desduplicação por hash; `NEVER_RESTORE_TABLES`; proteção de backups manuais e marcados na retenção; blindagem por gatilho contra exclusão e truncamento de Leads; trava de concorrência da sincronização; paginação completa do GreenSales sem parada precoce; reconciliação diária que preserva em vez de apagar; roteamento do webhook que separa Remarketing do CRM antes de gravar; ambiente decidido antes da credencial no envio; credenciais da Meta, GreenSales e service role apenas no servidor e lidas dentro dos handlers; idempotência do motor por chave determinística; `relationship_engine_log` + `relationship_message_sends`; unidades Solar e Seguros em tabela própria; ausência de IA automática em telas, fichas e crons.

## 19. Ordem recomendada

```text
Críticas
1. Segredo próprio por rota pública        (destrava 7 e 11 sem reabrir superfície)
2. Assinatura do webhook da Meta           (mesma rota do item 5; antes dele)
3. Autenticação nas 4 funções de IA        (independente; corta custo aberto)
4. Ampliar tabelas do backup               (independente; antes de mexer na Biblioteca)
5. wamid + statuses da Meta                (depende de 2; habilita 12)
6. Acesso a backup e auditoria no servidor (depende de 1)

Importantes
7. Versionar o cron do processador         (depende de 1)
8. Fechar execuções RUNNING                (precede 10)
9. Retenção em America/Sao_Paulo           (depois de 4 e 7)
10. Timeout e retry no GreenSales          (depois de 8)
11. Trava do remarketing                   (depende de 1)
12. Idempotência de recordReply            (depois de 5)
13. Tabela canônica de templates           (antes de qualquer ajuste de conteúdo)
14. Cadastro de usuários no servidor       (precede 15 e o tenant)
15. tenant_id                              (depois de 14; antes de módulo novo)
16. Redirects por ambiente                 (independente)

Limpeza e melhorias
17. Rotas espelho, resíduos de teste, expurgo de logs, polling, literais nas migrações
```

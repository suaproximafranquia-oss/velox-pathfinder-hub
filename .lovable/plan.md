# Fotografia técnica da infraestrutura — Backup, Cron, Meta, GreenSales, IA, Ambientes

Auditoria somente leitura: nenhum código, dado, banco, cron ou integração foi alterado.
Método: código + migrações + consulta de leitura ao banco. `cron.job` não é legível pelo usuário de leitura (`permission denied for schema cron`), então a existência de cada job foi confirmada pelas migrações e pelo comportamento observado nos dados. Onde nem um nem outro confirma, está escrito **NÃO CONFIRMADO NO CÓDIGO**.

## 1. Backup

Incluídos: 22 tabelas listadas em `BACKUP_TABLES` (`src/server/backup.server.ts`) — leads do Portal, CRM, mensagens, linha do tempo, eventos, jornada, engajamento, reuniões, auditoria de proteção, campanhas, templates, notícias, conhecimento, criativos, perfis de executivo, papéis, validações de WhatsApp, conexões, revista e blocos institucionais. Fora do backup: todo o motor de relacionamento (`relationship_*` — Biblioteca, snapshots, vínculos, fila, log do motor), `crm_meta_templates`, `group_unit_leads`, todas as tabelas `remarketing_*`, `workspace_module_permissions`, `executive_user_status`, `workspace_agenda_events`, `crm_pipelines`/`crm_pipeline_stages`, `portal_backup_*`. Isso é uma lacuna real: a Biblioteca oficial e as permissões não têm ponto de restauração.

Armazenamento: metadados em `portal_backups`, conteúdo desduplicado por hash em `portal_backup_blobs` (63 pontos, 363 MB hoje). Inicia: `enqueueBackupRequest` (`backup-queue.server.ts`) via `/api/public/backup/run`. Processa: `processNextBackupRequest` via `/api/public/backup/process`, com lease de 10 minutos, máximo de 5 tentativas e conclusão só depois de o ponto estar gravado e validado.

Crons confirmados em migração: `crm-lead-sync` (*/5), `portal-backup-automatico` (0 * * * *), `remarketing-engine` (* * * * *). O agendamento do **processador** de backup não aparece em nenhuma migração, mas os dados provam que ele executa: 96 solicitações, **todas `concluido`**, de 27/08 14:00 a 31/08 13:00 UTC, com o ponto gravado ~10 s depois da hora cheia. Ou seja, o job existe fora do versionamento — **NÃO CONFIRMADO NO CÓDIGO**, confirmado no comportamento. O risco prático não é "ficar só enfileirado" (não há nenhuma pendente ou falha), é o job não estar reproduzível: uma recriação do ambiente a partir das migrações nasce sem ele. Falhas são registradas em `portal_backup_requests.last_error` e `attempts`; a rota só faz `console.error`, que não persiste.

## 2. Retenção

`pruneBackups` age apenas sobre `origin='automatico'` e não `protected`: ≤48 h mantém todos os pontos horários; entre 48 h e 7 dias mantém um por bucket `floor(timestamp / 86.400.000)`; acima de 7 dias remove; blobs órfãos são limpos.

Comportamento real medido no banco (horário de São Paulo):

```text
29/08: 15 pontos   30/08: 24 pontos   31/08: 11 pontos      (dentro das 48 h)
24/08 → 28/08: 1 ponto por dia, sempre 20:00, 17:00, 19:00, 20:00, 20:00
```

O bucket é UTC. O último ponto do dia UTC é o das 23:00 UTC = **20:00 em São Paulo**. Confirmado nos dados: os sobreviventes diários são 17:00–20:00 locais, nunca 23:00 locais. Divergência em relação ao projetado: (a) o dia é UTC, não America/Sao_Paulo, então o "fechamento do dia" perde as últimas três horas de operação; (b) a limpeza para pontos horários só começa depois de 48 h — na virada da meia-noite local não acontece nada, convivem dois dias inteiros de pontos de hora em hora. Não há risco de apagar backup manual ou protegido: ambos ficam fora da varredura (os 2–4 pontos de 09/08, 17/08 e 21/08 continuam vivos por isso).

## 3. Meta / WhatsApp

Templates ficam em duas tabelas concorrentes, `crm_meta_templates` (usada pela E0) e `meta_templates` (usada por campanhas) — hoje **`crm_meta_templates` está vazia**. Identificação por `purpose` + status aprovado; nada é inventado quando não há template. Envio: `src/server/whatsapp.server.ts` → `POST graph.facebook.com/v20.0/<phoneNumberId>/messages`, credenciais em `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_VERIFY_TOKEN`, lidas dentro do handler. Enviados: número do investidor, nome do template, idioma, parâmetros e, quando o template exige, o número do executivo como destino do **botão de contato** — o WhatsApp do executivo nunca é remetente nem variável de corpo.

Sem timeout, sem retry, sem backoff em nenhuma das três chamadas (texto, template, mídia). O retorno é reduzido a `delivered: boolean` + string de erro: **o `wamid` devolvido pela Meta é descartado**. Webhook existe (item 6), mas trata apenas `messages`; o array `statuses` (sent/delivered/read/failed) **não é consumido em lugar nenhum**.

Resposta direta: hoje o sistema distingue apenas **solicitação/registro** e **falha**. "Aceite da Meta" existe só em memória durante a chamada (2xx vira `delivered=true` e não é persistido como estado próprio); **entrega e leitura não existem tecnicamente** e não há como reconciliar depois, por falta do id da mensagem. Envio automático indevido: o único caminho automático é o tick do motor dentro do cron de 5 min; ele é protegido por chave primária determinística, `executedSteps`, janela operacional e guarda de destinatário — não encontrei caminho que dispare sem essas travas.

## 4. GreenSales

Entrada: `runLeadSync` (cron de 5 min, intervalo efetivo em `crm_automation_settings.sync_interval_minutes`) faz login por token, pagina `lead/list` com `total_pagina = 100` até o fim, espelha em `crm_leads` e materializa o card em `portal_leads` (`gs_<external_id>`). Alterações são detectadas por **comparação de estado**, não por evento: `stage_key`, status e etiquetas do payload; quando a listagem não traz etiqueta, há consulta de detalhe limitada a 80 leads por execução. Mudança de coluna atualiza o card e alimenta o motor; lead que some da origem não é apagado — a reconciliação diária (`runDailyReconciliation`, uma vez por dia dentro do mesmo cron) o marca como não localizado, e os gatilhos de blindagem impedem exclusão.

Não existe webhook nem push do GreenSales: **tudo é polling**. Atraso estrutural: até 5 min no caso comum, mais um ciclo quando a alteração está fora da janela de 80 detalhes, e mais um ciclo inteiro quando a API falha — não há retry nem timeout nos `fetch`, então uma falha transitória derruba a varredura completa. Duplicação de lead é improvável (chave por `external_id` e telefone normalizado). O cenário em que uma alteração **nunca** chega existe: se a mudança não altera nenhum campo trazido pela listagem e o lead nunca entra nos 80 detalhes de um ciclo, nada a revela. Sinal de saúde: `crm_sync_runs` tem 2.072 execuções OK, 1 ERRO e **106 em RUNNING** — execuções que morreram sem fechar; como a trava de concorrência olha `RUNNING < 15 min`, elas hoje só poluem o histórico, mas mascaram falhas reais.

## 5. Persistência

| Dado | Onde está | Deveria estar no servidor? | Risco |
|---|---|---|---|
| Base de conhecimento da IA (`knowledge-base.ts`) | localStorage | sim | some ao trocar de navegador; a IA responde diferente por dispositivo |
| KPIs mensais e contexto (`kpi-manager.ts`) | localStorage | sim | perda total de histórico gerencial |
| Campos personalizados, alertas e lidos do Workspace | localStorage | sim | cada executivo vê um estado diferente |
| Espelho de permissões (`workspace-permissions-store.ts`) | localStorage + poll | não (espelho) | mostra permissão vencida até o próximo poll |
| Sessão operacional `atlas:session:v3` | localStorage | é do cliente | sem expiração local; validação depende de checagem periódica |
| Histórico do simulador e do criativo | localStorage | opcional | baixo |
| Executivo responsável do visitante | localStorage do investidor | sim, após identificação | atribuição perdida se trocar de aparelho antes de se cadastrar |
| Cadastro dos 7 executivos (`SEED_USERS`) | constante no código | sim | senha em texto puro no bundle e seed sobrepondo o banco |
| URL do projeto e chave publicável | literais nas migrações de cron | — | reconfiguração manual em qualquer troca de ambiente |

## 6. Webhooks e eventos externos

Único webhook: **Meta → `/api/public/whatsapp/webhook`**. GET valida `hub.verify_token`; **POST não valida `X-Hub-Signature-256`** — qualquer requisição com o formato da Meta é aceita. Processamento por roteamento: número de remarketing → `recordInbound`; resposta de validação → `recordReply`; demais → `handleInboundMessage` do motor. Persistência em `remarketing_messages`, `whatsapp_validations`, `crm_messages`/`crm_timeline`. Idempotência: existe no motor (id da mensagem) e no remarketing; **não existe** para `recordReply` — a segunda chegada sobrescreve. Retry: a rota sempre responde `ok`, então a Meta não reenvia — e falhas internas ficam invisíveis. Chegada fora de ordem: uma resposta antiga pode sobrescrever o status atual da validação, porque não há comparação de timestamp. Nenhum log do payload cru.

Sem webhook e dependentes de polling/cron: GreenSales (integral), status de entrega/leitura da Meta, Google Workspace, e o próprio disparo dos jobs (pg_net não devolve resultado ao aplicativo).

## 7. IA, gateway e custos

| Arquivo | Função | Gatilho | Modelo | Automática? |
|---|---|---|---|---|
| `src/lib/ai.functions.ts` | `askKnowledge`, `askKpiInsights` | clique no assistente | google/gemini-2.5-flash | não |
| `src/lib/brain-ai.functions.ts` | `generateBrainReport` | clique em "gerar relatório" | google/gemini-3.5-flash | não |
| `src/lib/campaign-ai.functions.ts` | `generateCampaignDraft` | clique na campanha | openai/gpt-5.6-sol | não |
| `src/lib/crm/lead-import.functions.ts` | importação por imagem | envio de arquivo | visão | não |
| `src/lib/crm/meta-templates.functions.ts` | OCR de template | envio de arquivo | visão | não |
| `src/server/creative.server.ts`, `creative-photo.server.ts` | geração de imagem | clique | imagem | não |

Não há chamada de IA ao abrir tela, ao abrir ficha, em cron, em loop ou em background — verificado nos `useEffect` e nos jobs. Nenhum retry automático. A IA corporativa de interesses continua heurística local, sem custo externo.

Risco real de custo: `ai.functions.ts`, `brain-ai.functions.ts`, `campaign-ai.functions.ts` e `crm/lead-import.functions.ts` **não têm `requireSupabaseAuth`** — no site publicado são endpoints RPC públicos, e qualquer terceiro pode consumir créditos. Só `meta-templates.functions.ts` está protegido.

## 8. Remarketing

Rota própria (`/remarketing`, aba separada), motor próprio (`remarketing/engine.server.ts`), cron próprio de 1 minuto e quatro tabelas próprias. O webhook decide por número **antes** de qualquer gravação, então mensagem de remarketing não entra no CRM e vice-versa; o motor de relacionamento não lê tabelas de remarketing. Compartilhados: a sessão operacional, o `OperationalGuard`, o número de origem da Meta, o webhook e as tabelas de template. RLS das tabelas `remarketing_*` usa `is_portal_member()` — qualquer membro do Portal lê tudo, não há recorte por executivo. Dependência escondida: como o número da Meta é único, um contato que exista nos dois mundos é resolvido pelo `isRemarketingPhone`, e é essa função que sustenta o isolamento inteiro.

## 9. Portal dos Leads

Entrada por três caminhos: sincronização GreenSales, formulários do Portal (identidade atômica) e criação manual. Persistência em `portal_leads`, com gatilhos que impedem exclusão e truncamento. Responsável e slug vêm de `executive_profiles`; status operacional muda por `set_lead_operational` e por atividade real do investidor. Sincronização e relação com GreenSales conforme item 4; o CRM lê o mesmo card; o motor lê o card e escreve mensagens e eventos.

Cenários em que o lead fica invisível: coluna de origem não capturada no ciclo (fica na coluna anterior), lead marcado como não localizado pela reconciliação, e filtros de carteira quando o responsável está vazio ou aponta para executivo inativo. Processamento em duplicidade: barrado por `external_id`, chave determinística de mensagem e `executedSteps`. Causa estrutural do "sumiu"/"não refletiu": o Portal é uma fotografia de consulta paginada com teto de detalhamento por ciclo, sem evento de mudança e **sem carimbo visível de "verificado em"** — olhando o card, não dá para distinguir "não mudou" de "não foi verificado".

## 10. Isolamento dos ambientes

| Ambiente | Home | Rota | Dados próprios | Sessão | Permissão | Isolamento |
|---|---|---|---|---|---|---|
| Grupo (institucional) | sim | `/` | — | pública | — | real |
| Velox Financeira | sim | `/f` | `portal_leads`, CRM | operacional única | por módulo | real nas rotas, compartilhado na sessão |
| Velox Solar | sim | `/s` | `group_unit_leads` | pública | — | real |
| Agilize/Seguros | sim | `/seg` | `group_unit_leads` | pública | — | real |
| Workspace do Executivo | sim | `/f/executivo` | várias | operacional única | por módulo | visual + guard |
| Portal dos Leads | sim | `/f/portal-leads` | `portal_leads` | operacional única | por módulo | carteira por `can_access_investor` |
| CRM | sim | `/f/crm` | `crm_*` | operacional única | por módulo | visual + guard |
| Remarketing | sim | `/remarketing` | `remarketing_*` | operacional única | por módulo | dados reais, sessão compartilhada |

Existe **uma** sessão para todos os ambientes internos e **nenhuma tabela tem `workspace_id`/`tenant_id`**. O isolamento é por nome de tabela e por rota, não por chave — funciona hoje porque cada módulo tem tabela própria, mas não sobrevive a um ambiente novo que precise compartilhar tabela. Templates Meta são globais entre CRM, campanhas e remarketing. Permissão de módulo é por usuário e atravessa ambientes por construção; a checagem é majoritariamente de interface.

## 11. Automações

| Evento | Ação | Frequência | Dados afetados | Risco |
|---|---|---|---|---|
| cron `crm-lead-sync` | sync + fila E0 adiada + tick do motor + reconciliação | 5 min | leads, mensagens, fila | **envia mensagem sem clique** |
| cron `portal-backup-automatico` | enfileira a hora | 1 h | `portal_backup_requests` | nenhum |
| processador de backup (job fora das migrações) | captura e grava ponto | ~1 min | `portal_backups`, blobs | não reproduzível |
| cron `remarketing-engine` | motor de remarketing | 1 min | tabelas de remarketing | envia mensagem sem clique; sem trava equivalente à do CRM |
| webhook da Meta | grava resposta e aciona resposta automática | por evento | mensagens, cadência | sem assinatura |
| gatilhos do banco | blindagem de exclusão, `updated_at`, papel do executivo | por operação | leads, papéis | corretos |
| `setInterval` de tela (20 s em 4 telas; 30–60 s em 5) | leitura e `sync()` | contínuo | nenhum diretamente | carga; reexecuta a cada F5 e a cada login |

## 12. Custos

- **Automático**: Meta (mensagens do motor e do remarketing, disparadas pelo cron), armazenamento dos backups (363 MB e crescendo, sem incremental), execução dos crons (1.440 chamadas/dia só do remarketing), tabelas de log sem expurgo.
- **Sob clique**: todas as chamadas de IA, geração de imagem, importação por visão, OCR de template, disparo manual de campanha.
- **Sem custo**: heurísticas locais, simulador, perfil inteligente, polling interno.
- **Inesperado**: as 4 funções de IA sem autenticação — custo automático para o projeto, disparado por terceiros.

## 13. Segurança operacional

- Senhas dos 7 executivos em texto puro em `src/lib/executive-auth.ts` (dentro do bundle do cliente). Existência e local apenas.
- Chave publicável do projeto escrita literalmente nas três migrações de cron e usada como **única** autorização das 4 rotas públicas; a mesma chave já está no bundle. Na prática, `/api/public/crm/sync`, `/backup/run`, `/backup/process` e `/remarketing/run` são acionáveis por qualquer visitante.
- Webhook da Meta sem verificação de assinatura.
- 4 funções de IA sem `requireSupabaseAuth`.
- Permissão de módulo aplicada essencialmente na interface; poucas funções reconferem no servidor.
- Não encontrados no cliente: token da Meta, service role, credencial do GreenSales, senha do banco — corretamente server-side.

## 14. Inconsistências

🔴 CRÍTICA
1. `src/routes/api/public/*` → `authorized()` → autorização por chave publicável já exposta no bundle → sincronização, backup e motor de remarketing acionáveis por terceiros → segredo dedicado por rota.
2. `src/routes/api/public/whatsapp/webhook.ts` → POST → sem `X-Hub-Signature-256` → payload forjado vira mensagem recebida e altera cadência → validar assinatura.
3. `src/lib/ai.functions.ts`, `brain-ai.functions.ts`, `campaign-ai.functions.ts`, `crm/lead-import.functions.ts` → sem middleware de autenticação → IA paga exposta → aplicar `requireSupabaseAuth`.
4. `src/server/whatsapp.server.ts` → provedor `meta` → `wamid` descartado e `statuses` ignorado → entrega e leitura inexistentes, reconciliação impossível → persistir o id e consumir `statuses`.
5. `src/server/backup.server.ts` → `BACKUP_TABLES` → Biblioteca, snapshots, vínculos, permissões, unidades e remarketing fora do backup → perda irrecuperável desses domínios → ampliar a lista.

🟠 IMPORTANTE
6. Job do processador de backup existe no ambiente mas não em migração → ambiente recriado nasce sem backup → versionar o agendamento.
7. `pruneBackups` → bucket diário em UTC e corte só após 48 h → "último do dia" é o das 20:00 locais → adotar America/Sao_Paulo.
8. `crm_sync_runs` com 106 linhas em `RUNNING` → execuções que morreram sem fechar → falhas silenciosas e histórico enganoso → fechar execução no `finally` e sinalizar abandono.
9. `src/server/greensales.server.ts` → `fetchPage`/`fetchLead` → sem timeout e sem retry → um erro transitório perde o ciclo inteiro → timeout curto + retry limitado.
10. `remarketing-engine` a cada minuto sem trava equivalente à do CRM → execuções sobrepostas possíveis.
11. `recordReply` sem idempotência nem ordenação por timestamp → webhook repetido ou fora de ordem sobrescreve o status.
12. Duas tabelas de template (`crm_meta_templates` vazia e `meta_templates`) → fonte dupla.
13. Ausência de `workspace_id`/`tenant_id` em todas as tabelas → isolamento por nome de tabela.
14. `SEED_USERS` com senha em texto puro sobrepondo o banco (já confirmado na Bateria 2; repetido aqui porque bloqueia os itens 3 e 13).

🟡 BAIXA
15. Dados operacionais só no navegador (conhecimento, KPIs, campos, alertas).
16. Polling de 20 s em quatro telas simultâneas.
17. Tabelas de log e auditoria sem expurgo.
18. `console.error` nas rotas públicas não deixa rastro persistente.
19. URL e chave literais nas migrações de cron.

## 15. O que está correto — não alterar

Fila de backup com hora única, lease, teto de tentativas e conclusão validada (96/96 concluídas, zero pendentes); desduplicação de conteúdo por hash; `NEVER_RESTORE_TABLES` e a blindagem por gatilho dos Leads; proteção de backups manuais e marcados na retenção; trava de concorrência da sincronização por `crm_sync_runs`; paginação completa do GreenSales sem parada precoce; reconciliação diária que preserva em vez de apagar; roteamento do webhook que separa Remarketing do CRM antes de gravar; ambiente decidido antes da credencial no envio; credenciais da Meta, GreenSales e service role exclusivamente no servidor e lidas dentro dos handlers; idempotência do motor por chave determinística; `relationship_engine_log` + `relationship_message_sends`; unidades Solar e Seguros isoladas em tabela própria.

## 16. Dependências e ordem recomendada

```text
1 → segredo próprio das rotas públicas        (destrava 6 e 10 sem reabrir a superfície)
2 → assinatura do webhook da Meta             (mesma rota que o item 4; fazer antes dele)
3 → autenticação nas 4 funções de IA          (independente, corta custo aberto)
4 → wamid + statuses da Meta                  (depende de 2; habilita entrega/leitura e 11)
5 → ampliar tabelas do backup                 (independente; antes de qualquer mexida na Biblioteca)
6 → versionar o cron do processador           (depende de 1)
7 → retenção em America/Sao_Paulo             (depois de 5 e 6)
8 → fechar execuções RUNNING                  (independente; precede 9)
9 → timeout e retry no GreenSales             (depois de 8, para medir efeito)
10 → trava do remarketing                     (depende de 1)
11 → idempotência de recordReply              (depois de 4)
12 → tabela canônica de templates             (antes de qualquer correção de conteúdo da Biblioteca)
14 → cadastro de usuários no servidor         (precede 13)
13 → tenant_id                                (depois de 14; antes de qualquer módulo novo)
```

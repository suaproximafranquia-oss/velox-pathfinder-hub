# Bateria 4 — Infraestrutura, integrações e operação (fotografia técnica)

Auditoria somente leitura. Nada foi alterado: sem código, banco, cron, integração ou dado.
Observação de método: `cron.job` não é legível pelo usuário de leitura (`permission denied for schema cron`), então as rotinas foram confirmadas pelos arquivos de migração. Qualquer job criado fora de migração é **NÃO CONFIRMADO NO CÓDIGO**.

## 1. Banco e persistência

| Tabela | Finalidade | Grava | Lê | Verdade ou espelho |
|---|---|---|---|---|
| `portal_leads` | card operacional do Lead | sync GreenSales, Portal, motor | Workspace, CRM, motor, agenda | verdade operacional |
| `crm_leads` | espelho bruto da origem | `lead-sync.server` | reconciliação, CRM | espelho do GreenSales |
| `crm_messages` / `crm_timeline` | mensagens e linha do tempo | dispatch, E0, inbound | CRM, jornada | verdade |
| `relationship_message_library` / `_sends` / `_engine_log` | texto oficial, snapshot e auditoria | Biblioteca, motor | motor, telas | verdade |
| `relationship_step_content_bindings` / `relationship_contents` | vínculo etapa↔conteúdo | Biblioteca | motor | verdade |
| `executive_profiles` / `executive_user_status` / `user_roles` | identidade, status e papel | Gestão de Usuários (parcial) | motor, guards, RLS | verdade **contaminada** pelo seed |
| `workspace_module_permissions` | permissão por módulo | Admin | UI e guards | verdade |
| `portal_backups` / `_blobs` / `_requests` / `portal_restores` | pontos de restauração e fila | rotina de backup | Central de Backup | verdade |
| `group_unit_leads` / `_events` | leads de Solar e Seguros | formulários das unidades | painel das unidades | verdade, isolada do CRM |
| `remarketing_*` | campanhas, contatos, conversas | motor de remarketing | módulo Remarketing | verdade, isolada |
| `crm_meta_templates` / `meta_templates` | templates oficiais | Admin | E0 e dispatch | verdade — **duas tabelas para o mesmo assunto** |

UI ≠ banco ≠ servidor (confirmado): **usuários** — a tela mostra o array `SEED_USERS` (`src/lib/executive-auth.ts`), o banco guarda status/perfil reais (6 inativos) e o servidor usa o slug fixo do código. Mesmo padrão em `workspace-permissions-store.ts` (espelho em `localStorage` sobre a permissão real do servidor). Dados que deveriam estar no servidor e hoje só existem no navegador: base de conhecimento da IA (`knowledge-base.ts`), KPIs mensais (`kpi-manager.ts`), campos personalizados, alertas do Workspace, histórico do simulador e do criativo. Nenhum deles é lido pelo servidor — o risco não é sobrescrever o banco, é **perda silenciosa por trocar de navegador/dispositivo**.

## 2. Cron, jobs e processos automáticos

| Rotina | Frequência | Origem | Executa | Grava | Pode disparar | Risco |
|---|---|---|---|---|---|---|
| `crm-lead-sync` | */5 min | pg_cron → `/api/public/crm/sync` | `runScheduledLeadSync` → sync + fila E0 adiada + tick do motor + reconciliação diária | `crm_leads`, `portal_leads`, `crm_sync_runs`, filas | **mensagens ao investidor sem ação humana** | trava por `crm_sync_runs` RUNNING < 15 min; ok |
| `portal-backup-automatico` | hora cheia | pg_cron → `/api/public/backup/run` | só **enfileira** a hora | `portal_backup_requests` | nada | 🔴 nenhum job chama `/api/public/backup/process` |
| `remarketing-engine` | **a cada minuto** | pg_cron → `/api/public/remarketing/run` | motor de remarketing | tabelas `remarketing_*` | mensagens de remarketing | sem trava de concorrência equivalente à do CRM |
| polling de tela | 20 s (`f.index`, `f.crm.index`, executive-shell, remarketing), 30–60 s (captação, reuniões, conversa, ficha) | `setInterval` no cliente | leitura/sync | — | `sync()` do `f.index` reentra a cada F5 e a cada login | custo de requisição, não de mensagem |
| tick do motor | dentro do cron de 5 min | `runRelationshipTick` | lote de 200 | fila e mensagens | envio automático | idempotência por PK determinística |

Jobs que só enfileiram e não processam: **backup** (o processador existe e está correto, mas não tem agendamento). Jobs duplicados: não encontrados. Processos que reexecutam após F5/login: apenas leituras e `sync()` do painel — o disparo de mensagem depende do cron do servidor, não da tela.

## 3. Backup

Criação: `enqueueBackupRequest` na hora cheia UTC (`referenceHourOf` zera minutos em **UTC**), chave única por hora — idempotente. Processamento: `processNextBackupRequest` com lease de 10 min e máximo de 5 tentativas, acionado por `/api/public/backup/process` — **rota existente, sem cron que a chame** (confirmado por varredura das migrações). Armazenamento: `portal_backups` + conteúdo desduplicado por hash em `portal_backup_blobs`; captura paginada de 22 tabelas; restauração nunca toca em `NEVER_RESTORE_TABLES`.

Retenção (`pruneBackups`): pontos `origin='automatico'` e não `protected`; ≤48 h mantém todos; entre 48 h e 7 dias mantém **um por bucket `Math.floor(timestamp/86400000)`**, isto é, o mais recente de cada janela de 24 h **contada em UTC**; acima de 7 dias remove. Órfãos de blob são limpos.

Resposta direta ao ponto observado: o comportamento "de hora em hora durante o dia e, na virada da meia-noite, sobra só o último do dia anterior" **não está implementado como descrito**. Duas divergências reais: (a) o corte por dia só começa depois de 48 h, então convivem 2 dias inteiros de pontos horários; (b) o "dia" é UTC, e à meia-noite de São Paulo ainda faltam 3 h para virar o bucket — o "último ponto do dia" acaba sendo o das 21:00 locais. Há diferença efetiva UTC × America/Sao_Paulo aqui. Não há risco de apagar backup válido manual ou protegido (ambos são excluídos da varredura). O risco real hoje é o oposto: **nenhum ponto novo está sendo gerado**, porque a fila não é processada.

## 4. GreenSales

Acionamento exclusivamente por consulta periódica (cron de 5 min, intervalo efetivo de `crm_automation_settings.sync_interval_minutes`) — **não existe push/webhook GreenSales → Portal**. Login por token a cada execução; `lead/list` com `total_pagina = 100`, paginação completa sem parada precoce; detalhe individual limitado a 80 leads por execução. Erros viram `GreenSalesError` tipado, registrado em `crm_sync_runs`; **não há retry nem timeout explícito** nos `fetch` (herdam o limite do runtime) — falha derruba o ciclo inteiro e o próximo ciclo recomeça do zero. Identificação única por `external_id` (`gs_<id>`) e telefone normalizado; leads existentes são atualizados, nunca duplicados; ausência da origem não apaga nada (vira "não localizados" pela reconciliação diária). Cenários em que o banco fica diferente da origem: mudança fora da janela de 80 detalhes no ciclo; alteração ocorrida durante uma falha de API até o ciclo seguinte; alteração de responsável/etiqueta que a listagem não traz. Nenhum é perda definitiva — é **atraso**, com teto não observável.

## 5. Meta / WhatsApp

Credenciais em `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_VERIFY_TOKEN` (server-side, lidas dentro dos handlers). Chamadas em `src/server/whatsapp.server.ts` para `graph.facebook.com/v20.0/<phoneId>/messages` (e `/media` para anexos), sempre por `fetch` em `try/catch`, **sem timeout, sem retry e sem backoff**. O ambiente decide antes da credencial (homologação nunca chama a Meta). O retorno é reduzido a `delivered: boolean` + mensagem de erro: **o `messages[0].id` (wamid) devolvido pela Meta não é persistido em lugar nenhum**.

Consequência direta: dos estados solicitados, existem tecnicamente apenas **solicitação/registro** e **falha**. "Aceite da Meta" existe só em memória (HTTP 2xx vira `delivered=true`), e **entrega e leitura não existem** — o webhook trata `messages` (respostas do investidor) e não consome o campo `statuses` (sent/delivered/read/failed). Sem wamid não há reconciliação possível hoje. Proteção contra reenvio é interna (PK determinística + `executedSteps`), não baseada em confirmação da Meta.

## 6. Webhooks

Um único webhook: **Meta → `/api/public/whatsapp/webhook`**. GET valida `hub.verify_token`; **POST não valida assinatura `X-Hub-Signature-256`** — qualquer chamada externa com payload no formato da Meta é processada. Roteia por número: remarketing → `recordInbound`; resposta de validação → `recordReply`; demais → `handleInboundMessage` (idempotente por id da mensagem no motor). Retorna `ok` sempre, o que evita retry infinito da Meta mas também **mascara falhas de processamento**; não há tabela de log de webhook cru. Lacunas técnicas (não implementar agora): consumo de `statuses` da Meta, verificação de assinatura, push do GreenSales, callback de pg_net para saber se o cron entregou a chamada.

## 7. IA e custo

Externo, pelo Lovable AI Gateway (consome créditos): `ai.functions.ts` (`askKnowledge`, `askKpiInsights` — gemini-2.5-flash), `brain-ai.functions.ts` (`generateBrainReport` — gemini-3.5-flash), `campaign-ai.functions.ts` (`generateCampaignDraft` — gpt-5.6-sol), `crm/lead-import.functions.ts` (visão para importar leads), `crm/meta-templates.functions.ts` (OCR de templates), `creative.server.ts` e `creative-photo.server.ts` (geração de imagem). Todas nascem de ação explícita do usuário — não há chamada ao abrir tela, ao abrir ficha, nem periódica; nenhuma rotina de cron usa IA. Local e sem custo externo: heurística de interesses, perfil inteligente, simulador, alertas do Workspace.

Risco de custo involuntário: `ai.functions.ts`, `brain-ai.functions.ts`, `campaign-ai.functions.ts` e `lead-import.functions.ts` **não têm `requireSupabaseAuth`** — são endpoints RPC públicos no site publicado. Só `meta-templates.functions.ts` está protegido. Não é cobrança automática, é superfície aberta para terceiros gastarem créditos.

## 8. Isolamento dos ambientes

Rotas separadas: `/` institucional, `/f` Financeira, `/s` Solar, `/seg` Seguros, `/f/crm`, `/remarketing`. A sessão operacional é **uma só** (`atlas:session:v3`) e o `OperationalGuard` protege `/f/*` e o Remarketing com a mesma identidade — não há sessão por ambiente, logo não há contaminação, mas também **não há segregação por tenant**. No banco, o isolamento é por tabela (`group_unit_leads`, `remarketing_*`, `portal_leads`), não por chave: **não existe `workspace_id`/`tenant_id` em nenhuma tabela**. RLS das tabelas de remarketing usa `is_portal_member()`, ou seja, qualquer membro do portal alcança tudo; a distinção por executivo só ocorre em `portal_leads` via `can_access_investor`. Templates: `meta_templates` e `crm_meta_templates` são globais, compartilhadas entre CRM e Remarketing. Permissão de módulo é por usuário, atravessa ambientes por construção.

## 9. Remarketing

Rota própria (`/remarketing`, aba separada), dados próprios (4 tabelas), motor próprio com cron próprio de 1 min, e roteamento explícito no webhook por número — este é o ponto forte do isolamento. Compartilha: sessão, guard, permissões, templates Meta, número de origem da Meta e o mesmo webhook. Uma mudança no CRM só afeta o Remarketing se tocar sessão/guard, templates Meta ou o webhook comum; as tabelas não se cruzam. Leads não são compartilhados (contatos próprios).

## 10. Portal dos Leads — causa estrutural

Origem única: `portal_leads`, alimentada por sincronização periódica (nunca push) e pelo Portal. O card é derivado do espelho `crm_leads`, e a coluna do Workspace vem de `stage_key` capturado no ciclo. A causa estrutural de "lead some da visão" e "alteração externa não refletida" é a mesma: **o estado do Portal é uma fotografia de uma consulta paginada com teto de detalhamento por ciclo**, sem evento de mudança vindo da origem e sem carimbo de "verificado em" por lead exposto na tela. Não há como distinguir, olhando o card, "não mudou" de "não foi verificado neste ciclo". Responsável e slug são resolvidos pelo `executive_profiles` no servidor; a blindagem por trigger impede exclusão, então lead nunca é perdido de fato — some apenas da visão filtrada.

## 11. Observabilidade

Existe: `crm_sync_runs` (cada execução da sincronização), `relationship_engine_log` (decisão do motor com motivo), `relationship_message_sends` (snapshot imutável), `crm_timeline` (leitura humana), `portal_lead_guard_log` (tentativa de exclusão), `portal_backup_requests` (tentativas e último erro), `crm_lead_events`, `portal_journey_events`. Retenção: nenhuma dessas tabelas tem expurgo — crescem indefinidamente (custo futuro, não risco imediato). Suficiente para investigar decisão do motor e sincronização.

Insuficiente: (a) webhook não deixa rastro do payload recebido nem do que foi descartado; (b) resposta da Meta não é gravada (nem wamid nem corpo do erro estruturado); (c) execuções de pg_cron/pg_net não têm retorno registrado no app — se a chamada HTTP falhar, ninguém sabe; (d) as rotas públicas só usam `console.error`, que se perde; (e) sem log de "backup não processado", a ausência de pontos é silenciosa.

## 12. Segurança operacional (só o que é real)

- Senhas dos 7 executivos em texto puro em `src/lib/executive-auth.ts`, dentro do bundle do cliente.
- Chave publicável do projeto escrita literalmente nas migrações de cron e usada como **única** autorização das 4 rotas públicas — a mesma chave já está no bundle do frontend. Na prática `/api/public/crm/sync`, `/backup/run`, `/backup/process` e `/remarketing/run` são acionáveis por qualquer pessoa que abra o site.
- Webhook da Meta sem verificação de assinatura.
- 4 funções de IA sem autenticação (item 7).
- Permissão de módulo aplicada só na UI; o servidor não reconfere na maioria dos casos.
- Não encontrado: token da Meta, service role ou credencial de banco expostos ao cliente — esses estão corretamente no servidor.

## 13. Dados temporários

| Dado | Onde | Fonte de verdade | F5 | Logout | Outro dispositivo | Risco |
|---|---|---|---|---|---|---|
| Sessão operacional `atlas:session:v3` | localStorage | servidor (login) | sim | não | não | sem expiração local |
| Espelho de permissões | localStorage | `workspace_module_permissions` | sim | sim | não | mostra permissão velha até o poll |
| Base de conhecimento da IA | localStorage | nenhuma | sim | sim | **não** | perda total |
| KPIs mensais e contexto | localStorage | nenhuma | sim | sim | **não** | perda total |
| Campos personalizados, alertas, lidos | localStorage | nenhuma | sim | sim | não | divergência entre executivos |
| Histórico do simulador / criativo | localStorage | nenhuma | sim | sim | não | baixo |
| Executivo responsável do visitante | localStorage do investidor | `portal_leads` após cadastro | sim | n/a | não | atribuição perdida se trocar de aparelho antes do cadastro |
| Jornada do investidor | localStorage + `portal_journey_events` | servidor | sim | n/a | não | ok |
| Estado local no backup | capturado no ponto | navegador | — | — | — | restaura estado de outro usuário se aplicado a outro navegador |

## 14. Custos e processamento desnecessário

Cron de remarketing a cada minuto (1.440 execuções/dia, mesmo sem campanha ativa); polling de 20 s em quatro telas simultâneas; `sync()` disparado a cada abertura do painel; captura completa de 22 tabelas por hora, sem incremental; funções de IA abertas ao público; `fetch` da Meta e do GreenSales sem timeout, prendendo o worker até o limite do runtime. Não há retry infinito em lugar nenhum (o backup tem teto de 5 tentativas).

## 15. Classificação final (achados novos)

🔴 CRÍTICA
1. `supabase/migrations/*` (agendamento ausente) → `/api/public/backup/process` → nenhum cron chama o processador → hora é enfileirada e nunca vira ponto de restauração → **o Portal está sem backup novo** → agendar o processador a cada minuto.
2. `src/routes/api/public/*` → `authorized()` → autorização por chave publicável que já está no bundle → sincronização, backup e motor de remarketing acionáveis por terceiros → segredo próprio por rota.
3. `src/routes/api/public/whatsapp/webhook.ts` → POST → sem `X-Hub-Signature-256` → payload forjado vira mensagem recebida e pode mudar estado do lead → validar assinatura.
4. `src/lib/ai.functions.ts`, `brain-ai.functions.ts`, `campaign-ai.functions.ts`, `crm/lead-import.functions.ts` → sem `requireSupabaseAuth` → IA paga exposta publicamente → aplicar o middleware.
5. `src/server/whatsapp.server.ts` → provedor `meta` → wamid descartado e `statuses` ignorado → entrega e leitura inexistentes, reconciliação impossível → persistir o id e consumir `statuses`.

🟠 IMPORTANTE
6. `src/server/backup.server.ts` → `pruneBackups` → bucket diário em UTC e corte só após 48 h → "último do dia" é o das 21:00 locais → usar America/Sao_Paulo e revisar a janela.
7. `src/lib/executive-auth.ts` → `SEED_USERS` → senhas em texto puro no bundle e seed sobrepondo o banco → autenticação frágil e status falso → mover cadastro para o servidor.
8. `src/server/greensales.server.ts` → `fetchPage`/`fetchLead` → sem timeout e sem retry → ciclo inteiro perdido em falha transitória → timeout curto + retry limitado.
9. `supabase/migrations/2026...143443` → `remarketing-engine` → 1 min sem trava equivalente à do CRM → execuções sobrepostas possíveis → aplicar a mesma trava de `crm_sync_runs`.
10. Ausência de `workspace_id`/`tenant_id` em todas as tabelas → isolamento é por nome de tabela → qualquer módulo novo herda o problema → definir a chave antes de criar novos módulos.
11. Observabilidade do webhook e das chamadas do pg_cron inexistente → falha silenciosa → tabela de log de entrada.
12. Duas tabelas de template (`meta_templates` e `crm_meta_templates`) → fonte dupla → decidir a canônica.

🟡 BAIXA
13. Dados operacionais só no navegador (conhecimento, KPIs, campos, alertas) → perda ao trocar de dispositivo.
14. Polling de 20 s em quatro telas → carga evitável.
15. Tabelas de log sem expurgo → crescimento indefinido.
16. `local-state` do backup restaurável em navegador de outro usuário.

## 16. Correto — não alterar

Fila de backup com lease, tentativa máxima e idempotência por hora; `NEVER_RESTORE_TABLES` e a blindagem por trigger dos Leads; desduplicação de conteúdo por hash; trava de concorrência da sincronização por `crm_sync_runs`; paginação completa do GreenSales sem parada precoce; roteamento do webhook que separa Remarketing do CRM antes de qualquer gravação; ambiente decidido antes da credencial no envio; credenciais da Meta e service role exclusivamente no servidor, lidas dentro dos handlers; `relationship_engine_log` + `relationship_message_sends` como par auditoria/snapshot; rotas de unidades e tabelas `group_unit_leads` isoladas do CRM.

## 17. Dependências entre correções

```text
#1 backup processado ── independente, pode ir primeiro (restaura a rede de proteção)
#2 segredo das rotas ─→ precede #9 (trava do remarketing) e #11 (log de cron)
#3 assinatura webhook ─→ precede #5 (statuses da Meta): mesma rota, mesmo handler
#5 wamid + statuses ──→ precede qualquer melhoria de "entrega" no CRM e a reconciliação
#7 cadastro no servidor ─→ precede #10 (tenant) e qualquer ajuste de permissão real
#10 tenant_id ────────→ deve vir antes de novos módulos; depois de #7
#6 retenção em fuso ──→ só faz sentido depois de #1
#12 template canônico ─→ antes de qualquer correção de conteúdo da Biblioteca (Bateria 3)
#8 timeout GreenSales ─→ independente
```

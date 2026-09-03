# Auditoria somente leitura — Backup da E0 (`workspace_e0_actions`)

Nenhum arquivo, banco, cron ou configuração foi alterado.

## Diagnóstico

`workspace_e0_actions` está **fora** do backup. Confirmado: a tabela não aparece na lista `BACKUP_TABLES`, que é a única fonte que define o que é capturado.

## Arquivo/função responsável

- `src/server/backup.server.ts`
  - `BACKUP_TABLES` (linhas 21–64): lista fixa de `{ table, pk }` — 39 tabelas, hoje sem a E0.
  - `captureDatabaseState()`: itera exatamente `BACKUP_TABLES`, lendo `select *` paginado de 500 em 500.
  - `createBackup()`: serializa em JSON, deduplica por hash em `portal_backup_blobs`, grava o ponto em `portal_backups`.
  - `restoreBackupPayload()`: itera `BACKUP_TABLES` na mesma ordem, pula tudo que está em `NEVER_RESTORE_TABLES`, e para as demais faz `delete` total + `insert` em lotes de 200.
  - `pruneBackups()`: retenção 48h por hora + último ponto do dia por 7 dias; opera só sobre linhas de `portal_backups`, nunca sobre tabelas de dados.
- Agendamento/execução: `src/server/backup-queue.server.ts` (chama `createBackup`, `validateBackupPersisted`, `pruneBackups`) e `src/lib/backup.functions.ts` (manual e backup de segurança pré-restauração).

## Por que a E0 ficou de fora

Não há exclusão deliberada nem bloqueio técnico. `BACKUP_TABLES` é uma lista mantida manualmente e foi ampliada em comandos anteriores (Biblioteca, permissões, apresentação, remarketing). `workspace_e0_actions` foi criada depois dessa última ampliação e ninguém a acrescentou à lista — é omissão por lista estática desatualizada.

## Estado real da tabela hoje

- Colunas: `id`, `card_id`, `crm_lead_id`, `origin`, `state`, `result`, `note`, `lead_name`, `lead_whatsapp`, `responsible_executive_id`, `reactivation`, `entry_at`, `entered_entry_stage_at`, `executed_at`, `executed_by`, `executed_by_user_id`, `created_at`.
- Constraints: PK `id`; UNIQUE `card_id`; CHECK `state IN ('PENDENTE','EXECUTADA','CANCELADA')`. **Nenhuma foreign key.**
- RLS habilitada; `service_role` tem todos os privilégios (o backup usa `supabaseAdmin`, que ignora RLS).
- Volume atual: 3 linhas (3 pendentes, 1 com `crm_lead_id`). Impacto de tamanho no payload é desprezível.

## Colunas necessárias para restauração completa

Todas as 17 colunas. O backup usa `select *` e reinsere a linha inteira, então nada precisa ser mapeado: `id` e `card_id` mantêm identidade e idempotência; `state`/`result`/`executed_*` mantêm o que já foi executado; `origin`/`responsible_executive_id`/`reactivation`/`crm_lead_id` mantêm a decisão de E0; `entry_at`/`entered_entry_stage_at`/`created_at` mantêm a linha do tempo.

## Dependências e ordem de restauração

- `portal_leads`: relação lógica (`card_id` aponta para o card), **sem FK**. `portal_leads` está em `NEVER_RESTORE_TABLES` — nunca é sobrescrita —, então não existe janela em que os cards sumam e a E0 fique órfã.
- `workspace_module_permissions`: sem relação de dados; só é consultada em tempo de execução para decidir Manual/Automático.
- `relationship_message_sends`: sem relação; nem sequer está no backup hoje.
- `crm_timeline`: sem FK e também em `NEVER_RESTORE_TABLES`.

Conclusão: **nenhuma ordem específica é exigida**. A posição na lista é indiferente; o natural é colocá-la junto do bloco de Workspace, após `workspace_module_permissions`.

## Correção mínima recomendada

Acrescentar uma linha em `BACKUP_TABLES` (`src/server/backup.server.ts`):

```ts
{ table: "workspace_e0_actions", pk: "id" },
```

Decisão pendente do usuário: se essa tabela deve ou não entrar também em `NEVER_RESTORE_TABLES`. Recomendação: **entrar em `NEVER_RESTORE_TABLES`**, para ficar coerente com `portal_leads`/`crm_timeline` — restaurar um estado antigo reabriria E0 já executadas e poderia gerar re-execução manual duplicada. Assim a tabela passa a ser capturada e auditável, mas nunca sobrescrita.

## Migration

**Não é necessária.** É apenas inclusão em lista de código. Grants e RLS já permitem leitura/escrita por `service_role`.

## Risco

Baixo em todos os eixos:
- Captura: `select *` paginado, 3 linhas hoje; sem impacto de tempo ou tamanho.
- Hash/dedup: o payload passa a mudar quando a E0 muda — comportamento correto, apenas gera menos reaproveitamento de blob.
- Retenção: `pruneBackups()` só olha `portal_backups`; continua idêntica.
- Restauração: se a tabela **não** for marcada como never-restore, o fluxo faz `delete` total + `insert`; como a linha volta com o mesmo `id` e `card_id`, o UNIQUE não é violado — mas há o risco de negócio descrito acima (E0 executada voltando a pendente). Marcando como never-restore, esse risco desaparece.

## Impacto na restauração

Com a recomendação (capturar + never-restore): a restauração passa a listar `workspace_e0_actions` em `skipped`, sem tocar nos dados; o backup de segurança pré-restauração passa a conter a E0.

## Motor de E0

A inclusão **não exige nenhuma alteração de regra do motor de E0**. `resolveExecutiveE0Mode`, `createPendingE0Action`, `executeE0Action`, `registerFirstContact`, idempotência por `card_id` e a Safety Lock permanecem intactos.

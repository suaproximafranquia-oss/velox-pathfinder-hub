# Diagnóstico — Central de Backup (/f)

Investigação somente leitura. Nada foi alterado, apagado ou executado.

## 1. Arquitetura atual

- Tela: `src/routes/f.executivo.central-backup.tsx` (rota `/f/executivo/central-backup`). Existe também a rota antiga `src/routes/executivo.central-backup.tsx`.
- Seções da tela: indicadores; "Execuções Automáticas por Hora" (fila); "Hoje — Backups Horários"; "Snapshots Diários — Últimos 7 Dias"; "Backup de Conversas"; "Restaurações Realizadas".
- Leitura: `src/lib/backup.functions.ts` (`listBackups`, limite 300, admin-only).
- Motor: `src/server/backup.server.ts` (captura, criação, restauração, `pruneBackups`, `pruneOrphanBlobs`).
- Fila: `src/server/backup-queue.server.ts` + rotas `src/routes/api/public/backup/run.ts` (registra a hora) e `.../process.ts` (executa uma solicitação).
- Tabelas: `portal_backups` (registro do ponto), `portal_backup_blobs` (conteúdo, por hash), `portal_backup_requests` (fila horária), `portal_restores` (auditoria).
- Colunas relevantes de `portal_backups`: `kind` (`completo`/`conversas`), `origin` (`automatico`/`manual`/`pre_restauracao`), `status`, `protected`, `reference_hour` (hora cheia em UTC), `created_at`, `size_bytes`, `table_counts`, `payload_hash`.
- Não existe coluna que marque "snapshot diário" ou "23:00". Isso é sempre derivado em tempo de leitura por `backupSlot()`, que converte `reference_hour`/`created_at` para America/Sao_Paulo.
- `src/lib/crm/backups.ts` (rota `/f/executivo/backups`) NÃO é backup: é uma visão somente leitura do relacionamento, calculada na hora. Não guarda nada.

## 2. Como os backups são criados

- A cada hora cheia, uma chamada externa registra a solicitação (`enqueueBackupRequest`), com unicidade por hora — idempotente, nunca duplica a hora.
- O processador executa uma solicitação por vez, com lease de 10 min e máximo de 5 tentativas; antes de criar, verifica se aquela hora já produziu ponto, então retry não duplica.
- Todo ponto automático é um snapshot COMPLETO (todas as tabelas listadas em `BACKUP_TABLES`), não incremental. Conteúdos idênticos compartilham o mesmo registro em `portal_backup_blobs` via hash.
- Não existe criação específica das 23:00: o snapshot diário é apenas o ponto horário daquela hora, eleito na leitura/limpeza.
- "Backup de Conversas" só existe por ação manual do administrador. Não há rotina automática nem retenção de 24 horas em lugar nenhum do código — a regra de 24h das mensagens NÃO está implementada hoje.

## 3. Como a retenção funciona hoje

- `pruneBackups()` é chamada em um único lugar: no fim de `processNextBackupRequest()`, após cada execução bem-sucedida da fila. Não há cron próprio de limpeza. Se a fila parar, a retenção para junto.
- Lê apenas `origin = 'automatico'`, ignora `protected = true`, agrupa por dia operacional (America/Sao_Paulo), preserva o dia corrente inteiro, mantém os 7 dias encerrados mais recentes com só o ponto da hora 23, e descarta os dias além disso.
- Comparações usam a hora do servidor convertida para o fuso da operação — o navegador não participa.
- Estado real do banco hoje (06/09, 16h SP): 17 pontos horários de hoje, 1 ponto por dia encerrado de 30/08 a 05/09, e nada anterior. Ou seja, a consolidação de `portal_backups` ESTÁ funcionando.

## 4. O que está errado (comprovado)

1. **A tela mistura pontos manuais antigos nos "Snapshots Diários"** — `f.executivo.central-backup.tsx` monta a lista só por `kind === "completo"` e `dia < hoje`, sem filtrar `origin`. Assim, pontos manuais e de segurança de 09/08 e 17/08 aparecem como se fossem snapshots diários e ainda são rotulados "· 23:00" mesmo tendo sido criados às 10:00/18:00. Isso explica a sensação de "backups antigos que deveriam ter sumido" e de janela de 7 dias desrespeitada.
2. **Quatro snapshots foram consolidados na hora errada** — 30/08, 31/08, 01/09 e 02/09 sobreviveram com o ponto das 20:00 (São Paulo), resultado da política antiga que usava a hora UTC. Como o dia não tem mais nenhum ponto das 23:00, a trava defensiva atual nunca vai corrigi-los sozinha.
3. **A fila nunca é limpa** — `portal_backup_requests` tem 245 linhas cobrindo 11 dias e cresce indefinidamente. A tela exibe as últimas 48, dando a aparência de "muitos registros horários repetidos de dias anteriores".
4. **O conteúdo dos backups apagados não é liberado** — há 167 registros órfãos em `portal_backup_blobs`, 918 MB, sem nenhum ponto que os referencie (28 hashes em uso, 195 blobs armazenados). `pruneOrphanBlobs()` existe e roda depois de `pruneBackups()`, mas seu resultado e seus erros são ignorados; na prática o espaço não está sendo devolvido. A causa provável é a execução ser cortada por tempo/CPU logo após a captura pesada, já com a solicitação marcada como concluída — a confirmar por instrumentação.
5. **A retenção depende inteiramente da fila** — não há mecanismo independente. Falha ou pausa na fila congela a limpeza silenciosamente.
6. **Não existe retenção de 24 horas para o backup de mensagens** — regra de negócio ausente no código.

Não encontrei: recriação de backups antigos, duplicação por hora, filtro de status errado, limite de paginação atrapalhando a rotina, nem risco de UTC na classificação atual (a conversão de fuso está correta).

## 5. Estado atual x esperado

| Dia (SP) | Atual | Esperado |
|---|---|---|
| 06/09 (hoje) | 17 pontos horários (00h–16h) | igual — correto |
| 05/09 | 1 ponto às 23h | correto |
| 04/09 | 1 ponto às 23h | correto |
| 03/09 | 1 ponto às 23h | correto |
| 02/09, 01/09, 31/08, 30/08 | 1 ponto às 20h cada | deveria ser o das 23h — legado da política antiga |
| até 29/08 | nenhum automático | correto |
| 09/08 e 17/08 | 4 manuais + 2 de segurança | corretos no banco, mas exibidos como snapshot diário na tela |
| Fila | 245 linhas, 11 dias | só a janela útil precisaria ficar |
| Conteúdos | 195 blobs / 1,15 GB, sendo 167 órfãos / 918 MB | apenas os 28 em uso |

## 6. Reset

É seguro e restrito. Um reset tocaria apenas `portal_backups`, `portal_backup_blobs` e `portal_backup_requests`. Nenhuma delas guarda dado operacional; não há chave estrangeira ligando outros módulos a elas, e nenhum outro módulo (CRM, Portal dos Leads, Ação do Dia, Motor, Biblioteca, KPI, Campanhas, Alertas, reuniões, WhatsApp) lê essas tabelas. `portal_restores` referencia ids de backup e deve ser preservada como auditoria.

Reset mínimo recomendado (não executado): apagar os blobs órfãos, apagar as solicitações de fila anteriores à janela útil e nada mais — os pontos de `portal_backups` já estão praticamente no formato certo. Não recomendo começar do zero: hoje existem snapshots válidos dos últimos 7 dias e os pontos manuais/de segurança são históricos legítimos.

## 7. Correção mínima recomendada (a implementar depois da sua aprovação)

1. Filtrar a seção "Snapshots Diários" por `origin = automatico`, e mostrar a hora real do ponto em vez do rótulo fixo "23:00"; listar manuais e de segurança em uma seção própria.
2. Tornar a consolidação tolerante: quando o dia encerrado não tiver ponto exatamente das 23h, eleger o ponto mais tardio do dia como snapshot oficial (em vez de não consolidar nada). Isso normaliza 30/08–02/09 sem apagar nada indevido.
3. Dar retenção própria à fila: manter as solicitações das últimas 48 horas mais as falhas, remover o resto na mesma rotina.
4. Fazer a liberação de conteúdo órfão ser verificada (contar e registrar removidos/erros) e executá-la em bloco separado, para não morrer junto com a captura.
5. Implementar a política de 24 horas do Backup de Conversas: retenção própria, sem interferir na dos snapshots gerais.
6. Manter tudo no fuso da operação (America/Sao_Paulo), como já está.

## 8. Arquivos/funções que seriam alterados

- `src/server/backup.server.ts` — `pruneBackups`, `pruneOrphanBlobs`, política de retenção.
- `src/server/backup-queue.server.ts` — limpeza da fila.
- `src/routes/f.executivo.central-backup.tsx` — separação das seções e rótulos.
- `src/lib/backup.functions.ts` — apenas se a tela precisar de um recorte adicional.

## 9. Migration

Desnecessária para a correção mínima: toda a política é derivável das colunas existentes. Só se tornaria necessária se você quiser uma marcação explícita e permanente de "snapshot diário" na linha do backup.

## 10. Risco

🟢 baixo — as mudanças ficam contidas nas três tabelas de backup e na tela da Central, sem tocar em dados operacionais.

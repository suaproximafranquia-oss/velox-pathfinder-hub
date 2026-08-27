# Validação técnica — Bloco BACKUP (sem implementação)

Nada foi alterado. Verifiquei o cron real, o histórico de chamadas HTTP do banco, a rota `/api/public/backup/run`, o serviço `src/server/backup.server.ts` e a estrutura de `portal_backups`.

## Situação confirmada hoje

- Job `portal-backup-automatico`, ativo, `0 * * * *`, chamando `/api/public/backup/run` via `net.http_post`.
- Histórico do banco confirma o corte: há registros com `Timeout of 5000 ms reached` em chamadas de rotina. O timeout é do lado do banco, não do servidor.
- A rota faz tudo em uma única requisição: captura, grava blob e insere o ponto. Só existe linha em `portal_backups` no fim, já com `status = 'concluido'`.
- `portal_backups` hoje não tem coluna de hora de referência, tentativa, lease ou erro. `status` existe, mas é sempre gravado como concluído.

## Respostas

**1. O modelo de fila é implementável?** Sim, e é a correção adequada. `pg_cron` passa a executar apenas um `INSERT` local por hora cheia — operação de milissegundos, sem rede, imune a timeout. Um segundo job por minuto apenas cutuca a rota de processamento. Nada disso exige recurso novo de infraestrutura: `pg_cron` e `pg_net` já estão em uso e o padrão de rota pública autenticada por chave já existe nesta rota.

**2. O processamento continua se o `pg_net` expirar em 5 s?** Parcialmente — e é exatamente por isso que a arquitetura não pode depender disso. O ambiente do servidor pode encerrar a execução quando o chamador desaparece; não há garantia de que a captura chegue ao fim depois do corte. A garantia tem de vir da fila: a solicitação continua `pendente`/`processando` com lease vencível, e o tique do minuto seguinte reprocessa. Ou seja: o timeout deixa de ser perda de dado e vira, no pior caso, alguns minutos de atraso. Não recomendo nenhum desenho que assuma "o servidor termina sozinho".

Complemento: dá para reduzir bastante a duração da captura processando por lotes de tabelas entre tiques, mas isso é otimização — a fila já resolve a correção.

**3. Os seis mecanismos são viáveis?** Todos, com Postgres puro:

| Mecanismo | Viável | Como |
|---|---|---|
| Chave única por hora cheia | Sim | Coluna com a hora truncada + índice único; a segunda tentativa é descartada sem erro |
| Status (pendente/processando/concluída/falha) | Sim | Coluna de status na tabela de fila, com transições no servidor |
| Lease com expiração | Sim | Colunas de dono e expiração; a tomada é um `UPDATE` condicional atômico, que impede execução dupla |
| Retry automático | Sim | Contador de tentativas + lease vencido devolve a solicitação à fila; limite de tentativas antes de marcar falha |
| Recuperação de horas anteriores | Sim | O processador pega a pendente mais antiga, não a mais recente |
| Validar só após persistência | Sim | Ponto nasce em andamento e só é considerado válido após blob gravado, linha existente e contagens conferidas |

**4. Dá para fazer sem tocar no Portal dos Leads e sem alterar histórico?** Sim. O trabalho é aditivo: uma tabela nova de fila, colunas novas opcionais em `portal_backups` e ajustes na rota de backup. Nenhuma tabela de leads é lida para escrita, nenhum ponto de restauração existente é apagado ou reescrito, e as travas de exclusão de leads não são tocadas. A retenção de 7 dias continua exatamente como está.

**5. Alguma limitação de infraestrutura impede?** Nenhuma impede. Três restrições a respeitar no desenho:

- Timeout de 5 s do `pg_net` — contornado pela fila (é a razão de existir dela).
- Duração máxima de uma requisição no servidor — motivo pelo qual a conclusão precisa ser confirmada pela fila e não pela resposta HTTP.
- A rota é pública e autenticada por chave; o novo processador precisa manter a mesma checagem, e o tique por minuto tem de sair barato quando não há nada pendente (só uma leitura).

**6. O que seria afetado**

Banco:
- Tabela nova: fila de solicitações de backup (hora de referência única, status, tentativas, lease e dono, erro, timestamps) — com GRANTs e RLS restrita à gestão/serviço.
- `portal_backups`: colunas novas opcionais (hora de referência e mensagem de erro). Sem alterar linhas existentes.

Jobs:
- `portal-backup-automatico` (id 4) muda de chamada HTTP para inserção da solicitação.
- Job novo, a cada minuto, chamando a rota de processamento.

Arquivos:
- `src/routes/api/public/backup/run.ts` — passa a delegar ao processador da fila.
- Rota nova de processamento (ou o mesmo arquivo com dois modos).
- `src/server/backup.server.ts` — `createBackup` ganha marcação de "em andamento → validado"; `pruneBackups` inalterado.
- `src/lib/backup.functions.ts` e a tela `executivo.central-backup` — exibir horas pendentes/falhas, apenas leitura adicional.

Intocados: `src/lib/lead-guard.ts`, `lead-guard.server.ts`, sincronização GreenSales, CRM, Remarketing e todo o Portal dos Leads.

## Como será verificável

Uma linha de solicitação por hora cheia, todas concluídas, sem lacunas — mesmo com timeouts continuando a aparecer no histórico HTTP do banco, que passa a ser irrelevante para a integridade do backup.

Nada foi implementado. Autorize e executo somente este bloco.

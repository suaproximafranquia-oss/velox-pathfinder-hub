# Segunda rodada de validação — diagnóstico técnico (sem implementação)

Nenhum código, banco, Portal dos Leads ou comportamento foi alterado. Abaixo, o que a leitura do código e a consulta ao banco mostraram.

## 1. Identificação de retorno do mesmo lead

Situação real hoje, verificada em `src/lib/portal-session.ts`, `src/lib/leads.ts` e `src/server/crm/lead-service.server.ts`:

**A identificação no Portal do Investidor NÃO acontece no servidor.** Em `startPortalSession()` o reconhecimento é feito por duas funções locais:

- `findLeadByEmail()` — compara o e-mail normalizado;
- `findLeadByPhone()` — compara só os dígitos do WhatsApp, exigindo 10+ dígitos.

Ambas leem `loadLeads()`, que é `localStorage` (`velox:leads:v1`). A sessão em si também é `localStorage` (`velox:portal:session:v1`).

Consequências diretas:

- **Outro navegador/dispositivo:** o cache local está vazio, `existing` volta `null` e o fluxo cai em `registerLead(...)` — ou seja, **um segundo lead é criado** para a mesma pessoa. O risco não é teórico; é o comportamento atual do caminho.
- **Nome não é usado** na identificação (só e-mail e telefone) — e isso está correto conceitualmente, nome não deve identificar.
- Existe tratamento de conflito (`resolveIdentityMatch`): e-mail de um lead e telefone de outro marca `identityConflict` para revisão manual, sem merge automático. Essa parte está bem resolvida.
- Existe deduplicação **no servidor**, mas apenas na entrada da sincronização GreenSales (`upsertLead` compara `phone` normalizado dentro de `external_source = 'greensales'` e registra `duplicidade_evitada`). Ela não cobre o lead nascido pelo Portal.

**Fonte de verdade:** hoje é ambígua. O banco (`crm_leads` / `portal_leads`) é a verdade para a operação do CRM; o `localStorage` é a verdade para a identificação no Portal. Só mensagens e timeline têm ponte oficial servidor↔navegador (`src/lib/crm/server-sync.ts`); o cadastro do lead não tem.

Conclusão: a regra que você quer ("identidade pertence ao cadastro, não ao navegador") **ainda não existe**. Falta um resolvedor de identidade no servidor, consultado antes de criar qualquer lead pelo Portal.

## 2. Eventos gerados pelo acesso ao Portal

Comportamento atual por cenário:

| Cenário | Evento gerado hoje | Camada | Jornada | Engajamento | Auditoria |
|---|---|---|---|---|---|
| A) Cadastro + 1º acesso | `lead_criado` (timeline) + Jornada Digital criada; `journey.module.opened` por módulo | relacional | Sim | Não separado | Sim |
| B) Recebe E0 e acessa | `primeiro_contato` + mensagem `msg_e0_*`; depois `atividade_portal` | relacional | Sim (com dedup de `primeiro_contato` quando há E0 na mesma janela) | Não separado | Sim |
| C) Retorno posterior | `atividade_portal` por módulo acessado, com trava de idempotência por assinatura `módulo+detalhe` | relacional | Sim — e é aqui que a jornada polui, pois cada módulo vira um item | Não separado | Sim |
| D) Executivo abre a ficha | `lead.status.changed` emitido em `executive-contact-dialog.tsx`; `conversa_aberta` na timeline | mistura | `conversa_aberta` já é técnico; `lead.status.changed` é filtrado por leitura em `executive-data.ts` | Não | Sim |
| E) Acessa material específico | `atividade_portal` com detalhe do módulo + alerta `atividade_portal` (só no 1º acesso a cada módulo) | relacional | Sim | Não separado | Sim |
| F) Clica em link externo (Instagram) | **Nenhum evento** — não existe rastreamento de clique | — | Não | Não | Não |

Pontos que a análise confirma:

- **Não existe camada de Engajamento própria.** Tudo que o investidor faz vira `atividade_portal` na timeline; o indicador de engajamento lê os mesmos registros. Por isso a Jornada fica repetitiva.
- **Não existe distinção entre primeiro acesso e retorno.** Ambos produzem o mesmo tipo de evento.
- **Ação do executivo ainda produz evento de lead.** `lead.status.changed` continua sendo emitido ao abrir; `src/lib/executive-data.ts` apenas o descarta na leitura — correção paliativa, não na origem.
- **Clique em link não existe tecnicamente.** Sem URL rastreável não há como registrar clique; hoje "mensagem enviada" é o último evento da cadeia.

## 3. Backup — causa real da inconsistência

Regra configurada e verificada:

- `pg_cron` job `portal-backup-automatico`, schedule `0 * * * *` — **de hora em hora, corretamente configurado**.
- O disparo é sempre por tempo. `createBackup()` **não** verifica se algo mudou: sempre insere uma linha em `portal_backups`. Por isso existem pontos de madrugada.
- Deduplicação existe, mas **só no conteúdo**: o payload é hasheado (SHA-256) e gravado uma única vez em `portal_backup_blobs`; o ponto de restauração continua sendo criado, apontando para o blob. Isso economiza armazenamento sem perder pontos.
- Retenção: 48 h com todos os pontos horários; de 48 h a 7 dias, apenas o último ponto de cada dia; manuais e pré-restauração nunca são apagados. **A retenção não é a causa dos buracos** — dentro de 48 h ela preserva tudo.
- Não há política específica de madrugada, nem fila, nem retry, nem debounce, nem trava de concorrência nessa rotina.

**Causa confirmada dos intervalos de 2 h:** o `cron.job_run_details` mostra **todas** as execuções horárias com status `succeeded`, inclusive nas horas sem snapshot (ex.: 27/08 às 00, 02, 04, 06, 08 e 10 UTC). Já `net._http_response` mostra, para a rota de backup, respostas com `Timeout of 5000 ms reached` — o limite padrão do `pg_net`. Ou seja: o cron dispara certo; a rota demora mais de 5 s (a captura completa gera ~6 MB), o `pg_net` corta a conexão, e em parte das execuções o trabalho é abortado antes da gravação. Quando o servidor consegue concluir mesmo assim, o snapshot aparece ~7 s após a hora cheia — o que bate com os registros existentes.

Resumindo: não é bug de agendamento nem de retenção, é **tempo de execução acima do timeout da chamada HTTP disparada pelo banco**, sem retry.

**Garantia atual de recuperação:** cada ponto contém um snapshot completo das tabelas do Portal mais o estado local opcional; a restauração cria antes um ponto de segurança (`pre_restauracao`, protegido). A fragilidade não é o conteúdo do ponto — é a lacuna de horas em que o ponto não chegou a ser gravado.

## Nada foi alterado

Portal dos Leads, dados históricos, banco, estrutura de leads, cadência, mensagens, Biblioteca de Conteúdo e templates da Meta permanecem exatamente como estavam. As correções para os três itens acima ficam para a rodada seguinte, quando você autorizar.

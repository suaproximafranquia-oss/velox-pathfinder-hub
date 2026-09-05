# Validação funcional — Central de Operações (/f)

Somente leitura da implementação atual (`src/server/crm/operations-center.server.ts`,
`src/lib/crm/operations-center.functions.ts`, `src/components/executive/central-operacoes/central-home.tsx`,
`src/routes/f.executivo.central-operacoes.tsx`). Nada foi alterado.

## 1. Planejadas
Toda linha lida da fonte primária conta como uma ação planejada, uma única vez:
- mensagem → `relationship_queue` (qualquer status), janela por `due_at`;
- ligação → `crm_cadence_tasks`, janela por `due_date`;
- E0 → `workspace_e0_actions`, janela por `created_at`;
- reunião → `portal_meetings`, janela por `scheduled_at`.

"Planejadas" é o universo; executada/pendente/cancelada são subconjuntos exclusivos da
mesma linha (um `if/else if`), logo não há dupla contagem entre categorias de status.
"Vencida" é sinalizador paralelo (ver item 4) e "pulada" vem de outra fonte (item 5).

## 2. Executadas
- mensagem: `relationship_queue.status = 'EXECUTED'`;
- ligação: `crm_cadence_tasks.status = 'DONE'`;
- E0: `workspace_e0_actions.state = 'EXECUTADA'`;
- reunião: `portal_meetings.status` em realizada/concluída.

`relationship_message_sends`, `relationship_engine_log`, `crm_timeline`, notas e
tentativas não geram linha de ação — não somam.

## 3. Pendentes
Pendente = a linha existe e não está executada, cancelada nem "não compareceu":
`PENDING/qualquer outro` na fila, `≠ DONE` na ligação, `PENDENTE` no E0, reunião com
status ainda aberto. Uma ação atrasada **continua contando em pendentes** e também
marca vencidas. Pendente e vencida NÃO são mutuamente exclusivas — vencida é um
recorte de pendentes, não uma categoria separada.

## 4. Vencidas
Derivada em memória, nada é persistido: `status = pendente` e data planejada
(`due_at` / `due_date` fim do dia / `created_at` do E0 / `scheduled_at`) anterior ao
instante da consulta. Uma ação vencida conta em pendentes E em vencidas (por desenho).

## 5. Puladas
Fonte exclusiva: `relationship_engine_log` com `action='acao_do_dia_pulada'`.
`crm_timeline` não é lido em nenhum ponto do módulo. O drill-down expõe data,
ação/título, etapa, investidor (via `details.leadId` → `portal_leads`), motivo,
executivo e o identificador (`actionKey`).

## 6. Canceladas
Somente E0 `CANCELADA` e reunião com status cancelado. Cancelamento nunca soma em
executadas (ramos exclusivos). Reunião "não compareceu" é desfecho próprio
(`nao_realizada`): entra em planejadas, mas não em executadas/pendentes/canceladas.

## 7. Período
Cada tipo usa sua própria âncora — não há `created_at` genérico:
mensagem `due_at`; ligação `due_date`; reunião `scheduled_at`; pulo `created_at` do
log; E0 `created_at` (é a data em que a obrigação nasce). Hoje/Ontem/7/30 e
personalizado apenas montam o intervalo `[from, to)` em UTC.

## 8. Métrica por executivo
Mensagem usa `relationship_queue.responsible_executive_id`, gravado por trigger no
INSERT e restaurado ao valor antigo em qualquer UPDATE — não é recalculado, não é
sobrescrito pelo dono atual, e NULL nunca é preenchido. E0 usa seu próprio
`responsible_executive_id`; reunião usa `executive_id`; ligação usa `completed_by`
(quem executou). O dono atual do lead aparece apenas como campo contextual separado.

## 9. Responsável histórico não registrado
Ações com responsável nulo caem em um bucket próprio rotulado "Responsável histórico
não registrado" e nas listas aparecem com esse mesmo texto. Nunca são distribuídas
entre executivos atuais.

## 10. Ligações
Uma linha de `crm_cadence_tasks` = uma tarefa. Tentativas/chamadas não são lidas.
`outcome SIM/NÃO` vira apenas rótulo de resultado ("Atendeu"/"Não atendeu").

## 11. Mensagens e duplicidade
Contagem exclusivamente por `relationship_queue`. `relationship_message_sends` é lida
só para exibir o snapshot no detalhe (chave `lead_id::step`), sem somar.
`relationship_engine_log` só alimenta pulos. Uma mensagem executada conta uma vez.

## 12. E0
Fonte única `workspace_e0_actions`. `crm_messages` não é consultada em nenhum ponto.
Nenhuma lógica de E0 foi tocada.

## 13. Reuniões
Fonte única `portal_meetings`. O status do banco é preservado (aparece cru no campo
"Resultado"); a classificação é apenas de leitura, por comparação normalizada.
Cancelada e realizada são ramos exclusivos.

## 14. Taxas
- taxa de execução = executadas ÷ planejadas (denominador = todas as ações do período
  daquele executivo);
- taxa de pulo = puladas ÷ (executadas + puladas).
Ambas retornam vazio ("—") quando o denominador é zero.

## 15. Drill-down
Os cartões e as células da tabela chamam os mesmos predicados usados na
consolidação, sobre a mesma lista `actions` já carregada (executivo + status, ou
`overdue`, ou tipo). Puladas usa a lista `skips` com o mesmo critério de executivo.
Número e lista são, por construção, o mesmo conjunto.

## 16. Investidor
Identificador operacional = `portal_leads.id`. Mensagem usa `lead_id`; E0 usa
`card_id`; reunião usa `investor_id`; pulo usa `details.leadId`. Ligação percorre
`crm_cadence_tasks.lead_id` → `crm_leads` → `external_id` → `gs_<external_id>` em
`portal_leads`.

## 17. Histórico e ficha
Central → executivo → ação → investidor → ficha existente
`/f/executivo/dashboard?perfil=<leadId>&escopo=<scope>`. Nenhuma ficha nova foi criada.

## 18. Somente leitura
O módulo servidor usa apenas `select`. Não há insert/update/delete/rpc, nem chamada
ao motor, à cadência, ao ownership, à Biblioteca, aos Fluxos ou ao WhatsApp. A tela
só tem filtros de período e aberturas de lista/detalhe.

## 19. Preservação
`/`, `/s`, `/seg`, Safety Lock, envio real, motor, Biblioteca, Fluxos, Workspace,
Ação do Dia, ownership, redistribuição e histórico não foram tocados. As únicas
mudanças do bloco anterior foram a coluna de snapshot na fila (aditiva) e os arquivos
novos da Central, mais um item de menu.

## 20. Conclusão

A) PLANEJAMENTO: NÃO — ver I-1 e I-2.
B) STATUS: SIM (com a ressalva explícita de que vencida é subconjunto de pendente, item 4).
C) PERÍODO: SIM — cada tipo usa sua âncora; ver a limitação I-3.
D) EXECUTIVO: SIM.
E) DUPLICIDADE: NÃO — nenhum caminho conta a mesma ação duas vezes.
F) DRILL-DOWN: SIM.
G) SOMENTE LEITURA: SIM.
H) PRESERVAÇÃO: SIM.

I) PROBLEMAS REAIS

1. **Ligações planejadas não existem como linha.** `crm_cadence_tasks` hoje só recebe
   registro na conclusão (banco atual: 12 linhas, todas `DONE`). Consequência: a
   Central mostra ligações executadas, mas nunca ligações pendentes ou vencidas —
   o número de "planejadas" de ligação é, na prática, igual ao de executadas.

2. **E0 pendente é sempre "vencido".** A âncora do E0 é `created_at`; como qualquer
   E0 criado antes de agora é anterior ao instante da consulta, todo E0 pendente é
   marcado como vencido (banco atual: 5 pendentes). Falta um prazo próprio de E0.

3. **A janela é por data planejada, não por execução.** Uma ação planejada fora do
   período mas executada dentro dele não aparece. "Executadas: N" hoje significa
   "planejadas no período e já executadas", o que subestima a produção do dia.

4. **Sem filtro de ambiente/escopo na fila.** A leitura de `relationship_queue` não
   filtra `scope` nem leads de teste. Hoje é inofensivo (todas as 38 linhas são
   `production`), mas uma rodada de homologação passaria a contar junto.

5. **Ligação sem correspondência no Portal fica sem ficha.** O vínculo depende de
   `crm_leads.external_id` no formato GreenSales (`gs_*`); leads sem esse
   identificador aparecem sem link para a ficha.

Nada foi corrigido nesta etapa, conforme solicitado.

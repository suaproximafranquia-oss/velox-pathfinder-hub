# Central de Operações (/f) — mapa técnico + decisão do responsável planejado

Levantamento somente de leitura. Nada foi alterado.

## Decisão fechada: responsável no planejamento (OPÇÃO A)

- Adicionar `responsible_executive_id` **somente em `relationship_queue`**, preenchida automaticamente no nascimento do item (upsert em `repository.server.ts`) com o dono válido naquele instante, e nunca recalculada depois.
- Itens antigos ficam nulos: "responsável histórico não registrado", sem preenchimento retroativo.
- `crm_cadence_tasks` **não** recebe coluna: linhas de ligação só existem na conclusão (upsert `DONE` com `completed_by`); não há linha de "ligação planejada" persistida onde gravar um snapshot — o planejado de ligações é derivado ao vivo da titularidade do lead.
- E0 (`workspace_e0_actions.responsible_executive_id`), reuniões (`executive_id`) e agenda (`executive_id`) já guardam o responsável; nada mais precisa de coluna.
- Problema histórico resolvido pela coluna, em uma frase: preservar para a Central **a qual executivo uma mensagem de cadência foi planejada**, mesmo se o lead mudar de responsável depois.

## 1. Ações planejadas (fontes usadas hoje pela Ação do Dia)

`src/server/crm/daily-actions.server.ts` monta a lista a partir de cinco fontes:

| Fonte | Tabela | Campos principais | Status | Executivo | Investidor | Chave da ação |
|---|---|---|---|---|---|---|
| Mensagens | `relationship_queue` | `lead_id, flow, step, due_at, status, attempts, executed_at, result, reason, flow_version_id` | `PENDING`, `EXECUTED` | **não existe coluna** — vem de `portal_leads.responsible_executive_id` | `lead_id` = `portal_leads.id` | `queue:<lead>:<flow>-<step>:<id>` |
| Ligações | `crm_cadence_tasks` | `lead_id (crm_leads), channel, step_day, cycle_date, due_date, status, outcome, completed_at, completed_by, note` | `PENDING`/`DONE` + `outcome SIM/NAO` | `completed_by` (uuid, só após execução) | `crm_leads` → `gs_<external_id>` | `cadence:<lead>:ligacao-<step>:<ciclo>` |
| Primeiro contato | `workspace_e0_actions` | `card_id, state, created_at, executed_at, executed_by, result, responsible_executive_id, ownership_seq` | `PENDENTE`, `EXECUTADA`, `CANCELADA` | `responsible_executive_id` | `card_id` = `portal_leads.id` | `first_contact:<card>:e0` |
| Reuniões | `portal_meetings` | `investor_id, executive_id, scheduled_at, duration_min, status, topic, cancel_reason` | livre (`Cancelada`, `Realizada`…) | `executive_id` | `investor_id` | `meeting:<lead>:reuniao:<horário>` |
| Agenda / fechamento | `workspace_agenda_events`, ocorrências E20 | `executive_id, starts_at, priority` / `leadId, step, dueDate` | — | `executive_id` | agenda não tem lead | `agenda:…` / `closure:…` |

"Vencida" não é status gravado: é derivado (`due_at`/`scheduled_at` < data operacional). "Cancelada" só existe em E0 (`CANCELADA`) e em reunião (`status`).

## 2. Ações executadas

Não existe registro único. Cada tipo tem sua fonte oficial:

- mensagem → `relationship_queue.status='EXECUTED'` + `executed_at` + `result`;
- ligação → `crm_cadence_tasks.status='DONE'` + `outcome` + `completed_at`;
- primeiro contato → `workspace_e0_actions.state='EXECUTADA'` e `crm_messages.id like 'msg_e0_%'`;
- reunião → `portal_meetings.status`;
- pulos/observações → `relationship_engine_log.action` (`acao_do_dia_pulada`, `acao_do_dia_observacao`, `acao_do_dia_reuniao_resolvida`).

Risco real de dupla contagem: a mesma execução de mensagem aparece em `relationship_queue`, em `relationship_message_sends` e em `relationship_engine_log`. A regra deve ser: **fila = contagem; snapshot e log = detalhe**.

## 3. Mensagens

Fonte oficial de estatística: `relationship_queue` (uma linha por obrigação). `relationship_message_sends` é o snapshot imutável e traz `library_id, library_version, rendered_body, content_url, step, origin, executive_id/name, simulated, sent_at, message_id`. Com as duas juntas é possível determinar de forma confiável etapa, fluxo (`flow`, `flow_version_id`), data planejada (`due_at`), data executada (`executed_at`/`sent_at`), mensagem e versão usada, se foi manual (`message_id like 'acao_do_dia:%'`, `origin='executivo'`) e se foi simulada. O único campo fraco é o executivo na fila (ver item 9): hoje 36 de 47 snapshots têm `executive_id`.

## 4. Ligações

`crm_cadence_tasks`: planejada = `status PENDING` + `due_date`; realizada = `DONE` + `completed_at`; `outcome='SIM'` (atendeu) / `'NAO'` (não atendeu); executivo em `completed_by`; investidor via `crm_leads` (`gs_<external_id>`); etapa em `step_day`/`step_key`; ciclo em `cycle_date`. "Chamou" e tentativas não são linhas separadas: as tentativas são derivadas das conclusões do mesmo ciclo. Logo, a Central deve contar **tarefas concluídas**, não tentativas.

## 5. Reuniões

`portal_meetings` distingue planejada (data futura, status aberto), cancelada (`Cancelada` + `cancel_reason`) e realizada/não compareceu (via status gravado pelo desfecho). Executivo (`executive_id`/`executive_name`), investidor (`investor_id`) e data (`scheduled_at`) existem. O vocabulário de status é texto livre, sem restrição no banco.

## 6. Skips

Ficam em `relationship_engine_log` com `action='acao_do_dia_pulada'` e `details` contendo `actionKey, leadId, kind, step, title, motivo, executivo, executadoPor, operationalDate, at`; e espelhados em `crm_timeline` (`event`, `origin='acao_do_dia'`, `reason`, `actor_id`, `investor_id`). Isso já permite "X puladas" com drill-down por motivo, sem novo mecanismo. Limitação: hoje há 3 registros e a leitura é feita por JSON, sem índice — a Central precisará filtrar por `action` + período.

## 7. Notas

`investor_notes` tem `lead_id`, `body`, `author_user_id`, `author_executive_id`, `author_name`, `scope`, `source_key` e datas. Notas vindas da Ação do Dia trazem `source_key='acao_do_dia:<item da fila>'`, o que liga a nota à ação sem misturar contagens.

## 8. Histórico

`relationship_engine_log` (`scope, action, actor, details jsonb, created_at`) é o log técnico; `crm_timeline` (`investor_id, event, origin, reason, actor_id, at`) é a leitura humana. Ligação por `details.actionKey` / `investor_id`.

## 9. Executivo responsável (ponto frágil)

Fonte correta hoje: `portal_leads.responsible_executive_id` (115/115 preenchidos), com histórico em `lead_ownership_history`. `relationship_queue` e `crm_cadence_tasks` **não gravam o executivo da ação planejada** — só quem executou. Consequência: métricas por executivo de ações *pendentes* dependem de join com o dono atual do lead, e trocas de titularidade reatribuem retroativamente o planejado.

## 10. Investidor

Chave operacional: `portal_leads.id` (todas as fontes já apontam para ele; ligações passam por `crm_leads` → `gs_<external_id>`). `canonical_investor_id` existe mas é parcial (91/115 leads, 25/38 na fila) e serve para consolidar pessoa, não para contar ação.

## 11. Datas disponíveis

`relationship_queue.due_at/created_at/executed_at`; `crm_cadence_tasks.due_date/completed_at/cycle_date`; `workspace_e0_actions.created_at/executed_at`; `portal_meetings.scheduled_at`; `relationship_engine_log.created_at` (+ `details.operationalDate`); `crm_timeline.at`; `investor_notes.created_at`; `relationship_message_sends.sent_at`.

## 12. Métricas viáveis hoje

Calculáveis sem nova estrutura: executadas, pendentes, puladas, canceladas, por tipo (mensagem/ligação/reunião/E0), por etapa, por período, taxa de execução e de skip. **Não confiável hoje:** "planejadas por executivo" no passado — porque o planejado não guarda executivo e a titularidade muda.

## 13. Drill-down

Caminho já viável: executivo (`portal_leads.responsible_executive_id`) → ação (id da fila / tarefa / E0 / reunião) → investidor (`portal_leads.id`) → histórico (`crm_timeline` por `investor_id`, `relationship_engine_log` por `details.actionKey`) e ficha (`/f/executivo/dashboard?perfil=<leadId>&escopo=<scope>`).

## 14. Antiduplicidade

Fonte primária por tipo — e nada mais é somado:

```text
mensagem        → relationship_queue        (sends = snapshot, log = auditoria)
ligação         → crm_cadence_tasks
primeiro contato→ workspace_e0_actions      (crm_messages = prova)
reunião         → portal_meetings
skip/observação → relationship_engine_log   (crm_timeline = espelho humano)
```

## 15. Camada de leitura

Sim: tudo acima é consulta. A Central não decide próxima ação, não executa, não envia, não altera cadência, ownership, E0, Biblioteca nem Fluxos.

## 16. Estrutura mínima que faltaria

Apenas uma: **executivo responsável no momento do planejamento**. A menor solução é uma coluna `responsible_executive_id` gravada em `relationship_queue` (e opcionalmente em `crm_cadence_tasks`) no nascimento do item — aditiva, sem tocar em histórico. Sem ela, o painel por executivo usa o dono atual do lead, que é aceitável para "hoje", mas impreciso para períodos passados.

## 17. Escopo

Exclusivo `/f`. `/`, `/s`, `/seg`, Safety Lock, envio real, históricos, cadências, ownership, redistribuição, Biblioteca, Fluxos, Ação do Dia e Workspace permanecem intocados.

---

## Conclusões

- **A) Já temos:** filas, execuções, snapshots, reuniões, E0, skips, notas e timeline, todos com investidor e datas.
- **B) Falta:** executivo no item planejado; vocabulário de status de reunião não normalizado.
- **C)** Sim — a Central é majoritariamente leitura/consolidação.
- **D)** Há risco de duplicidade só nas mensagens (fila × snapshot × log); evita-se fixando a fila como única fonte de contagem.
- **E)** Menor estrutura adicional: uma coluna de executivo responsável no item de fila.

## Próximo bloco proposto (a aprovar)

1. Página `/f/executivo/central-operacoes`, restrita a admin/gestor.
2. Consolidação somente-leitura por executivo e período, com as fontes primárias do item 14.
3. Drill-down: número → lista de ações → investidor → histórico/ficha existentes.
4. Opcional, decidido antes de construir: coluna aditiva de executivo responsável no item planejado.

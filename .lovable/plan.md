# Auditoria — Reset controlado de homologação da Financeira /f

Somente auditoria. Nada foi alterado: nenhum DELETE, UPDATE, migration ou código.

## Fotografia real do banco (hoje)

| Tabela | Linhas | Natureza |
| --- | --- | --- |
| `portal_leads` | 97 (79 `green_sales`, 3 marcados `is_test`) | espelho GreenSales/Portal — intocável |
| `crm_leads` | 622, **todos** `external_source=greensales`, `is_test=0` | espelho da origem — intocável |
| `investors` / `investor_identifiers` | 90 / 90 | identidade Fase 1 — preservar |
| `relationship_cadences` | 79 (**todas** `scope=production`) | estado operacional |
| `relationship_queue` | 27 (`production`; **máx. 1 PENDING por lead**) | fila de mensagens |
| `relationship_decisions` | 108.956 | log de decisão do motor |
| `relationship_engine_log` / `crm_timeline` / `crm_lead_events` | 3.091 / 968 / 2.265 | histórico |
| `crm_messages` | 93 (77 são `msg_e0_*`) | conversas + trava de E0 |
| `crm_cadence_tasks` | 11 | execuções de ligação |
| `workspace_e0_actions` | 4 (3 PENDENTES) | E0 manual |
| `portal_meetings` / `workspace_agenda_events` | 1 / 1 | agenda |
| `relationship_message_library` | 67 | Biblioteca oficial — configuração |

Descoberta central: **não existe hoje nenhuma linha com `scope='homologation'`** (cadences, queue, decisions, engine_log = 0). O reset já existente (`workspace-reset.server.ts`) apaga exatamente `scope='homologation'` + leads com marcação de teste — ou seja, **rodá-lo hoje não limparia praticamente nada** (só 3 leads de teste e ruído de `duplicidade_detectada`).

## 1. O que é realmente "sujeira" no Workspace/CRM

Não são leads fictícios. A contaminação da Ação do Dia é **operacional e derivada**, não cadastral:

- **A fila de ligações** é a maior fonte de ruído: 419 `crm_leads` em `zero_contato`/`frio`, dos quais **215 têm data-base ≥ 18/08/2026** (`cadence_activation_date`). Ela é **recalculada em tempo real** por `buildCadenceQueue`, não persistida — logo, aparecem centenas de "ligações do dia" derivadas da carga histórica do GreenSales.
- Estado do motor de leads históricos: 79 `relationship_cadences` + 27 itens de fila + 77 marcas `msg_e0_*` que já "consumiram" a E0 desses leads.
- Ruído de auditoria de testes antigos (`crm_timeline.event='duplicidade_detectada'`) e 108.956 `relationship_decisions`.
- 3 `portal_leads` com `is_test=true` (`ld_test*`) e seus derivados.

Conclusão honesta: **um reset de dados não resolve sozinho** — a maior parte do ruído nasce de recálculo sobre o espelho GreenSales, que não pode ser apagado.

## 2. Tabelas afetadas por um reset operacional

Operacionais (candidatas): `relationship_cadences`, `relationship_queue`, `relationship_decisions`, `relationship_events`, `relationship_engine_log`, `relationship_message_sends`, `relationship_e20_*`, `crm_cadence_tasks`, `crm_lead_events`, `crm_timeline`, `crm_messages`, `workspace_e0_actions`, `portal_meetings`, `workspace_agenda_events`, `portal_journey_events`, `portal_engagement`.

## 3. Preservação obrigatória

`portal_leads`, `crm_leads`, `crm_pipelines`, `crm_pipeline_stages`, `crm_connections`, `crm_sync_runs` (GreenSales); `investors`, `investor_identifiers`, `canonical_investor_id`; `executive_profiles`, `user_roles`, `workspace_module_permissions`, `executive_user_status`; `crm_automation_settings` (inclusive `cadence_activation_date`), `relationship_non_business_days`; `relationship_message_library`, `relationship_contents`, `relationship_step_content_bindings`, `meta_templates`, `crm_meta_templates`, `knowledge_documents`, `magazine_*`, `presentation_chapters`; Safety Lock (é **código**, `whatsapp-safety-lock.server.ts`, não dado — nada a fazer); `portal_backups`, `portal_lead_guard_log`.

## 4. Dependências que quebram

- **`crm_messages` `msg_e0_*` é a trava de idempotência da E0.** Apagar reabre a E0 para 77 leads reais — pode gerar enxurrada de E0 se o modo automático estiver ligado. Apagar sem apagar `relationship_cadences` deixa estado órfão; apagar as cadências sem apagar as mensagens faz o `bootstrapMissingCadences` **recriar** cadências a partir das mensagens no próximo tick.
- Apagar `relationship_cadences` sem `relationship_queue` deixa itens PENDING sem dono → viram ações do dia sem contexto.
- `crm_cadence_tasks` é o único histórico de tentativas de ligação: apagá-lo faz a fila recomeçar de L2 para todo lead elegível — **aumenta** o ruído.
- FKs para `portal_leads`/`crm_leads` são de filhos para pais; limpar filhos não fere os pais.
- `investors.canonical_investor_id` aponta para identidade, não para operação: não é afetado.

## 5. Reset controlado recomendado (desenho, não executado)

Duas alavancas, nesta ordem:

1. **Silenciar o legado sem apagar** (preferido, reversível): mover `cadence_activation_date` para a data do marco de ativação da homologação. Efeito imediato: `buildCadenceQueue` deixa de gerar as ligações históricas (o corte já é aplicado por lead em `baseDate < activationDate`), e nada é destruído. Resolve ~215 obrigações falsas com **uma linha de configuração**.
2. **Limpeza operacional cirúrgica**, executada por rotina server com `dryRun` obrigatório e relatório aprovado antes:
   - `relationship_queue` PENDING/PROCESSING, `relationship_cadences` abertas, `relationship_decisions`, `relationship_events`, `relationship_engine_log`, `relationship_message_sends`;
   - `crm_messages` **apenas** as `msg_e0_*` dos leads dentro do escopo (senão a E0 não reabre) + conversas de teste;
   - `crm_cadence_tasks`, `workspace_e0_actions`, `portal_meetings`, `workspace_agenda_events`, ruído `duplicidade_detectada`;
   - preservar 1 lead-controle real por ID estável (hoje o guard já protege `ld_msy1onox18t1`).
   Tudo com snapshot/backup prévio e contagens antes/depois.

O ideal é **1 sem 2** para a primeira rodada; 2 só se a homologação exigir zerar histórico visível.

## 6. Ciclo do novo lead de teste — como o código se comporta hoje

```text
GreenSales → sync → crm_leads + portal_leads (card)
   → identidade (Fase 1: investors/investor_identifiers por telefone normalizado)
   → responsável (hoje em portal_leads.responsible_executive_id)
   → modo E0 do RESPONSÁVEL (workspace_module_permissions.e0_automatico; padrão MANUAL)
        manual     → workspace_e0_actions(state=PENDENTE) → Ação do Dia, prioridade máxima
        automático → registerFirstContact direto
   → execução da E0 → crm_messages msg_e0_<card> + evento FIRST_CONTACT_SENT
   → relationship_cadences: CADENCE_NOT_STARTED → CADENCE_ACTIVE (só agora conta)
   → tick agenda a PRÓXIMA etapa em relationship_queue (1 item)
   → Ação do Dia mostra a etapa quando due_date ≤ hoje
```

Confirmado na leitura de código/dados:
- `resolveExecutiveE0Mode` decide pelo responsável, com padrão seguro **manual**; sem responsável, manual.
- `executeE0Action` usa o **mesmo** `registerFirstContact` do automático (mesma Safety Lock, mesma trava `card_id` UNIQUE).
- `initialRecord` nasce em `CADENCE_NOT_STARTED`; só `FIRST_CONTACT_SENT` leva a `CADENCE_ACTIVE` — **a cadência não conta antes da E0**.
- Mensagem oficial vem de `relationship_message_library` (67 linhas ativas) — a auditoria de resolução por etapa individual continua pendente de validação autenticada.

### Regra "o tempo não avança a cadência" — estado atual

- **Mensagens: OK.** `relationship_queue` tem **no máximo 1 PENDING por lead** (verificado). `applyEvent` só marca etapa executada com `MESSAGE_SENT`/`CONTENT_SENT`, e o agendamento parte da execução. Atraso mantém a mesma etapa pendente, não empilha E2/E3/E4.
- **Ligações: ATENÇÃO.** A fila é recalculada e a próxima tentativa parte da última **execução registrada** (`crm_cadence_tasks`), então também não empilha; mas como nada é persistido, a data recalculada muda quando muda `stage_entered_at`, e a carga GreenSales criou dívida em massa. É este o vetor de "dívida artificial" hoje.

## A–E

- **A) Resetar:** estado do motor (`relationship_cadences`, `queue`, `decisions`, `events`, `engine_log`, `message_sends`), `msg_e0_*` do escopo, `crm_cadence_tasks`, `workspace_e0_actions`, reuniões/agenda de teste, ruído `duplicidade_detectada`.
- **B) Preservar:** tudo do item 3 — Portal dos Leads, GreenSales, identidade Fase 1, usuários/permissões, configuração de cadência, Biblioteca, Safety Lock, backups e auditoria do guard.
- **C) Riscos:** reabertura em massa da E0 se `msg_e0_*` cair com modo automático ativo; recriação de cadências pelo `bootstrapMissingCadences`; perda do histórico de tentativas fazendo a fila reiniciar em L2; perda de rastro de auditoria (`engine_log`/`timeline`); reset sem alterar `cadence_activation_date` **não** limpa a Ação do Dia.
- **D) Sequência segura:** backup → congelar sync e cron do motor → mover `cadence_activation_date` para o marco → medir a Ação do Dia → só se necessário, dry-run da limpeza com contagens e lista de IDs → aprovação explícita → execução transacional → conferência de contagens e do lead-controle → reativar sync/cron.
- **E) Teste mínimo pós-reset:** 1 lead novo pelo fluxo normal; conferir card + identidade + responsável; com responsável em **manual**, confirmar E0 PENDENTE na Ação do Dia; executar e conferir `workspace_e0_actions=EXECUTADA`, `msg_e0_*`, cadência em `CADENCE_ACTIVE` e **exatamente 1** item em `relationship_queue`; avançar 2 dias sem executar e confirmar que continua a **mesma** etapa pendente (não surgem E2/E3); executar a etapa e confirmar que a seguinte nasce a partir da execução.

## Decisões que preciso de você

1. Ir só pela alavanca 1 (mudar o marco, sem apagar) ou também executar a limpeza?
2. Se limpar: apagar `msg_e0_*` (reabre E0 dos leads reais) ou preservá-las?
3. Manter `relationship_decisions`/`engine_log` como histórico ou zerar?

# INVESTIGAÇÃO 5 — DECISÕES FINAIS ANTES DA REENGENHARIA DA FINANCEIRA

Rodada exclusivamente de leitura. Nada foi alterado: sem código, sem banco, sem migration, sem rota, sem cron, sem Meta, sem GreenSales, sem mensagem, sem tocar a Global WhatsApp Safety Lock.

**Achado principal desta rodada:** o sistema atual **já executa etapas E1+ automaticamente**, pelo cron, sem intervenção humana. `runRelationshipTick` chama `engine.tick(leadId)` para até 200 leads por ciclo, e o motor decide e despacha. Isso **contradiz frontalmente** a regra de negócio central do plano futuro ("E0 é a única etapa automática"). Não é um detalhe de implementação — é a maior incompatibilidade entre o que existe e o que foi planejado, e não havia sido identificada nas investigações 1 a 4.

---

## 1 — IDENTIDADE DO LEAD

Identificadores em uso, todos confirmados no código:

| Identificador | Onde vive | Papel |
|---|---|---|
| `portal_leads.id` (`ld_…`, `gs_…`, `TEST-…`) | Portal | **ID canônico operacional** — é o `leadId` do motor, da fila, da Ação do Dia |
| `crm_leads.id` | Espelho da origem | Identidade do **motor legado de ligações** (`CadenceRef.crmLeadId`) |
| GreenSales `id` (`58897`) | `external_id` | Chave da sincronização |
| `identity_key` (`p:<fone>` / `e:<email>`) | `portal_leads` | Chave de deduplicação, com UNIQUE parcial |
| `whatsapp_key` / `email_key` | `group_unit_leads` | Deduplicação da captação Solar/Seguros |
| `msg_e0_<cardId>` | `crm_messages.id` | ID determinístico da E0 |
| `e0_<leadId>` | evento do motor | Chave de idempotência do primeiro contato |
| `actionKey` = `source:lead:etapa:instância` | Ação do Dia | Chave determinística **em memória**, não persistida |

**Respostas:**
1. **ID canônico: `portal_leads.id`.** Correto e consistente — o motor, a fila, as mensagens e a Ação do Dia usam todos ele.
2. **Risco de identidade por dado pessoal:** existe, mas **de forma controlada e correta**. `resolve_portal_identity` usa telefone e e-mail **apenas para deduplicar**, com `pg_advisory_xact_lock` por chave, e registra divergências em `identity_alternates` / `identity_conflict` em vez de sobrescrever. É um dos pontos mais bem construídos do sistema. **Nome nunca é usado como identidade** — confirmado.
3. **Duplicidades possíveis:** sim, um caso previsto e tratado — a "identidade cruzada" (telefone aponta para um cadastro, e-mail para outro). A função **não funde** os registros: marca o conflito nos dois e segue com o do telefone. Fica um lead duplicado consciente, sinalizado.
4. **Relação GreenSales → Portal → CRM:** `external_id` → `crm_leads` (espelho) → `ensureWorkspaceCard` cria `portal_leads` com id `gs_<external_id>` → CRM lê `portal_leads`. A ponte é o prefixo `gs_` + o `external_id`.
5. **A reengenharia deve tratar o lead só pelo ID interno? SIM** — e há um porém: **duas identidades convivem hoje**. A Ação do Dia carrega `leadId` (`portal_leads.id`) **e** `cadence.crmLeadId` (`crm_leads.id`), porque as ligações legadas exigem a segunda. Unificar ou aposentar essa segunda identidade é decisão obrigatória da reengenharia.

## 2 — CICLO DE VIDA E FONTES DA VERDADE

| Assunto | Fonte da verdade hoje | Conflito? |
|---|---|---|
| Existência do lead | `portal_leads` (blindada por trigger contra delete/truncate) | Não |
| Estágio/coluna | **GreenSales** — `resolveBoardStage(pipeline, tagIds)` deduz a coluna pelas etiquetas a cada sync | Não, mas é externo e frágil |
| Responsável | **Disputado** — ver abaixo | **SIM** |
| Relacionamento/cadência | `relationship_cadences` + máquina de estados | Não |
| Ligações | `crm_cadence_tasks` (legado) | Parcial |

**5. Duas partes acreditando ter a verdade — confirmado, dois casos:**

- **Responsável:** `ensureWorkspaceCard` grava `null`; `ensureOwnership` (navegador) grava o executivo padrão; `assignPortalLeadOwner`/`redistributePortalLead` gravam a escolha da gestão; `syncPortalLead` preserva o atual. Quatro escritores, nenhum árbitro. Já documentado na Investigação 2, aqui confirmado como conflito de *source of truth*, não só como bug.
- **Próxima ação:** `relationship_queue` (motor) e `crm_cadence_tasks` (legado de ligações) coexistem, e a Ação do Dia lê **as duas** e as reconcilia por precedência em memória. A verdade da "próxima ação" está distribuída entre duas tabelas e um cálculo de tela.

**6. Estados que podem sumir na sincronização:** o **estágio**. Como a coluna é deduzida das etiquetas a cada sync, um lead cujas etiquetas deixem de mapear para uma coluna conhecida permanece no banco mas **desaparece do quadro** (já registrado na rodada de diagnóstico anterior). Cadência, mensagens e eventos **não** somem — `syncPortalLead` preserva dono e o histórico é append-only.

## 3 — GREENSALES E REATRIBUIÇÃO

1. **Mesmo ID?** Sim. O id é derivado do `external_id`; mudança de coluna ou de responsável não cria lead novo.
2. **Histórico preservado?** Sim — `crm_timeline`, `crm_lead_events`, `crm_messages` e `relationship_message_sends` são append-only.
3. **Responsável antigo:** o campo `responsible_executive_id` é **sobrescrito** (é um campo, não um histórico). O histórico existe **em paralelo**, mas de forma desigual: `transferLeadOwnership` e `ownership.ts` gravam timeline; **`assignPortalLeadOwner` e `redistributePortalLead` não gravam evento no servidor**. Ou seja, há trocas de responsável que não deixam rastro próprio. **É uma lacuna real de auditoria.**
4. **Motor confunde troca de responsável com lead novo?** **Não.** A cadência é chaveada por `lead_id`; o responsável não participa da identidade. Correto.
5. **Nova E0 indevida?** **Não pela troca de responsável.** A E0 é protegida por evento idempotente `e0_<leadId>` e por `executedSteps`. Existe, porém, o caminho de **reentrada** (`resolveEntryFlow` + `newCommercialEntry`): se a mesma pessoa se cadastrar de novo na origem, o sistema **intencionalmente** registra `e0_reentrada` e roda o fluxo de reentrada. É comportamento desejado, não bug — mas a reengenharia precisa preservá-lo conscientemente.
6. **Lead sumir sem ser apagado? SIM** — o caso das etiquetas não mapeadas (item 2.6). Confirmado.
7. **A nova arquitetura precisa obrigatoriamente preservar:** o id derivado do `external_id`; a blindagem contra delete; o append-only da timeline; a idempotência `e0_<leadId>`; a deduplicação por `identity_key` com lock; a distinção reentrada x lead novo.

## 4 — PORTAS DE ENTRADA DO MOTOR (inventário completo)

| # | Origem | Função | Chega ao motor? | Efeito |
|---|---|---|---|---|
| 1 | pg_cron (minuto) | `runScheduledLeadSync` → `runLeadSync("cron")` → `intakeLead` → `registerFirstContact` | Sim | **Cria E0** |
| 2 | pg_cron, mesmo ciclo | `processDeferredFirstContacts` → `registerFirstContact` | Sim | **Executa E0 adiada** |
| 3 | pg_cron, mesmo ciclo | **`runRelationshipTick` → `engine.tick()`** | Sim | **Decide e executa E1+ — automático** |
| 4 | Idem, dentro do tick | `bootstrapMissingCadences` → `engine.handleEvent(FIRST_CONTACT_SENT)` | Sim | **Reconstrói cadência** a partir de `msg_e0_%` |
| 5 | Idem, fim do tick | `runClosureTick` | Sim | Executa E27/Finalização vencidas |
| 6 | Botão Sincronizar | `runCrmSyncNow` → `runLeadSync("manual", userId)` | Sim | Mesmo caminho de #1 e #2 |
| 7 | Portal do Investidor | `portal-first-contact.server` → `registerFirstContact` | Sim | E0 de origem PORTAL |
| 8 | Laboratório de teste | `test-lab.server` → `productionEngine().tick()` | **Sim — motor de produção** | Decide/executa em lote de teste |
| 9 | Webhook Meta | `/api/public/whatsapp` → inbound | Sim | Eventos de resposta/leitura |
| 10 | CRM aberto no navegador | `listConversations` → `ensureOwnership` | Não ao motor | **Escreve responsável** |
| 11 | Remarketing | motor próprio (`remarketing/engine.server`) | Não | Fila separada |
| 12 | Server fn pública | `dispatchWhatsappTemplate` (**sem `requireSupabaseAuth`**) | Não ao motor | **Envia template**, restrito por `assertValidationRecipient` |

**Resposta direta:** sim, existem portas que criam efeito fora do fluxo planejado. As críticas são **#3** (executa E1+ automaticamente), **#4** (reconstrói cadência a partir de mensagem, não de decisão), **#8** (o laboratório usa o **motor de produção**, não uma instância isolada) e **#12** (server fn de envio sem middleware de autenticação).

## 5 — DUPLICAÇÃO DE RESPONSABILIDADE

| DECISÃO | QUEM DECIDE HOJE | QUANTOS LUGARES | RISCO |
|---|---|---|---|
| Responsável do lead | `ensureWorkspaceCard` (null), `ensureOwnership` (navegador), `assignPortalLeadOwner`, `redistributePortalLead`, `syncPortalLead` | **5** | **ALTO** — já causa perda de E0 |
| Próxima etapa | `machine.ts` (único) | 1 | **BAIXO** — correto |
| Próxima ação exibida | `relationship_queue` + `crm_cadence_tasks`, reconciliados em `daily-actions.ts` | **3** | **MÉDIO** — a verdade depende de um cálculo de tela |
| Quando enviar mensagem | motor (`tick`) + fila de E0 adiada + envio manual | **3** | **ALTO** — o automático não distingue E0 de E1+ |
| Quando ligar | `crm_cadence_tasks` (legado, D1–D7) | 1 | BAIXO |
| Quando finalizar | `runClosureTick` (E27/Finalização) + `archiveRelationship` (manual) | 2 | MÉDIO |
| Quando criar tarefa | `cadence.server.ts` (upsert) + motor (fila) | 2 | MÉDIO |
| Estágio/coluna | GreenSales (etiquetas) | 1 externo | MÉDIO — dependência externa |

**Quanto do sistema viola "uma decisão → uma ação → uma execução → um evento"?** A **decisão de etapa** já respeita (a máquina é única e pura — isso está correto e deve ser preservado). Violam: **responsável** (5 escritores), **próxima ação** (2 tabelas + reconciliação em tela) e **execução** (decisão e envio acoplados no mesmo `tick`, sem ação planejada persistida entre eles).

## 6 — `relationship_queue` x `crm_cadence_tasks`

| | `relationship_queue` | `crm_cadence_tasks` |
|---|---|---|
| Cria | motor (`upsertQueueItem`) | `cadence.server.ts` (upsert) |
| Altera | motor (`updateQueueItem`) | mesma função |
| Executa | `engine.tick` via cron | executivo, na Ação do Dia |
| Conclui | motor grava `status`/`executedAt` | marcação manual |
| Duplica? | **Não** — `claimQueueItem` é reserva atômica PENDING→PROCESSING | possível via upsert, mitigado pela chave |
| Retry | tem `attempts`; sem política explícita de reprocessamento | não |
| Lock | **Sim, por item** (`claimQueueItem`) | não |
| Idempotência | **Sim** (`executedSteps` + reserva atômica) | por chave `lead+step+ciclo` |
| Órfão? | **Sim** — item `PROCESSING` cuja execução morreu fica preso: não é PENDING (não é reprocessado) nem EXECUTED | tarefa de lead arquivado |
| Sistema depende? | Sim, é o coração | Sim, para ligações |

**O que preservar como histórico:** `crm_cadence_tasks` inteira — é o registro real das ligações D1–D7 e está referenciada na Ação do Dia e na Agenda (`agenda_cadence_tasks`).
**O que substituir:** o papel de "fonte da próxima ação". Hoje duas tabelas competem; a futura Tabela de Ações deve unificar isso, com `crm_cadence_tasks` virando somente leitura histórica.
**Lacuna confirmada:** não existe varredura que devolva itens `PROCESSING` presos ao estado `PENDING`. `claimQueueItem` protege contra execução dupla mas não contra execução perdida.

## 7 — IDEMPOTÊNCIA

| PROCESSO | TEM? | COMO | RISCO |
|---|---|---|---|
| Sincronização GreenSales | Parcial | `crm_sync_runs` com `RUNNING` recente bloqueia 15 min | Linhas `RUNNING` órfãs travam o ciclo (88 observadas em 3 dias) |
| Criação de lead | **Sim, forte** | `identity_key` UNIQUE parcial + `pg_advisory_xact_lock` por telefone e e-mail + `ON CONFLICT DO NOTHING` | Baixo — bem feito |
| Dedup por telefone | **Sim** | `outcome.deduplicated` corta o intake antes do card | Baixo |
| Criação de card | **Sim** | `ensureWorkspaceCard` idempotente por `gs_<externalId>` | Baixo |
| E0 | **Sim, dupla** | evento `e0_<leadId>` + mensagem `msg_e0_<cardId>` (IDs determinísticos) + `executedSteps` | Baixo |
| Cadência/etapas | **Sim** | `executedSteps` + `registerEvent` recusa evento repetido + `claimQueueItem` | Baixo |
| Mensagens | **Sim** | `relationship_message_sends` com `instance_seq`, `message_id`, `occurrence_id` | Baixo |
| Ligações | Parcial | chave `lead+step+ciclo` | Médio |
| Remarketing | **INDETERMINADO NO CÓDIGO ATUAL** — não auditado nesta rodada | — | — |
| Ação do Dia | Sim, em memória | `actionKey` determinística; colisão vence por precedência | **Não persistida** — não há como provar depois qual ação foi mostrada |

**Avaliação honesta:** a idempotência deste sistema é **boa** — significativamente melhor do que o comportamento observado sugeria. O problema da E0 nunca foi duplicação; foi **ausência de retry e de posse**, não excesso de execução.

## 8 — CRON E CONCORRÊNCIA

Jobs ativos (leitura anterior, `cron.job` não acessível via psql — `permission denied for schema cron`): `portal-crm-sync-automatico` (a cada minuto), `remarketing-engine`, `portal-backup-automatico`, `portal-backup-processador`.

1. **Simultâneos?** Sim — sync, remarketing e backup são independentes.
2. **Lock?** Sync tem trava por `crm_sync_runs` (15 min). Fila do motor tem lock **por item**. Remarketing e backup: **INDETERMINADO NO CÓDIGO ATUAL**.
3. **Timeout?** Não encontrado em nenhum. A trava de 15 minutos é o único limite temporal, e ela é anti-concorrência, não timeout.
4. **Mesmo lead simultaneamente?** Dentro do ciclo de sync, não (é sequencial e serializado pela trava). Entre sync e remarketing, **sim** — nada impede.
5. **Retry?** Não há retry geral. Um lead que falha é registrado e abandonado até um novo motivo o trazer de volta.
6. **Fila?** `relationship_queue` (motor) e o par `e0_adiada`/`processDeferredFirstContacts`.
7. **Execução antiga continuando depois de uma nova começar? SIM.** É o cenário concreto: uma execução que morre deixa `crm_sync_runs.RUNNING` e/ou `relationship_queue.PROCESSING` presos. O `RUNNING` bloqueia os próximos 15 minutos; o `PROCESSING` nunca mais é tocado. Nenhum dos dois se autolimpa.

**Visão de concorrência:** o desenho é **serializado por trava temporal**, não por transação. Funciona enquanto tudo termina; degrada silenciosamente quando algo morre no meio. Não há detecção de execução morta em nenhum ponto.

## 9 — AÇÃO DO DIA

Quatro origens, precedência `reunião > compromisso > mensagem > ligação`:

| Origem | Tabela | ID próprio? | Vinculada ao lead? | Vinculada à execução? |
|---|---|---|---|---|
| Reuniões | `portal_meetings` | sim | sim | sim |
| Compromissos | `workspace_agenda_events` | sim | às vezes | sim |
| Mensagens/etapas | `relationship_queue` | sim | sim | sim |
| Ligações | `crm_cadence_tasks` | sim | sim (FK) | sim |
| **A ação em si** | **nenhuma** | **`actionKey` calculada em memória** | sim | **não** |

**Duplicação:** protegida por chave determinística (`source:lead:etapa:instância`); a mesma obrigação vista em duas fontes colide e vence a de maior precedência. Ações de menor precedência do mesmo lead vão para `secondary`, nunca geram um segundo card. **O desenho está correto.**

**O que falta para `LEAD + ACTION_ID → ação → execução → resultado → evento`:** só o meio. Existe origem, existe evento histórico, existe chave estável — **não existe a linha persistida da ação**. `actionKey` morre quando a tela fecha, então "esta ação foi apresentada, foi pulada, foi executada às 14h" não é provável hoje. É exatamente o que a Tabela de Ações resolveria, e o cabeçalho de `daily-actions.ts` já declara que a camada "NÃO cria tarefas, NÃO altera cadência e NÃO escreve nada".

## 10 — AGENDA E PRIORIDADE

Reuniões têm **prioridade máxima** por desenho: `priorityMax`, `MEETING_FOCUS_WINDOW_MS` de 15 minutos, e precedência acima de tudo na Ação do Dia. `agenda_cadence_tasks` (função no banco) traz as ligações pendentes para a Agenda, filtradas pelo executivo responsável.

**Uma ação automática pode ignorar uma reunião prioritária? SIM.** A precedência da reunião existe **apenas na camada de apresentação** (`daily-actions.ts`, navegador). O cron (`runRelationshipTick`) **não consulta `portal_meetings` em momento algum** — ele decide por estado de cadência e `due_at`. Portanto uma etapa automática pode disparar para um lead com reunião marcada para dali a dez minutos. Hoje é inofensivo (envio real travado); no desenho futuro, com E0 sendo a única automática, o risco quase desaparece — mas a E0 continuaria podendo cair sobre uma reunião. **Precisa de decisão explícita.**

## 11 — MENSAGENS E SNAPSHOT

Este é o **ponto mais bem construído do sistema inteiro**. `relationship_message_sends` guarda:

```
rendered_body, template_body, library_id, library_version, library_code,
content_id, content_url, meta_template_name, investor_name_used,
actor_id, actor_name, executive_id, executive_name,
portal_destination, contact_destination, contact_phone, button_destinations,
simulated, sent_at, instance_seq, occurrence_id, message_id
```

1. **O texto pode mudar depois de planejado?** Não — `rendered_body` é o texto final gravado.
2. **Se a biblioteca mudar amanhã, o histórico muda?** **Não.** Há `library_version` **e** o corpo renderizado guardado junto. Correto.
3. **Snapshot imutável?** **Sim**, de fato.
4. **Link preservado?** Sim — `content_url`, `portal_destination`, `button_destinations`.
5. **Nome preservado?** Sim — `investor_name_used` guarda o nome **efetivamente usado**, não o nome atual do lead.
6. **Quem executou?** Sim — `actor_id`/`actor_name` e `executive_id`/`executive_name`, separados.

**Risco de histórico mudar retroativamente: nenhum encontrado nesta tabela.** O requisito de "mensagens com versões completas" das investigações anteriores **já está atendido** para o motor. Ressalva: isso vale para `relationship_message_sends`; `crm_messages` é o registro de conversa do CRM e não tem a mesma riqueza.

## 12 — NOMES

1. **Central de Nomes existe?** Como recurso administrativo, existe (registrada em investigações anteriores). Como **regra do motor**, o que existe é o campo `nameConfirmed` em `CadenceRecord` e o evento `NAME_CONFIRMED`.
2. **Onde decide se pode usar:** no motor, via `nameConfirmed`; o valor efetivamente usado fica em `investor_name_used`.
3. **Adivinha nome?** Não encontrado. `normalizeGreenSalesLead` normaliza o que veio; `resolve_portal_identity` usa `'Investidor'` como padrão quando não há nome.
4. **Fallback:** sim — `'Investidor'`, no banco.
5. **Nome ambíguo:** **INDETERMINADO NO CÓDIGO ATUAL.** Encontrei `nameConfirmed` (booleano: confirmado ou não), mas não encontrei tratamento de *ambiguidade* (dois nomes plausíveis para a mesma pessoa). São coisas diferentes e só a primeira existe.
6. **Motor funciona sem nome?** Sim — `nameConfirmed: false` é estado válido e há fallback.

**Conflito com a regra futura:** nenhum estrutural. A regra "autorizado e não ambíguo → usa; senão, neutra" precisa de um terceiro estado que hoje não existe. Hoje o modelo é binário.

## 13 — LINKS / APRESENTAÇÃO DIGITAL (E20)

Estruturas: `relationship_e20_occurrences` (32 colunas), `relationship_e20_accesses`, `relationship_e20_events`, mais `presentation_chapters` e `presentation.server.ts`/`e20.server.ts`.

1. **Quem cria:** `e20.server.ts`, na etapa E20 (E6 funcional).
2. **Quando:** ao atingir a etapa, pelo motor.
3. **Uma criação por lead?** O modelo é de **ocorrências** — plural por desenho, com `occurrence_id` referenciado em `relationship_message_sends`. Portanto pode haver mais de uma legitimamente.
4. **Expiração:** sim, validade de 7 dias (regra registrada e implementada).
5. **Link congelado no histórico?** **Sim** — `portal_destination` e `occurrence_id` ficam no envio.
6. **Motor pode criar de novo?** Sim, em nova ocorrência.
7. **Múltiplos links?** Possível **por desenho**. Se isso é desejado ou não é **decisão de negócio pendente**, não defeito.
8. **Compatível com o E5/E6 planejado?** Sim, estruturalmente — ocorrência + acesso + evento já é o modelo certo. O que muda é **quem dispara**: hoje o motor, no plano futuro o executivo.

## 14 — SEGURANÇA DO ENVIO

Todo caminho até a Graph API passa por `whatsapp.server.ts`, que importa `blockRealWhatsappSend` da Safety Lock. **A trava está no ponto certo** — imediatamente antes da saída, não na interface. Isso está correto e é a razão de nada disso ser perigoso hoje.

| Função | Classe | Autenticação |
|---|---|---|
| `registerFirstContact` (via intake/fila/portal) | automático | interna |
| `engine.tick` → `productionDispatcher` | **automático — E1+** | interna |
| `sendWhatsappText` (`whatsapp.functions.ts`) | manual | `requireSupabaseAuth` ✓ |
| `dispatchWhatsappTemplate` | manual/validação | **sem middleware** — só `assertValidationRecipient` |
| `remarketing/conversations.server` | remarketing | interna |
| `test-lab.server` | teste | **usa `productionEngine()`** |
| `simulateWhatsappReply` | administrativo | `requireSupabaseAuth` ✓ |

**A regra futura (automático = só E0) é aplicável server-side? SIM** — porque existe um funil único (`whatsapp.server.ts`). Duas portas precisariam ser fechadas antes:
- **`engine.tick` no cron** executa E1+ automaticamente. É a porta principal.
- **`dispatchWhatsappTemplate` sem `requireSupabaseAuth`**: é uma server fn pública que envia template. Está mitigada por `assertValidationRecipient` (o par jornada+telefone precisa existir no Portal), mas depende inteiramente dessa checagem.
- **`test-lab.server` chamando `productionEngine()`**: teste e produção compartilham a instância. A separação depende do `executionMode`, não da instância.

## 15 — HISTÓRICO E AUDITORIA

| Dado | Existe? | Onde |
|---|---|---|
| Lead | ✓ | todas as tabelas |
| Ação | parcial | etapa sim; "ação apresentada" não |
| Etapa | ✓ | `step` |
| Versão do conteúdo | ✓ | `library_version` + corpo renderizado |
| Ator | ✓ | `actor_id`/`actor_name` |
| Horário | ✓ | `sent_at`, `created_at` |
| Resultado | ✓ | `EngineDecision.outcome` + `relationship_decisions` |
| Motivo de falha | ✓ | `reason`, `error` |
| **Motivo de pulo** | **✗** | não existe "pular" hoje |
| Mensagem enviada | ✓ | `rendered_body` |
| **Troca de responsável** | **parcial** | dois caminhos administrativos não gravam evento |
| **Ação do dia apresentada** | **✗** | não persistida |

**Veredicto:** a rastreabilidade é **suficiente para reengenheirar sem perder história**. As três lacunas (pulo, ação apresentada, troca de responsável por via administrativa) são de *funcionalidade futura* ou de *cobertura*, não de destruição de dados. Nada é sobrescrito de forma irreversível exceto o campo `responsible_executive_id`.

## 16 — COMPATIBILIDADE COM A SEQUÊNCIA E0→E8

**A) Impede a sequência:** nada estruturalmente. A máquina de estados é pura e as etapas são um tipo (`CadenceStep`) — acrescentar é barato.

**B) Contradiz:** **SIM, e é grave.** A nomenclatura atual **não é sequencial**: existem `E0, E0_V1, E1, E3, E4, E12, E30, V3, V4, R1, R2, R3, RE0–RE3, RF0, RF1`. Note que **não existe E2**, e **E4 já existe com outro significado** ("acompanhamento mais firme"), enquanto o plano futuro define E4 como "material digital". Além disso E20 = E6 funcional. Colidir os nomes novos com os antigos seria o erro mais destrutivo possível — já sinalizado em rodada anterior e **aqui confirmado no tipo `CadenceStep`**.

**C) Pode disparar etapa antiga:** **SIM** — `runRelationshipTick` reavalia até 200 leads por ciclo e executa a etapa que a máquina antiga decidir. Enquanto o motor antigo estiver ligado, ele decide pelo vocabulário antigo.

**D) Cria mensagem automaticamente quando não deveria:** **SIM** — é o achado principal. `engine.tick` decide **e** despacha.

**E) Duplica ação:** improvável — `claimQueueItem` + `executedSteps` protegem bem.

**F) Reabre etapa concluída:** **SIM, um caminho concreto:** `bootstrapMissingCadences` reconstrói cadência a partir de mensagens `msg_e0_%` sempre que não encontra registro em `relationship_cadences`. Se um dia essa tabela for migrada/limpa e as mensagens permanecerem, o tick recria as cadências do zero. É idempotente por evento (`e0_<leadId>`), então não reenvia a E0 — mas **ressuscita o estado**. Durante uma migração, isso pode reabrir cadências deliberadamente encerradas.

## 17 — COMPATIBILIDADE COM MULTIAMBIENTE FUTURO

| Princípio | A reengenharia pode respeitar? | Observação |
|---|---|---|
| Negócio separado de production/homologation | **Sim** | `EngineScope` é um tipo próprio; o motor já é montado por escopo (`createRepository("production", null)`) — o encaixe existe |
| Lead por ID | **Sim, com ressalva** | Precisa resolver a dupla identidade `portal_leads.id` x `crm_leads.id` |
| Contexto GreenSales preservado | **Sim** | É a correção que já precisa ser feita |
| Componentes compartilhados | **Sim** | Camada de componentes já é reutilizável |
| Dados isoláveis | **Sim** | ~8 tabelas precisam de coluna; o resto herda |
| Meta por contexto | **Sim** | `whatsapp.server.ts` é funil único |
| Sem `/f` hardcoded | **Sim** | Exige disciplina; hoje é literal em 42 arquivos |
| RLS só nas funções centrais | **Sim** | `can_access_investor`/`has_role` já centralizam |

**O que violaria:** criar uma segunda máquina de estados para o novo fluxo; persistir a Tabela de Ações sem coluna de contexto extensível; escrever a nova UI com o prefixo literal; adicionar política RLS direta sobre `portal_leads`.

## 18 — CONFLITOS COM INVESTIGAÇÕES ANTERIORES

**CONFLITO #1 — E1+ é automático hoje**
*Investigação anterior:* o plano assumiu que "E0 é a única etapa automática" descrevia aproximadamente o estado atual, faltando apenas formalizar.
*Código atual demonstra:* `runRelationshipTick` (`scheduler.server.ts:123`) roda no mesmo ciclo do cron de sync (`sync-scheduler.server.ts:72`), monta `productionEngine()` e chama `engine.tick(leadId)` para até **200 leads**, contabilizando `sent`. O motor decide **e** despacha.
*Explicação:* a regra "só E0 automática" não é uma formalização — é uma **mudança de comportamento**. Desligar ou restringir o tick é parte obrigatória da reengenharia, não consequência dela.

**CONFLITO #2 — Investigação 1 disse que o tick "não cria nem envia E0"**
*Investigação anterior:* "`runRelationshipTick` apenas reconstrói cadência para mensagens `msg_e0_%`; não cria nem envia E0."
*Código atual demonstra:* a parte da E0 está correta (`bootstrapMissingCadences` só registra evento idempotente). Mas a frase deu a impressão de que o tick é inofensivo. Ele **envia etapas posteriores** — a mesma função, logo abaixo, faz `engine.tick()` em laço.
*Explicação:* a conclusão sobre a E0 permanece válida; a caracterização do tick como passivo estava incompleta.

**CONFLITO #3 — "nada por nome" x E4 já existir**
*Investigação anterior:* apontou conflito de nomenclatura da E4 como questão em aberto.
*Código atual demonstra:* `CadenceStep` em `src/lib/relationship/types.ts` define `E4` = "acompanhamento mais firme", sem `E2`, com `E12`, `E30`, `V3/V4`, `R1–R3`, `RE0–RE3`, `RF0/RF1`.
*Explicação:* não é ambiguidade de documento — é colisão real de identificadores no tipo do motor. A sequência planejada E0→E8 **reutilizaria três nomes já ocupados** (E1, E3, E4) com significados diferentes.

**CONFLITO #4 — Investigação 3 disse que não havia entidade de ambiente**
Já registrado e explicado na Investigação 4 (`portal-brands.ts` com três marcas; `group_unit_leads` com `CHECK (unit IN ('solar','seguros'))`, tabela vazia). Mantido aqui por completude.

**CONFLITO #5 — snapshot de mensagem "a construir"**
*Investigação anterior:* listou "mensagens com versões completas e imutáveis" como algo a implementar.
*Código atual demonstra:* `relationship_message_sends` já guarda `rendered_body`, `template_body`, `library_version`, `investor_name_used`, `portal_destination`, `button_destinations`, `actor_id`, `executive_id`.
*Explicação:* **já está construído** para o motor. O trabalho futuro é estendê-lo à Tabela de Ações, não criá-lo do zero. Boa notícia que reduz escopo.

## 19 — MAPA FINAL DE RISCO

| RISCO | IMPACTO | PROBABILIDADE | RESOLVER AGORA? | MOTIVO |
|---|---|---|---|---|
| `engine.tick` executa E1+ automaticamente | **Alto** | **Certa** (roda a cada ciclo) | **SIM** | Contradiz a regra central; hoje só é inofensivo pela Safety Lock |
| Cinco escritores de responsável; card nasce `null` | Alto | Certa | **SIM** | Já causa perda de E0 (Investigação 2) |
| `crm_sync_runs` preso em `RUNNING` | Alto | Alta (88 em 3 dias) | **SIM** | Trava 15 min por linha órfã; sem autolimpeza |
| Item de fila preso em `PROCESSING` | Médio | Média | **SIM** | Nunca reprocessado; não há detecção |
| Ausência de retry para lead bloqueado | Alto | Certa | **SIM** | Uma tentativa perdida = etapa perdida para sempre |
| Colisão de nomenclatura E1/E3/E4 | **Alto** | Certa se ignorada | **SIM, decidir** | Corromperia histórico e decisão |
| `bootstrapMissingCadences` ressuscitar cadência | Médio | Baixa, **alta durante migração** | **SIM, planejar** | Perigoso exatamente na hora da reengenharia |
| Ação do Dia não persistida | Médio | Certa | SIM (é o objetivo) | Impede provar pulo/execução |
| Duas identidades de lead (`portal_leads` x `crm_leads`) | Médio | Certa | **SIM, decidir** | Viola "tudo por ID único" |
| `dispatchWhatsappTemplate` sem middleware | Médio | Baixa | SIM, verificar | Server fn pública que envia template |
| Laboratório usando `productionEngine()` | Médio | Média | SIM, decidir | Isolamento depende de flag, não de instância |
| Cron ignora reunião prioritária | Baixo hoje | Média | Decidir | Precedência só existe na tela |
| `assign`/`redistribute` sem evento | Baixo | Certa | Não urgente | Lacuna de auditoria |
| Lead invisível por etiqueta não mapeada | Médio | Média | Não urgente | Dado preservado; some do quadro |
| Idempotência do remarketing | INDETERMINADO | — | Auditar antes | Não coberto nesta rodada |

## 20 — CHECKLIST DE PRONTIDÃO

**Temos informação suficiente para começar? SIM** — com três decisões de negócio a tomar antes da primeira linha de código (não são investigações; são escolhas suas):

1. **Nomenclatura:** os novos E1–E8 colidem com E1/E3/E4 existentes. Prefixo novo, renome do antigo, ou outro esquema?
2. **ID canônico:** aposentar `crm_leads.id` das ligações ou mantê-lo como identidade secundária declarada?
3. **Destino do tick automático:** desligar `runRelationshipTick`, restringi-lo a E0 e fechamento, ou mantê-lo até a nova Tabela de Ações existir?

Um item permanece **INDETERMINADO NO CÓDIGO ATUAL** e deve ser auditado antes de mexer em campanhas: a idempotência e a concorrência do motor de remarketing.

**Os 10 princípios obrigatórios da implementação:**

1. **A máquina de estados permanece pura e única.** Nenhuma segunda máquina, nenhuma regra de etapa fora dela.
2. **Decisão ≠ execução.** Entre elas, sempre uma ação planejada e persistida, com id próprio.
3. **`portal_leads.id` é a única identidade.** Qualquer outra é secundária e declarada.
4. **Toda escrita de responsável passa por um ponto único, no servidor, na entrada.** O navegador nunca decide posse.
5. **Contexto que entra viaja até o fim** — nunca aberto e descartado no meio do caminho.
6. **Automático é exceção nomeada.** A regra é bloqueio; a E0 é a única liberação, verificada no servidor, antes da Safety Lock.
7. **Histórico é append-only e imutável** — mensagem gravada com corpo, versão, nome usado, ator e destino, no padrão que `relationship_message_sends` já estabeleceu.
8. **Toda execução tem dono de estado e saída garantida:** nada fica preso em `RUNNING`/`PROCESSING` sem detecção.
9. **Dois eixos, sempre:** negócio e execução (produção/homologação) nunca se misturam num campo só.
10. **Acesso pelas funções centrais; telas sem prefixo escrito à mão.**

---

**Nada foi implementado, corrigido ou alterado.** Este é o diagnóstico final antes da reengenharia.

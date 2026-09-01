# Diagnóstico consolidado final — Fluxo do lead, Ação do Dia, Cadência, Mensagens e Auditoria

Rodada de análise. **Nada foi alterado**: sem código, banco, tabelas, cron, filas, interface ou regra. A Global WhatsApp Safety Lock permanece exatamente como está.

**[ATUAL]** existe e foi verificado no código · **[PARCIAL]** existe só em parte · **[FUTURO]** conceito planejado, não implementado · **[RECOMENDAÇÃO]** sugestão técnica, não requisito.

---

## 1. Fluxo real do lead no CRM

### Como a coluna é determinada — [ATUAL], verificado

- A origem **não informa** "mudou de coluna". Ela devolve o lead com suas **etiquetas**; `resolveBoardColumn` deduz a coluna comparando as etiquetas com as colunas declaradas no funil.
- Vence a coluna de **posição mais avançada**. `remarketing` é indicador, não posição. **Nenhuma coluna reconhecida ⇒ `null`, e o chamador preserva a última posição conhecida.**
- O quadro (`portal-leads-board.tsx`) agrupa **apenas por `stage_key` atual**. E há uma linha decisiva: `if (!lead.stageKey) continue;` — **lead sem etapa não entra em nenhuma coluna**. Ele é apenas contado como `outsideFunnel`.

### Histórico — [PARCIAL]

- **Movimentação entre colunas:** existe **evento**, não histórico consultável. `lead-service.server.ts` compara `previous.stage_key` com o novo e, quando muda, grava `stage_entered_at = agora` e um evento com `de:` e `para:`. Também existe `entered_entry_stage_at` (entrada em NOVOS). Ou seja: **é possível reconstruir o caminho lendo os eventos**, mas não existe uma tabela de trajetória nem uma tela que a mostre.
- **Troca de executivo:** existe `transferLeadOwnership` e transferências auditadas, mas o vínculo atual mora em `responsible_executive_id` no próprio lead — de novo, estado atual + eventos, não trajetória.

### Os cinco casos que hoje se confundem — [PARCIAL] / limitação real

| Situação | Representação hoje |
|---|---|
| mudou de etapa | `stage_key` novo + `stage_entered_at` + evento `de`/`para` — **bem representado** |
| foi transferido | `responsible_executive_id` novo + evento — **representado, sem trajetória** |
| saiu do funil | `stage_key = null` ⇒ **some do quadro**, só aparece no contador `outsideFunnel` |
| ficou sem etapa | **idêntico ao anterior** — indistinguível |
| não foi localizado na varredura | `nao_localizado` (`UNLOCATED_STAGE_KEY`), coluna **local do Portal**, aplicada por `reconcile.server.ts` |

**Confirmando o teste de vocês:** mover NOVOS → FRIOS **é** registrado corretamente (etapa nova, carimbo de entrada e evento com origem e destino), desde que FRIOS esteja declarada como coluna do funil.

### Sim, existe hoje o "lead que desaparece" — [ATUAL]

Um lead com `stage_key = null` continua no banco, continua com executivo, continua com cadência — e **não aparece em nenhuma coluna**. Não há motivo registrado, não há aviso, não há destino. É exatamente o comportamento que vocês perceberam. A coluna `nao_localizado` cobre só um dos casos (sumiu da varredura), não o caso de lead sem coluna reconhecida.

### [LACUNA] O que falta para nenhum lead sumir

1. **Distinguir `null` de `null`:** "a origem tirou todas as etiquetas" e "esta resposta não trouxe etiquetas" produzem o mesmo valor. Um é fato, o outro é falha de leitura.
2. **Toda saída precisa de destino:** nenhum lead deveria poder ficar sem coluna — se não há coluna reconhecida, ele pertence a uma coluna de contingência explícita, com motivo.
3. **Motivo e autor da mudança:** o evento diz `de`/`para`, não diz *quem* nem *por quê* (origem, executivo, reconciliação).
4. **Trajetória consultável:** hoje é reconstrução por eventos; deveria ser leitura direta.
5. **Uma identidade canônica:** `crm_leads` guarda a etapa, `portal_leads` é o card operacional; a ponte (`gs_<external_id>`) é resolvida caso a caso.

---

## 2. Ação do Dia no modelo futuro

### Menor conjunto de mudanças — [RECOMENDAÇÃO]

A boa notícia: o ponto de separação **já existe no código**. `decide.ts` é uma função pura que devolve `{ kind: "none" | "schedule_step" | "send_step", ... }` com motivo legível. Basta um consumidor entre a decisão e a execução:

```text
decide.ts (intocado)
   ├─ "none"          → nada
   ├─ "schedule_step" → PLANEJADOR grava ação PLANEJADA (prevista_para = dueAt)
   └─ "send_step"     → E0? despacha.  E1+? PLANEJADOR grava ação pronta
                              └─ AÇÃO DO DIA → executivo → RESULTADO → volta ao decide.ts
```

Sim, dá para evoluir sem segundo motor — desde que **nada além de `decide.ts` decida etapa**.

**Continua sendo do motor:** qual é a próxima etapa, quando ela vence, se o lead está elegível, se a janela de 24 h exige template, ordem do fluxo.
**Passa a ser da Ação do Dia:** apresentar, coletar resultado, registrar quem fez e quando. Nunca escolher etapa.

### Como impedir execução automática de E1+ — [RECOMENDAÇÃO]

Três travas, em camadas, na ordem:

```text
motivo de autorização válido? → etapa permitida para esse motivo? → guard de destinatário → SAFETY LOCK → canal
```

Motivos: `E0_AUTOMATICA` (aceita apenas `E0`/`E0_V1`), `RESPOSTA_HUMANA` (janela de 24 h), `ACAO_EXECUTADA_POR_HUMANO` (exige `action_id` + usuário). Sem motivo válido: recusa + auditoria no `relationship_engine_log`, que a Safety Lock já usa.

Isso resiste a caminho antigo porque **o motivo é parâmetro obrigatório**, não flag a ser lembrada. Um cron legado não consegue inventar um.

**[LACUNA]** `messaging.server.ts` se declara "única saída do CRM" mas chama `sendTextMessage` só com telefone e texto — sem etapa, sem lead, sem contexto. É hoje o caminho mais fácil de burlar a regra sem intenção.

### Estados — [FUTURO]

| Estado | Significado | Conta como executada? |
|---|---|---|
| `PLANEJADA` | prevista, sem resposta | não |
| *(atrasada)* | **não é estado** — é leitura de `prevista_para < agora` | não |
| `EXECUTADA` | o executivo fez e informou o resultado | sim |
| `REAGENDADA` | nova ação criada, ponteiro para a anterior | não |
| `PULADA` | não foi feita, com justificativa | **não** |
| `BLOQUEADA` | impedimento técnico/regra | não |
| `EXPIRADA` | só se vocês decidirem que existe | não |

Ação atrasada **nunca some**: `resolveBucket` já trata assim hoje (atrasada nunca vira "hoje"). Ela permanece `PLANEJADA` até receber resposta, pulo ou reagendamento.

### Pular com justificativa — [FUTURO], [RECOMENDAÇÃO]

Duas dimensões independentes, e é isso que impede a confusão: **`estado`** (o que aconteceu com a ação) e **`resultado`** (o que aconteceu no mundo). "Não atendeu" é `EXECUTADA` + resultado negativo (tentou). "Estava em outra reunião" é `PULADA` (não tentou).

O registro do pulo: `justificativa` validada no servidor (não vazia, tamanho mínimo), `pulada_por`, `pulada_em`, `destino` (reagendada para X / encerrada no ciclo) — tudo em evento **append-only**, nunca sobrescrito. Só `EXECUTADA` alimenta `executedSteps`.

**[LACUNA] decisão estrutural:** `isStepInOrder` exige que todas as etapas anteriores estejam em `executedSteps`. Uma etapa pulada **trava a sequência**. Ou o pulo marca a etapa como consumida (destrava, mas mente sobre execução), ou a verificação de ordem passa a aceitar lacuna explícita. Precisa ser decidido antes de qualquer código.

---

## 3. Cadência — etapas atuais x futuras

### [ATUAL] — declaradas no código

**Cadência (`STEPS` + `FLOW_SEQUENCE`):**
- `sem_resposta`: E0 → E1 → E3 → E4 → E12 → E30
- `visualizacao`: E0 → E1 → V3 → V4
- `reengajamento`: R1 → R2 → R3
- `reentrada`: RE0 → RE1 → RE2 → RE3
- `relacionamento_frio`: RF0 → RF1
- Variante de primeiro contato: `E0_V1`

**Fora da cadência (`NON_CADENCE_STEPS`):** `E20`, `E27`, `FINALIZACAO`, `RESPOSTA_AUTOMATICA`.

`KNOWN_STEP_KEYS` é a união dos dois, e `isKnownStep` **recusa** qualquer chave fora disso com motivo legível. Já existe fonte única.

### [PARCIAL]
- **E4** existe como chave no fluxo `sem_resposta`, mas **não é** a E4 conceitual da jornada futura. Mesmo nome, significado diferente — é a maior fonte de confusão possível.
- **E20/E27/FINALIZACAO** existem e operam fora da máquina de cadência.
- Vínculo etapa↔conteúdo existe via `contentGroup`, mas resolvido na execução.

### [FUTURO] — apenas conceito
**E2, E5, E6, E7, E8** e a renumeração completa E0…E8. Nada disso existe.

### [RECOMENDAÇÃO] — evoluir sem quebrar

1. **Preservar todas as chaves atuais.** Elas estão gravadas em `executedSteps`, nos eventos e nas mensagens enviadas. Renomear reescreve o passado.
2. **Novas etapas nascem com chaves novas e distintas** — prefixo de geração, mesmo quando o rótulo humano coincidir. Isso resolve o caso E4 x E4.
3. **Mapa de equivalência** apenas para relatório, nunca migração de dados.
4. **Cada cadência guarda a versão do vocabulário** com que nasceu: leads em andamento terminam no vocabulário antigo; novos nascem no novo; sem conversão no meio.
5. **Campo `status`: `ativa` | `planejada`** em `STEPS`. Etapa `planejada` aparece na configuração e é **recusada pelo planejador e pelo despachante**.

**Como evitar que conceito vire funcionalidade:** a regra é mecânica, não editorial — uma etapa só opera se estiver em `KNOWN_STEP_KEYS` **e** com `status: ativa`. Enquanto E2/E5–E8 estiverem `planejada` (ou nem declaradas), nenhum código consegue executá-las, independentemente de quantas vezes forem citadas em planejamento. Neste documento e nos próximos, a marcação [ATUAL]/[PARCIAL]/[FUTURO] deve acompanhar toda menção a etapa.

---

## 4. Mensagens do motor — versões completas

**[ATUAL]** `STEPS` declara `templatePurpose` e `contentGroup` por etapa; `decide.ts` devolve os dois; a montagem (texto + link) acontece na execução via `relationship_contents` + bindings. `CONTENT_REQUIRED_STEPS` é derivado de `STEPS`.

**Avaliação:** a estrutura atual *suportaria* várias versões, mas ao custo de mais uma camada de resolução em tempo de execução — exatamente o que vocês querem eliminar. **Sim, é mais seguro congelar texto + link juntos numa versão.**

**[RECOMENDAÇÃO] — evolução aditiva, sem ruptura:**
- Cada versão é um **registro próprio e imutável**: etapa, número, rótulo (com nome / sem nome), texto completo, link completo, ativa/inativa.
- **Alteração nunca é retroativa:** editar cria versão nova; a antiga continua existindo apenas para leitura. Como a ação guarda o `id` da versão, uma mudança futura não toca no que já foi planejado nem no que já foi enviado.
- **Qual versão foi escolhida** fica gravada na própria ação (`versao_mensagem`), no momento em que ela é criada — não se recalcula nada depois.
- **Ação do Dia** exibe o texto pronto, com copiar / abrir conversa. O executivo vê exatamente o que será enviado.
- **Ordem de resolução durante a transição:** se a etapa tem versões, usa versão; se não tem, mantém o caminho atual. As duas arquiteturas coexistem e a migração é etapa a etapa.
- **Rotação:** determinística por lead é reprodutível em retry, homologação e auditoria; aleatória não é; sequencial exige contador persistido e pode avançar indevidamente em retry.

**[LACUNA]** Se versões da mesma etapa tiverem finalidades diferentes, a checagem de template oficial de `decide.ts` (janela de 24 h) precisa saber qual versão será usada — hoje ela decide **antes** de a versão existir. Definir se `templatePurpose` fica na etapa ou na versão.

---

## 5. Identidade, resultado e auditoria

**[ATUAL] já recuperável:** etapa atual e `stage_entered_at`; evento de mudança `de`/`para`; ligações concluídas com `outcome` SIM/NÃO em `crm_cadence_tasks` + evento `CADENCE_TASK_DONE`; mensagens em `relationship_message_sends`; decisões e bloqueios em `relationship_engine_log` (incluindo cada tentativa barrada pela Safety Lock, com fluxo, etapa, origem e telefone mascarado); `journey.server.ts` como agregador cronológico.

**[PARCIAL] espalhado:** cada canal tem vocabulário próprio (ligação SIM/NÃO, mensagem `..._SENT`, reunião sem desfecho) — os números **não são somáveis**. Responsável está no lead, não na obrigação.

**[FUTURO] faltando:** previsto x realizado por ação; responsável da ação; justificativa; estados pulada/reagendada/bloqueada; versão de mensagem usada; contagem de tentativas por ciclo; histórico de alterações da ação.

**[RECOMENDAÇÃO]** Uma trilha por ação, não por lead: a ação carrega `action_id` + `lead_id` e sobrevive a qualquer mudança posterior de coluna, executivo ou estágio — porque ela registra **o que estava previsto naquele momento**, e o passado não se reescreve. Com isso, "por que esse lead não avançou?" deixa de ser interpretação e vira leitura: qual ação estava prevista, quem era responsável, o que aconteceu, quando, com qual justificativa e com qual mensagem.

**[LACUNA] identidade:** o vínculo AÇÃO → LEAD_ID → RESULTADO → NOTA → HISTÓRICO é hoje verdadeiro na prática e **informal no contrato** — depende de cada chamador passar o ID certo, e convivem duas identidades (`portal_leads.id` / `gs_<external_id>` e `crm_leads.id`; `guard.server.ts` traduz entre elas). Falta: eleger a canônica, guardar a outra como referência, **derivar o `lead_id` do `action_id` no servidor** em vez de aceitá-lo do cliente, e amarrar com chave estrangeira + RLS.

---

## 6. Agendamentos e reuniões

**[ATUAL]** `portal_meetings` (25 colunas) guarda o compromisso; `SCHEDULE_CREATED` pausa a cadência. **Não existe** comparecimento, não comparecimento, cancelamento com motivo, evolução nem reagendamento com vínculo.

**[RECOMENDAÇÃO] Fonte de verdade dividida por natureza, sem cópia:**
- **`portal_meetings`** é a verdade do *compromisso*: quando, com quem, onde. A ação **referencia** e lê de lá — nunca copia horário.
- **A ação** é a verdade do *trabalho*: entrou na fila, foi respondida, qual o resultado.
- Uma reunião = no máximo **uma** ação aberta (chave única) — duplicidade impossível por construção.
- Estados do compromisso (`agendada`, `realizada`, `não compareceu`, `cancelada`, `reagendada`) pertencem à reunião; `compareceu` / `evolucao` / `reagendar` são resultado da ação.
- **Reagendar em uma transação:** reunião original encerrada com resultado, nova reunião criada, nova ação com ponteiro para a anterior. A ação antiga fica `REAGENDADA` para sempre.
- A janela de antecedência já existe (`MEETING_FOCUS_WINDOW_MS`, 15 min) — bastaria parametrizar.

**[LACUNA]** Hoje a reunião pausa a cadência; no modelo novo quem **retoma** é o resultado. Sem resultado registrado, o lead fica parado indefinidamente — precisa de visibilidade explícita de "reuniões sem desfecho".

---

## 7. Lote, fila e cron

**[ATUAL] onde há processamento em lote:** `portal-crm-sync-automatico` (1 min) faz varredura + E0 + tick do motor no mesmo ciclo; a fila de E0 adiada opera com `.limit(200)` e janela de 3 dias; `buildCadenceQueue` lê até 5000 leads e **recalcula a fila inteira a cada leitura**; `remarketing-engine` roda a cada minuto com executor próprio.

**Como uma falha represa tudo:** como o estado vive no *ciclo* e não no *item*, um job travado não deixa pendência marcada — quando volta, encontra tudo "vencido ao mesmo tempo" e processa em rajada. E o que estiver fora da janela de 3 dias / limite 200 **é descartado em silêncio**.

**[RECOMENDAÇÃO] Três princípios:**
1. **Estado é do item, não do job.** Cada ação tem vencimento próprio; job travado atrasa a *criação*, nunca apaga a obrigação. Ao voltar, encontra as ações já existentes (chave única) em vez de recriar.
2. **Atraso é leitura, não evento.** `prevista_para < agora` ⇒ atrasada. Nunca some, nunca vira "hoje".
3. **Recuperação sem rajada.** O que se recupera é *apresentação*, não *envio* — E1+ é humano, então não existe lote automático possível. Para E0: teto por ciclo, ordenação por vencimento e **descarte visível** (nunca silencioso).
4. **Sem reprocessamento retroativo:** só etapas com vencimento **a partir do marco de ativação** viram ação.

---

## 8. Transição em fases

| Fase | O que entra | Comportamento atual |
|---|---|---|
| **0. Contrato** | decidir identidade canônica, semântica de `null` de coluna, se pular consome etapa, destino do remarketing | inalterado — nenhuma linha de código |
| **1. Criação** | tabela de ações, eventos, versões de mensagem — vazias, sem consumidor | inalterado |
| **2. Sombra** | planejador consome `decide.ts` e grava ações; nada apresentado, nada executado | inalterado |
| **3. Ação do Dia usa a nova fonte** | leitura passa para a tabela; resultados estruturados; ligações legadas viram leitura | despacho automático segue só para E0 |
| **4. Caminho antigo para de executar** | whitelist obrigatória; `engine.ts` só E0; remarketing/closure/inbound/messaging resolvidos | corte efetivo |
| **5. Congelamento do legado** | fontes antigas viram somente leitura, marcadas como históricas; nada é apagado | leitura permanente |

**Como evitar cada risco:** avalanche → marco de ativação + teto por ciclo · duplicidade → chave única `lead_id + etapa + ciclo` + caminho único de escrita · perda de histórico → nada migrado, nada renomeado, eventos append-only · envio automático indevido → whitelist por motivo, antes da Safety Lock · leads no meio da cadência → continuam no vocabulário e no fluxo em que nasceram, e só recebem ação para etapas vencidas **depois** do marco.

---

## 9. Documento consolidado

**A) Como está hoje:** motor com decisão isolada (`decide.ts`) mas execução acoplada; E0 já tratada como exceção em `FIRST_CONTACT_STEPS`; Ação do Dia como leitura pura, bem estruturada; coluna deduzida de etiquetas com preservação em caso de dúvida; transições registradas como evento; ligações com desfecho binário; reuniões sem desfecho; conteúdo montado na execução; oito caminhos até o canal; Safety Lock como última barreira, com auditoria.

**B) Limitado hoje:** lead sem etapa desaparece do quadro sem motivo registrado; `null` ambíguo entre "sem coluna" e "resposta incompleta"; `executedSteps` escrito na decisão; vocabulário de resultado diferente por canal; sem responsável/justificativa/estado por obrigação; estado no ciclo e não no item (rajada e descarte silencioso); duas identidades de lead sem contrato; `messaging.server` sem contexto; E4 conceitual colide com E4 existente.

**C) Reaproveitável:** `decide.ts` inteiro; `FIRST_CONTACT_STEPS`; `step-registry`/`isKnownStep`; `guard.server.ts`; `execution-mode` e `channel.ts` (ambiente antes de credencial); toda a lógica de `daily-actions.ts` (chave determinística, precedência, colapso, buckets, fuso); `MEETING_FOCUS_WINDOW_MS`; `portal_meetings`; `resolveBoardColumn`; `stage_entered_at` + evento `de`/`para`; `relationship_engine_log`; `journey.server.ts`; Safety Lock.

**D) A criar:** planejador; tabela de ações; eventos append-only; whitelist de autorização; vocabulário fechado por tipo; estados `PULADA`/`REAGENDADA`/`BLOQUEADA`; versões completas de mensagem; relatório do dia; painel de resposta ampliado; coluna de contingência com motivo.

**E) A não criar:** segundo motor de decisão; Ação do Dia decidindo cadência; renomeação de etapas históricas; regra que leia texto livre; busca de lead por nome em escrita; qualquer novo caminho até o canal; automação de etapa além de E0; enfraquecimento ou contorno da Safety Lock.

**F) Comunicação:**
```text
MOTOR (decide.ts) → PLANEJADOR (única escrita) → E0: despacho automático
                                                → E1+: AÇÃO DO DIA → RESULTADO (append-only)
                                                              ├→ MOTOR decide de novo
                                                              ├→ ficha / notas (por ID)
                                                              └→ relatório (por categorias)
```

**G) Decisões de negócio pendentes:** identidade canônica do lead na ação · semântica de "nenhuma coluna reconhecida" · pular consome etapa ou a sequência aceita lacuna · existe `EXPIRADA`? · `templatePurpose` na etapa ou na versão · destino do remarketing, campanhas e `inbound` · quantas tentativas de ligação por ciclo · quem pode pular · ações anteriores ao marco entram na fila? · confirmação de envio sempre obrigatória? · mapa das etapas atuais para E0…E8 · regra de rotação · "sem interesse" encerra ou suspende?

**H) Ordem:** Fase 0 → 1 → 2 → 3 → 4 → 5, conforme a seção 8. Rollback em qualquer fase: desligar o caminho novo; nada antigo foi removido.

**I) Riscos principais:** `remarketing-engine` como executor paralelo real (1 min); `closure` e `inbound` alcançando o canal fora do tick; `messaging.server` sem contexto; conciliação entre a chave de `crm_cadence_tasks` e a chave da ação nova; resgate por `msg_e0_%` ressuscitando leads antigos na migração; reunião que pausa a cadência e nunca recebe desfecho; vocabulário nascer com algum campo em texto livre (inviabiliza o relatório); confirmação humana divergir do mundo real.

**J) Garantias e testes antes de qualquer envio real:**
1. **Teste negativo obrigatório:** acionar cada caminho do inventário e confirmar recusa **pela whitelist, antes** da Safety Lock. Se a recusa vier da trava, o teste falhou.
2. E0 continua funcionando após o corte.
3. Uma semana completa em sombra (com sábado) sem divergência entre decisões e ações.
4. Homologação apenas com leads `TEST-`; `guard.server.ts` recusando lead real.
5. Responder duas vezes não duplica; ação atrasada permanece visível; etapa não reaparece no mesmo ciclo.
6. Nota com `action_id` de outro executivo recusada pelo servidor.
7. Relatório batendo com a contagem direta; pulada nunca contada como executada.
8. Safety Lock intacta e auditando; nenhuma mensagem real durante toda a construção.

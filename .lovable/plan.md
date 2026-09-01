# DIAGNÓSTICO INTEGRADO — BASE ARQUITETURAL ANTES DA IMPLANTAÇÃO

Rodada de análise. **Nada foi alterado**: sem código, banco, tabelas, cron, cadência, Ação do Dia, Workspace, GreenSales, mensagens. A Global WhatsApp Safety Lock permanece exatamente como está.

**[EXISTE]** verificado no código · **[PARCIAL]** existe só em parte · **[NÃO EXISTE]** conceito futuro, sem implementação · **[RECOMENDAÇÃO]** proposta técnica, não requisito · **[DECISÃO]** pendente de vocês.

---

## 1. Regra principal da cadência — E0 automática, E1+ manual

### O que existe hoje

- **[EXISTE]** `decide.ts` é uma função **pura** de decisão: recebe estado e devolve `{ kind: "none" | "schedule_step" | "send_step", step, dueAt, reason }`. O ponto de separação entre decidir e executar **já nasceu no código** — só não tem consumidor intermediário.
- **[EXISTE]** `FIRST_CONTACT_STEPS` já trata E0/E0_V1 como exceção explícita e centralizada (inclusive quanto à janela de horário).
- **[EXISTE]** Safety Lock como última barreira antes da Graph API, com auditoria em `relationship_engine_log`.
- **[EXISTE]** `execution-mode` + `channel.ts`: o **ambiente decide antes das credenciais** — homologação nunca chama a Meta, mesmo com token real.
- **[EXISTE]** `guard.server.ts` bloqueando destinatário real em contexto de teste.
- **[EXISTE]** camada de autorização — **mas só de LEITURA**: `authorization.ts` / `authorization.server.ts` respondem "quem pode ver o quê" (admin, gestão, dono do lead, isolamento de rodada). **Não existe** equivalente para "quem pode executar".

### O que não existe hoje

- **[NÃO EXISTE]** qualquer trava que diga "esta etapa só pode ser enviada por decisão humana". Hoje, se o motor decide `send_step`, o despacho acontece — a etapa não é consultada.
- **[NÃO EXISTE]** noção de *motivo de autorização* atrelada a um envio.

### Caminhos que hoje alcançam o WhatsApp — [EXISTE], inventário

Quatro módulos chamam o envio direto (`sendTextMessage` / `sendTemplateMessage`): `whatsapp.server.ts` (o canal), `whatsapp.functions.ts`, `remarketing/conversations.server.ts` e `crm/messaging.server.ts`. Acima deles operam `dispatch.server.ts`, `e0.server.ts`, `closure.server.ts`, `auto-reply.server.ts`, `inbound.server.ts` e o `remarketing-engine` (cron de 1 min, executor próprio).

**Resposta direta à pergunta 5:** sim — hoje, mesmo separando decisão de execução, `remarketing-engine`, `closure`, `auto-reply` e `messaging.server` continuariam alcançando o canal por conta própria. `messaging.server.ts` é o mais crítico: declara-se "única saída do CRM" mas chama o envio **só com telefone e texto**, sem etapa, sem lead, sem contexto — é o caminho mais fácil de burlar a regra **sem intenção**.

### [RECOMENDAÇÃO] Arquitetura de segurança — ordem das travas

```text
MOTIVO DE AUTORIZAÇÃO válido?  →  ETAPA permitida para esse motivo?
   →  GUARD de destinatário  →  AMBIENTE  →  SAFETY LOCK  →  Graph API
```

Motivos fechados, sem "outros":

| Motivo | Etapas aceitas | Exige |
|---|---|---|
| `E0_AUTOMATICA` | apenas `E0`, `E0_V1` | nada além do lead |
| `RESPOSTA_HUMANA` | resposta dentro da janela de 24 h | conversa aberta |
| `ACAO_EXECUTADA_POR_HUMANO` | qualquer etapa manual | `action_id` + usuário autenticado |

Por que isso resiste a caminho antigo: **o motivo é parâmetro obrigatório do canal**, não uma flag a lembrar. Um cron legado não consegue inventar um motivo válido; ele falha, é recusado e fica auditado. Não é disciplina de código — é impossibilidade estrutural.

**Um único motor:** `decide.ts` permanece a única fonte que escolhe etapa e prazo. O planejador **consome** essa saída; nunca decide. A Ação do Dia **lê** o planejamento; nunca decide. Não há segundo motor porque não há segunda função que escolha etapa.

**Demais caminhos (pergunta 4):** `remarketing` e `campanhas` → decidir se são fluxo próprio autorizado ou se aposentam (ver §15-E); `auto-reply`/`inbound` → cabem em `RESPOSTA_HUMANA` (reagem a mensagem recebida, não a cadência); `closure` → passa a ser ação planejada como qualquer outra; `messaging.server` → passa a exigir contexto (lead + etapa + motivo) ou deixa de existir como atalho.

---

## 2. E0 × Ação do Dia

### Fluxo alvo

```text
decide.ts (intocado)
   ├─ "none"          → nada
   ├─ "schedule_step" → PLANEJADOR grava ação PLANEJADA (prevista_para = dueAt)
   └─ "send_step"     → E0?  despacha automaticamente
                        E1+? PLANEJADOR grava ação pronta
                              └→ AÇÃO DO DIA → executivo executa
                                    → RESULTADO (append-only) → decide.ts decide de novo
```

**O que permanece exatamente como está (pergunta 3):** `decide.ts` inteiro; `machine.ts`; `FIRST_CONTACT_STEPS`; `step-registry` / `isKnownStep`; `guard.server.ts`; `execution-mode` e `channel.ts`; toda a lógica de `daily-actions.ts` (chave determinística, precedência AGENDA > REUNIÃO > MENSAGEM > LIGAÇÃO, colapso, buckets, fuso); Safety Lock.

**O que muda (pergunta 2):** `engine.server.ts` deixa de despachar E1+ e passa a chamar o planejador; `executedSteps` deixa de ser escrito na decisão e passa a ser escrito **apenas no resultado** — hoje essa gravação antecipada é justamente o que faz uma ação "identificada" parecer "executada" (pergunta 4).

**Ação atrasada (pergunta 5):** **[EXISTE]** `resolveBucket` já garante que atrasada nunca vira "hoje". **[RECOMENDAÇÃO]** atrasado **não é estado** — é leitura de `prevista_para < agora`. A ação permanece `PLANEJADA`, visível, até receber resultado, pulo ou reagendamento. Nunca some, nunca é executada sozinha (E1+ não tem executor automático depois do corte).

---

## 3. Jornada futura E0 → E8

### O que existe hoje — [EXISTE], nomenclatura real do código

`FLOW_SEQUENCE` declara cinco fluxos:

- `sem_resposta`: E0 → E1 → E3 → E4 → E12 → E30
- `visualizacao`: E0 → E1 → V3 → V4
- `reengajamento`: R1 → R2 → R3
- `reentrada`: RE0 → RE1 → RE2 → RE3
- `relacionamento_frio`: RF0 → RF1
- variante de primeiro contato: `E0_V1`

Fora da cadência (`NON_CADENCE_STEPS`): `E20`, `E27`, `FINALIZACAO`, `RESPOSTA_AUTOMATICA`. `KNOWN_STEP_KEYS` é a união dos dois e `isKnownStep` **recusa** qualquer chave fora disso, com motivo legível. **Já existe fonte única de etapas.**

### O que não existe

**[NÃO EXISTE]** E2, E5, E6, E7, E8 e a renumeração E0…E8. São conceito.

**Armadilha crítica:** `E4` **existe hoje** no fluxo `sem_resposta` e **não é** a E4 conceitual da jornada futura. Mesmo nome, significado diferente. O mesmo vale para E3.

### [RECOMENDAÇÃO] Como construir sem quebrar histórico

1. **Preservar todas as chaves atuais.** Elas estão gravadas em `executedSteps`, nos eventos e nas mensagens já enviadas. Renomear reescreve o passado (pergunta 5).
2. **Novas etapas nascem com chaves novas e distintas** — prefixo de geração (ex.: `G2_E4`), mesmo quando o rótulo humano coincidir. Resolve a colisão E4 × E4.
3. **Mapa de equivalência sim (pergunta 2), mas só para relatório** — nunca para migrar dados. Ele traduz na leitura; não toca em registro.
4. **Cada cadência guarda a versão de vocabulário com que nasceu.** Lead em andamento termina no vocabulário antigo; lead novo nasce no novo; sem conversão no meio.
5. **Campo `status: "ativa" | "planejada"` em `STEPS` (pergunta 3 e 4).** Etapa `planejada` aparece na configuração e é **recusada pelo planejador e pelo despachante**. A separação vira mecânica, não editorial: uma etapa só opera se estiver em `KNOWN_STEP_KEYS` **e** `ativa`. Enquanto E2/E5–E8 forem `planejada` (ou nem existirem), nenhum código consegue executá-las, por mais vezes que sejam citadas em planejamento.

---

## 4. Ação do Dia como central operacional

### Hoje

**[EXISTE]** `daily-actions.ts` é **leitura pura e bem construída**: agrega ligações, mensagens, reuniões e agenda, aplica precedência, colapsa duplicatas e distribui em buckets por fuso. **[NÃO EXISTE]** persistência da ação: nada do que é apresentado é gravado como obrigação.

### [RECOMENDAÇÃO] Estrutura central de ações, não evolução da `relationship_queue` (pergunta 1)

`relationship_queue` é fila de **execução do motor** (mensagens). Ação é obrigação **de trabalho humano** e engloba ligação, reunião, retorno, acompanhamento. Misturar os dois transforma a fila em duas coisas ao mesmo tempo e reintroduz o acoplamento que estamos desfazendo. A fila continua existindo para o que ela faz bem: E0 e respostas.

**Mesma lógica para todo tipo de ação (pergunta 2):** um único registro com `tipo` (ligação | mensagem | reunião | acompanhamento | retorno | reagendamento), `lead_id` obrigatório, `etapa`, `ciclo`, `responsavel`, `prevista_para`, `estado`. O que muda por tipo é apenas o **conjunto de resultados válidos**, não a estrutura.

**Duplicidade (pergunta 3):** chave única `lead_id + etapa + ciclo + tipo`. Duas tentativas de criar a mesma ação viram uma só, por construção do banco — não por verificação em código.

**Estados (pergunta 4):**

| Estado | Significado | Conta como executada? |
|---|---|---|
| `PLANEJADA` | prevista, sem resposta (disponível hoje ou futura) | não |
| *(atrasada)* | **não é estado** — leitura de `prevista_para < agora` | não |
| `EXECUTADA` | feita, com resultado informado (positivo **ou** negativo) | **sim** |
| `PULADA` | não foi feita, com justificativa | **não** |
| `REAGENDADA` | substituída por nova ação, com ponteiro | não |
| `BLOQUEADA` | impedimento técnico ou de regra | não |
| `EXPIRADA` | **[DECISÃO]** só se vocês decidirem que existe | não |

**Chave para não confundir:** duas dimensões independentes — **estado** (o que aconteceu com a ação) e **resultado** (o que aconteceu no mundo). "Não atendeu" é `EXECUTADA` + resultado negativo. "Não deu tempo" é `PULADA`.

**Isolamento de falha (pergunta 5):** o estado vive **no item**, não no job. Uma ação bloqueada não impede a criação nem a leitura das outras.

---

## 5. Pular uma ação

**[NÃO EXISTE]** hoje. **[RECOMENDAÇÃO]:**

1. **Sem confusão com resultado negativo (pergunta 1):** pular é estado; resultado negativo é resultado de uma ação executada. Como são campos diferentes, a contagem nunca mistura (pergunta 5 e 6).
2. **Registro obrigatório:** ação, lead_id, executivo, data/hora, etapa, motivo (lista fechada), justificativa (texto validado no servidor: não vazia, tamanho mínimo — texto livre serve para **ler**, nunca para contar), consequência.
3. **Append-only:** evento novo, nunca sobrescrita. A trilha sobrevive a qualquer mudança posterior.
4. **Quem pode pular (pergunta 3):** **[DECISÃO]**. Recomendação: responsável e gestão, com o autor sempre gravado — a diferença aparece no relatório.
5. **Relatório (pergunta 6):** coluna própria "puladas", separada de executadas e de atrasadas, com motivo agrupado e justificativa acessível ao abrir.

**[DECISÃO ESTRUTURAL — bloqueia implementação]** `isStepInOrder` exige que **todas** as etapas anteriores estejam em `executedSteps`. Uma etapa pulada **trava a sequência**. Ou (a) o pulo marca a etapa como consumida — destrava, mas registra como cumprida algo que não foi feito; ou (b) a verificação de ordem passa a aceitar lacuna explicitamente justificada — mais fiel, exige alterar a guarda de ordem. Recomendo (b). Isso responde a pergunta 2 e precisa ser decidido **antes** de qualquer código.

---

## 6. Agendamentos e reuniões

**[EXISTE]** `portal_meetings` (25 colunas) com o compromisso; `SCHEDULE_CREATED` pausa a cadência; `MEETING_FOCUS_WINDOW_MS` (15 min) para janela de foco.
**[NÃO EXISTE]** compareceu, não compareceu, cancelamento com motivo, evolução, reagendamento com vínculo.

**[RECOMENDAÇÃO] — fonte de verdade dividida por natureza, sem cópia (pergunta 1):**

- **`portal_meetings`** é a verdade do **compromisso**: quando, com quem, onde. A ação **referencia** e lê de lá — nunca copia data/hora.
- **A ação** é a verdade do **trabalho**: entrou na fila, foi respondida, qual o desfecho.
- Uma reunião = no máximo **uma** ação aberta (chave única). Duplicidade impossível por construção.
- Estados do compromisso (`agendada`, `realizada`, `não compareceu`, `cancelada`, `reagendada`) pertencem à reunião; `compareceu` / `evoluiu` / `reagendar` são resultado da ação (pergunta 3).
- **Reagendamento (pergunta 2): nova reunião, em uma transação.** A original é encerrada com resultado `reagendada`, a nova nasce com ponteiro para a anterior, e a ação antiga fica `REAGENDADA` para sempre. Reaproveitar a mesma reunião apagaria o histórico do que foi combinado antes.
- **Retomada (pergunta 4):** hoje a reunião pausa a cadência; no modelo novo quem retoma é **o resultado**. Sem resultado, o lead fica parado — por isso a pergunta 5 é obrigatória: precisa existir visibilidade explícita de "reuniões e ações sem desfecho", com prazo, para a gestão. Fechar sozinho por tempo seria inventar um fato que não aconteceu.

---

## 7. Identidade, notas e Workspace

**[EXISTE]** `can_access_investor`, `has_role`, RLS por executivo, autorização de leitura, `journey.server.ts` como agregador cronológico.

**[LACUNA REAL]** Convivem **duas identidades**: `portal_leads.id` (card operacional, `gs_<external_id>`) e `crm_leads.id` (espelho da origem). `guard.server.ts` traduz entre elas caso a caso. O vínculo AÇÃO → LEAD → RESULTADO → NOTA é verdadeiro na prática e **informal no contrato**: depende de cada chamador passar o ID certo.

**[RECOMENDAÇÃO]:**
1. **Eleger a canônica** (recomendo `portal_leads.id`, pois é onde a operação acontece) e guardar a outra como referência no mesmo registro — nunca como alternativa.
2. **A interface nunca envia lead_id (perguntas 1 e 2).** Ela envia `action_id`. O servidor **deriva** o lead a partir da ação. Nota salva no lead errado deixa de ser possível: não há campo para errar.
3. **Nota de outro executivo (pergunta 3):** o servidor compara o responsável da ação com o usuário autenticado antes de gravar; recusa é auditada. A camada de leitura já existe — falta a de escrita.
4. **Redistribuição (pergunta 4 e §8-9):** a ação guarda `responsavel_no_momento_do_planejamento`. O histórico **fica com a ação**, não com a pessoa: o passado registra quem era responsável naquele dia; o presente aponta para o novo responsável.
5. **Workspace (pergunta 5):** deve ler os mesmos eventos estruturados, sem cálculo próprio — uma fonte, várias telas.
6. Amarrar com chave estrangeira e RLS, não com convenção.

---

## 8. CRM / GreenSales — o lead que desaparece

### Diagnóstico verificado

- **Fonte de verdade (pergunta 1):** a origem **não informa** "mudou de coluna". Ela devolve o lead com suas **etiquetas**, e `resolveBoardColumn` (`src/lib/crm/board.ts`) **deduz** a coluna comparando etiquetas com as colunas declaradas no funil. Vence a posição mais avançada; `remarketing` é indicador, não posição. Nenhuma coluna reconhecida ⇒ `null`, e o chamador **preserva a última posição conhecida**.
- **Mudança de coluna (pergunta 3):** `lead-service.server.ts` compara `previous.stage_key` com o novo; mudou, grava `stage_entered_at = agora` e um evento com `de:` e `para:`. Existe também `entered_entry_stage_at`. **Confirmando o teste de vocês: NOVOS → FRIOS é registrado corretamente.**
- **Mudança de executivo (pergunta 2 e 4):** existe `transferLeadOwnership` e transferências auditadas; o vínculo atual mora em `responsible_executive_id`. É estado atual + evento — **não há trajetória consultável**.
- **A causa do desaparecimento (pergunta 5):** `portal-leads-board.tsx` agrupa **apenas por `stage_key` atual** e contém a linha decisiva `if (!lead.stageKey) continue;`. **Lead sem etapa não entra em nenhuma coluna** — é só um número no contador `outsideFunnel`. Ele continua no banco, com executivo e com cadência, e invisível. A coluna `nao_localizado` (`UNLOCATED_STAGE_KEY`, aplicada por `reconcile.server.ts`) cobre apenas o caso "sumiu da varredura", não o caso "sem coluna reconhecida".

**Cinco situações, três representações:**

| Situação | Hoje |
|---|---|
| mudou de etapa | etapa + carimbo + evento — **bem representado** |
| foi transferido | responsável novo + evento — **sem trajetória** |
| saiu do funil | `stage_key = null` ⇒ **invisível** |
| ficou sem etapa | **idêntico ao anterior** — indistinguível |
| não localizado na varredura | `nao_localizado` (coluna local do Portal) |

### [RECOMENDAÇÃO]

1. **`null` ambíguo precisa deixar de existir (pergunta 5).** "A origem tirou todas as etiquetas" e "esta resposta veio incompleta" produzem hoje o mesmo valor: um é fato, o outro é falha de leitura. São estados diferentes e precisam de nomes diferentes.
2. **Toda saída tem destino (pergunta 6).** Nenhum lead pode ficar sem coluna: sem coluna reconhecida, ele vai para uma **área de contingência explícita**, com motivo, data e origem da perda — visível, com ação de reenquadramento, nunca um contador mudo.
3. **Motivo e autor em toda mudança (pergunta 7).** O evento diz `de`/`para`, mas não diz *quem* (origem, executivo, reconciliação) nem *por quê*. Sim: manter histórico completo de proprietário e status, consultável — não reconstruído por eventos.
4. **Ações acompanham o lead (pergunta 9).** A obrigação é do investidor, não da pessoa; o responsável é reatribuído e o registro anterior é preservado. Ação encerrada nunca muda de dono.
5. **Sem duplicidade na redistribuição (pergunta 10):** a chave única é `lead_id + etapa + ciclo` — **não inclui o executivo**. Trocar de responsável, por definição, não pode gerar segunda ação.
6. **Conversa com a Ação do Dia (pergunta 8):** lead em contingência **não gera ação nova**, mas suas ações já planejadas continuam visíveis e sinalizadas — some da coluna, não da operação.

---

## 9. Mensagens do motor — versões completas

**[EXISTE]** `STEPS` declara `templatePurpose` e `contentGroup` por etapa; `decide.ts` devolve os dois; texto e link são montados **na execução** via `relationship_contents` + bindings; `CONTENT_REQUIRED_STEPS` deriva de `STEPS`.

**Respostas 1 e 2: sim.** A estrutura atual até *suportaria* várias versões, mas ao custo de mais uma camada de resolução em tempo de execução — exatamente o que vocês querem eliminar. Congelar **texto + link juntos** numa versão é mais simples e mais seguro: menos resolução, menos dependência externa, e o que foi enviado é literalmente o que estava gravado.

**[RECOMENDAÇÃO] — evolução aditiva:**

- Cada versão é um **registro próprio e imutável**: etapa, número, rótulo, `com_nome` / `sem_nome` (campo booleano, não convenção de texto — pergunta 8), texto completo, link completo, ativa/inativa.
- **Alteração nunca é retroativa (perguntas 3 e 6):** editar **cria** versão nova; a antiga permanece somente-leitura. Como a ação guarda o `id` da versão, mudança futura não toca no que já foi planejado nem no que já foi enviado.
- **A versão escolhida é gravada na ação** no momento em que ela é criada. Nada se recalcula depois.
- **Rotação (perguntas 4 e 5): determinística por lead.** É reprodutível em retry, homologação e auditoria. Aleatória não é reprodutível; sequencial global exige contador persistido e pode avançar indevidamente em retry.
- **Interface (pergunta 7):** lista por etapa, botão "+ nova versão", texto e link no mesmo formulário, prévia exatamente como o investidor receberá, e ativar/desativar em vez de apagar.
- **Transição (pergunta 9):** se a etapa tem versões, usa versão; se não tem, mantém o caminho atual. As duas arquiteturas coexistem e a migração é etapa a etapa.

**[LACUNA]** Se versões da mesma etapa tiverem finalidades diferentes, a checagem de template oficial de `decide.ts` (janela de 24 h) precisa saber qual versão será usada — hoje ela decide **antes** de a versão existir. Definir se `templatePurpose` mora na etapa ou na versão.

---

## 10. Resultados e auditoria

**[EXISTE] já recuperável:** etapa atual e `stage_entered_at`; evento `de`/`para`; ligações com `outcome` SIM/NÃO em `crm_cadence_tasks` + `CADENCE_TASK_DONE`; mensagens em `relationship_message_sends`; decisões e bloqueios em `relationship_engine_log` (incluindo cada tentativa barrada pela Safety Lock); `journey.server.ts`.

**[PARCIAL]** Cada canal tem vocabulário próprio (ligação SIM/NÃO, mensagem `..._SENT`, reunião sem desfecho) — os números **não são somáveis**.

**[NÃO EXISTE]** previsto × realizado por ação; responsável da obrigação; justificativa; pulada/reagendada/bloqueada; versão de mensagem usada; tentativas por ciclo.

**[RECOMENDAÇÃO]:**
1. **Estrutura (pergunta 1):** uma tabela de **ações** (estado atual) + uma de **eventos append-only** (tudo que aconteceu). O estado é derivável dos eventos; a tabela de ações existe por desempenho, não como verdade paralela.
2. **Imutável (pergunta 2):** todo evento, o `previsto_para` original, a versão de mensagem usada, o responsável no momento do planejamento.
3. **Obrigatórios (pergunta 3):** `action_id`, `lead_id`, tipo, etapa, ciclo, responsável, previsto para, estado; e no resultado: quem, quando, resultado, e justificativa quando pulada.
4. **Opções fechadas (pergunta 4):** todo resultado é lista fechada, por tipo. Texto livre existe **ao lado**, para ler — nunca para contar.
5. **Três coisas diferentes (pergunta 5):** não conseguiu contato = `EXECUTADA` + `sem_contato`; resultado negativo = `EXECUTADA` + `sem_interesse`; pulou = `PULADA` + justificativa.

---

## 11. Relatório administrativo

**[RECOMENDAÇÃO]:** o relatório lê **exclusivamente** a tabela de ações e seus eventos (pergunta 1). Nenhum número derivado de texto.

**Indicadores (pergunta 2):** previstas, executadas, atrasadas (leitura de data), puladas com motivo, bloqueadas, reuniões por desfecho, tempo entre previsto e realizado, cobertura por executivo, funil por etapa.

**Bater com o individual (pergunta 3):** o relatório é agregação da mesma linha que a Ação do Dia mostra — não há cálculo próprio nem cópia. Divergir seria impossível por construção.
**Pulada × executada sem sucesso (pergunta 4):** campos distintos (`estado` × `resultado`); nunca no mesmo total.
**Filtros (pergunta 5):** executivo, etapa, período, investidor, tipo, estado — todos colunas indexadas.
**Auditoria (pergunta 6):** eventos nunca são apagados nem editados; correção é evento novo.

---

## 12. Cron, filas e duplicidade

**Diagnóstico verificado:** `portal-crm-sync-automatico` (1 min) faz varredura + E0 + tick do motor no mesmo ciclo; a fila de E0 adiada opera com `.limit(200)` e janela de 3 dias; `buildCadenceQueue` lê até 5000 leads e **recalcula a fila inteira a cada leitura**; `remarketing-engine` roda a cada minuto com executor próprio.

**Por que o job travado represou e depois disparou em lote:** o estado vive **no ciclo**, não no item. Um job parado não deixa pendência marcada; quando volta, encontra tudo vencido ao mesmo tempo e processa em rajada. E o que estiver fora do limite de 200 / da janela de 3 dias é **descartado em silêncio**.

**[RECOMENDAÇÃO]:**
1. **Estado é do item (pergunta 1).** Cada ação tem vencimento próprio; job travado atrasa a *criação*, nunca apaga a obrigação.
2. **Chave idempotente (perguntas 2 e 3):** `lead_id + etapa + ciclo + tipo`, única no banco. Ao voltar, o job encontra a ação já existente em vez de recriar.
3. **Retry (pergunta 4):** retry recria a **mesma** chave ⇒ vira no-op. Retry nunca multiplica.
4. **Bloqueadas (pergunta 5):** estado explícito, com motivo e data — e uma visão da gestão para "planejadas há muito tempo sem desfecho".
5. **Sem avalanche (perguntas 6 e 7):** **marco de ativação** — só etapas com vencimento a partir dele viram ação; nada retroativo. Para E0: teto por ciclo, ordenação por vencimento e **descarte visível**, nunca silencioso. Para E1+ não existe rajada possível: sem executor automático, o que se recupera é *apresentação*, não *envio*.

---

## 13. Migração — ordem de implantação

| Fase | O que entra | Comportamento atual |
|---|---|---|
| **0. Contrato** | decisões da §15-E; nenhuma linha de código | inalterado |
| **1. Criação** | tabela de ações, eventos, versões de mensagem — vazias, sem consumidor | inalterado |
| **2. Sombra** | planejador consome `decide.ts` e grava ações; nada apresentado, nada executado; comparativo diário | inalterado |
| **3. Ação do Dia lê a nova fonte** | leitura passa para a tabela; resultados estruturados; pular; reuniões com desfecho | despacho automático segue só para E0 |
| **4. Corte** | whitelist obrigatória no canal; `engine.ts` restrito a E0; remarketing/closure/inbound/messaging resolvidos | **corte efetivo** |
| **5. Congelamento** | fontes antigas viram somente leitura, marcadas como históricas; nada apagado | leitura permanente |

**Rollback (pergunta 6):** em qualquer fase, desligar o caminho novo. Nada antigo foi removido até a fase 5, e mesmo lá só vira leitura.
**Sem duplicidade na transição (pergunta 7):** entre as fases 2 e 4 o planejador **grava** mas não executa; quem executa continua sendo um só. Nunca há dois executores ativos ao mesmo tempo.
**Ações anteriores ao corte (pergunta 8):** permanecem no formato antigo, como histórico consultável. Não são convertidas, não geram ação nova.

---

## 14. Safety Lock

1. **Sim, preservada integralmente (pergunta 1).** A whitelist é uma trava **adicional e anterior**; a Safety Lock continua sendo a última barreira antes da Graph API, e nenhuma etapa futura cria novo caminho até a Meta.
2. **Caminhos paralelos (pergunta 2):** os seis inventariados na §1 — precisam ser protegidos pela whitelist ou aposentados, nominalmente, na fase 4.
3. **Testar sem tocar na Meta (pergunta 3):** `execution-mode` + `channel.ts` já garantem que homologação nunca chama a Meta mesmo com token real; `guard.server.ts` recusa destinatário real em teste; leads `TEST-`.
4. **Ordem das travas (pergunta 4):** motivo → etapa → guard → ambiente → Safety Lock → canal.
5. **Impossível contornar (pergunta 5):** porque o motivo de autorização é **parâmetro obrigatório do canal**. Código sem motivo válido não envia — não é convenção, é assinatura.

---

## 15. ENTREGA CONSOLIDADA

**A) O que realmente existe hoje:** `decide.ts` puro e isolado; E0 já como exceção declarada (`FIRST_CONTACT_STEPS`); vocabulário fechado de etapas (`KNOWN_STEP_KEYS` + `isKnownStep`); Ação do Dia como leitura sólida com precedência, colapso e buckets; coluna deduzida de etiquetas com preservação em caso de dúvida; transições de etapa com carimbo e evento; ligações com desfecho binário; `portal_meetings`; autorização de **leitura** por papel e propriedade; `guard.server.ts`; ambiente antes de credencial; Safety Lock com auditoria; `journey.server.ts`.

**B) O que existe parcialmente:** histórico de movimentação (evento sim, trajetória não); transferência de executivo (estado sim, trilha não); conteúdo por etapa (vínculo sim, versão completa não); vocabulário de resultado (por canal, não somável); `nao_localizado` (cobre um caso, não todos).

**C) O que é apenas conceito futuro:** E2, E5, E6, E7, E8 e a renumeração E0→E8; tabela de ações; planejador; pular com justificativa; estados de reunião; versões completas de mensagem; whitelist de autorização de execução; relatório administrativo estruturado; área de contingência.

**D) Decisões de negócio já DEFINIDAS:** E0 é a única etapa automática; E1+ é ação humana apresentada na Ação do Dia; identificar não é executar; a Ação do Dia não decide cadência; ID do investidor é a identidade canônica; pular é permitido, com auditoria, e nunca conta como executado; mensagens serão versões completas (texto + link); histórico não é apagado nem renomeado; Safety Lock é absoluta; nenhuma mensagem real durante a construção.

**E) Decisões ainda pendentes:**
1. Identidade canônica: `portal_leads.id` ou `crm_leads.id`.
2. Pular **consome** a etapa ou a guarda de ordem passa a aceitar lacuna (**bloqueia a fase 1**).
3. Semântica de "nenhuma coluna reconhecida" — o que é fato e o que é falha de leitura.
4. Existe estado `EXPIRADA`?
5. `templatePurpose` mora na etapa ou na versão.
6. Destino de remarketing, campanhas e `inbound`: fluxo autorizado ou aposentadoria.
7. Quantas tentativas de ligação por ciclo.
8. Quem pode pular: apenas responsável, ou também gestão.
9. Confirmação de envio pelo executivo é sempre obrigatória?
10. Mapa de equivalência entre etapas atuais e E0…E8.
11. "Sem interesse" encerra ou suspende a cadência.
12. Prazo máximo de uma ação sem desfecho antes de escalar para a gestão.

**F) Arquitetura recomendada:**
```text
MOTOR (decide.ts, único)
   → PLANEJADOR (única escrita de ação; chave lead_id+etapa+ciclo+tipo)
        → E0: despacho automático (motivo E0_AUTOMATICA)
        → E1+: AÇÃO DO DIA → EXECUTIVO → RESULTADO (append-only)
                                   ├→ MOTOR decide de novo
                                   ├→ ficha/notas (derivadas do action_id)
                                   └→ RELATÓRIO (agregação, sem cálculo próprio)
```

**G) Ordem exata:** Fase 0 → 1 → 2 → 3 → 4 → 5, conforme §13. Sem pular fase: cada uma valida a anterior.

**H) Desenvolvíveis independentemente:** versões completas de mensagem (isolado); área de contingência do quadro (só CRM); histórico de proprietário/status; relatório administrativo (depois da tabela existir); estados de reunião.

**I) Dependências obrigatórias:** planejador depende da tabela de ações; Ação do Dia nova depende do planejador em sombra validado; whitelist depende do inventário resolvido; pular depende da decisão E-2; relatório depende dos eventos estruturados; corte do motor antigo depende de tudo acima.

**J) Maiores riscos:** `remarketing-engine` como executor paralelo real (1 min); `closure`, `auto-reply` e `inbound` alcançando o canal fora do tick; `messaging.server` enviando sem contexto; conciliação entre a chave de `crm_cadence_tasks` e a chave da ação nova; leads em contingência ficando sem tratamento; reunião que pausa a cadência e nunca recebe desfecho; algum campo de resultado nascer como texto livre (inviabiliza o relatório inteiro); confirmação humana divergir do mundo real.

**K) Testes obrigatórios antes de qualquer envio real:**
1. **Teste negativo:** acionar cada um dos caminhos inventariados e confirmar recusa **pela whitelist, antes** da Safety Lock. Se a recusa vier da trava, o teste falhou.
2. E0 continua funcionando integralmente após o corte.
3. Uma semana completa em sombra, incluindo sábado, sem divergência entre decisões e ações.
4. Homologação apenas com leads `TEST-`; `guard.server.ts` recusando destinatário real.
5. Responder duas vezes não duplica; ação atrasada permanece visível; etapa não reaparece no mesmo ciclo.
6. Nota com `action_id` de outro executivo recusada pelo servidor.
7. Relatório batendo com a contagem individual; pulada nunca somada a executada.
8. Redistribuição de lead não gera segunda ação.
9. Safety Lock intacta e auditando; **zero** mensagens reais durante toda a construção.

**L) Conflitos ainda não percebidos:**
1. **`E4` já existe** no fluxo `sem_resposta` com outro significado — colisão direta com a E4 conceitual da jornada futura. Idem `E3`.
2. **`isStepInOrder` incompatível com pular:** exige todas as anteriores executadas; uma etapa pulada trava a cadência silenciosamente.
3. **`executedSteps` é escrito na decisão, não no resultado** — no modelo novo isso marcaria como executado algo que só foi identificado.
4. **A autorização existente é só de leitura** — pode passar a falsa impressão de que já há controle de execução. Não há.
5. **`messaging.server.ts` se declara "única saída do CRM"** mas não recebe lead nem etapa: qualquer código futuro que o use passa por cima da regra sem perceber.
6. **`buildCadenceQueue` recalcula a fila inteira a cada leitura** — comportamento incompatível com ação persistente; precisa virar leitura da tabela, não recomputação.
7. **A reunião pausa a cadência hoje sem exigir desfecho** — no modelo novo isso cria leads parados indefinidamente.

---

**Nada foi implementado nesta rodada.** Este documento é a base arquitetural; cada fase da §13 deve ser autorizada por um comando próprio.

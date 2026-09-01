# Diagnóstico arquitetural final — pontos de comunicação ainda indefinidos

Rodada de diagnóstico. **Nada foi alterado**: sem código, banco, cron, interface, configuração ou envio. A Safety Lock permanece exatamente como está.

Este documento não repete os anteriores: foca nas **lacunas de comunicação entre as peças** — os lugares onde a informação existe mas não chega, ou chega sem significado suficiente.

**[HOJE]** verificado agora no código · **[PARCIAL]** existe em outra forma · **[FUTURO]** conceito · **[LACUNA]** ponto de comunicação indefinido.

---

## 1. Movimentação entre colunas — o que realmente chega

**[HOJE], verificado:**
- O GreenSales **não envia** "mudou de coluna". Ele devolve o lead com suas **etiquetas** (`withs: ["Tags","Forms"]`); a coluna é **deduzida** por `resolveBoardColumn`, comparando as etiquetas com as colunas declaradas no funil.
- Regra de resolução: vence a coluna de **posição mais avançada**; `remarketing` é indicador, não posição; **nenhuma coluna reconhecida ⇒ `null`, e o chamador preserva a última posição conhecida**.
- A mudança **é** registrada: `lead-service.server.ts` compara `previous.stage_key` com o novo, e quando muda grava `stage_entered_at = agora` e um evento com `de:` e `para:`. Também existe `entered_entry_stage_at` (entrada em NOVOS).
- Existe uma coluna **local** do Portal: `nao_localizado` (`UNLOCATED_STAGE_KEY`), aplicada por `reconcile.server.ts` a leads que **sumiram da varredura** — ela não existe no GreenSales.
- Consumo: `cadence.server.ts` usa `stage_entered_at` para ancorar a contagem; `decide.ts` usa `stageAtClosing` e `awaitingFirstHumanAction`.

**Portanto, no teste de mover NOVOS → FRIOS:** o Portal soube o destino, sim — desde que a etiqueta de FRIOS esteja declarada como coluna do funil e tenha vindo na resposta.

**[LACUNA] — o que falta para a jornada ser confiável:**
1. **Ambiguidade entre "voltou para nenhuma coluna" e "não veio etiqueta nesta resposta".** Os dois produzem `null` e ambos preservam a posição anterior. Um lead realmente destetiquetado é indistinguível de uma resposta incompleta. Hoje isso é mitigado por heurística (listagem x detalhe), não por contrato.
2. **`nao_localizado` mistura duas causas:** "saiu do funil" e "a varredura não o alcançou". São coisas operacionalmente diferentes e hoje têm o mesmo destino.
3. **Não há carimbo de origem da mudança** (veio da origem? foi movimentação interna? foi reconciliação?). O evento registra `de`/`para`, mas não *quem* moveu.
4. **A etapa vive em `crm_leads`** (espelho) e o card operacional é `portal_leads`. A correspondência entre as duas identidades é resolvida caso a caso (`gs_<external_id>`), não é um contrato único.
5. **Não há histórico de coluna** — só a posição atual e o instante da última mudança. Não é possível responder "por quais colunas esse lead passou".

Nada disso exige mudança agora; exige **decidir o contrato** antes da nova arquitetura, porque a Ação do Dia futura vai depender dele.

---

## 2. Motor → Ação do Dia

**[HOJE]** `decide.ts` já é uma função pura e isolada: recebe o registro + contexto e devolve `{ kind: "none" | "schedule_step" | "send_step", ... }` **com motivo legível**. Essa é a melhor notícia deste diagnóstico: o ponto de separação **já existe** — é o `kind`.

**[RECOMENDAÇÃO]** Não se cria motor novo. Insere-se um consumidor entre a decisão e a execução:

```text
decide.ts (não muda)
   ├─ kind: "none"          → nada
   ├─ kind: "schedule_step" → PLANEJADOR grava ação PLANEJADA (prevista_para = dueAt)
   └─ kind: "send_step"     → E0? despacha.  E1+? PLANEJADOR grava ação PRONTA
                                   └─ AÇÃO DO DIA → executivo → RESULTADO → volta ao decide.ts
```

**Componentes que deixam de executar e passam só a decidir/planejar:** `engine.ts` (executa só E0), `dispatch.server.ts` (só aceita chamada autorizada), `cadence.server.ts` / `buildCadenceQueue` (vira leitura), `scheduler.server.ts` (planeja, não dispara).

**[LACUNA]** `decide.ts` devolve `send_step` sem saber se o destino é automático ou humano. **Quem** faz essa distinção — o próprio `decide.ts` (ganhando um campo `execução`) ou o consumidor? Recomendo o consumidor, para não tocar na lógica de decisão. Precisa ser decidido antes de escrever a primeira linha.

**[LACUNA]** `executedSteps` hoje é gravado na decisão. Enquanto for assim, o motor considera executada uma etapa que o executivo ainda nem viu.

---

## 3. E0 como exceção automática

**[HOJE]** A separação já está **meio pronta e não sabe disso**: `decide.ts` declara `FIRST_CONTACT_STEPS = ["E0","E0_V1"]` e bloqueia todo o resto enquanto o lead aguarda a primeira ação humana. `step-registry.ts` já recusa etapa desconhecida com motivo legível. `guard.server.ts` valida destinatário por escopo. `execution-mode.ts` decide simulação pelo ambiente. A Safety Lock é a última barreira.

**[RECOMENDAÇÃO]** A regra nova mora **no mesmo lugar da Safety Lock — imediatamente antes dela**, e usa a estrutura que já existe:

```text
motivo de autorização válido?  →  etapa permitida para esse motivo?  →  guard de destinatário  →  SAFETY LOCK  →  canal
```

Motivos: `E0_AUTOMATICA` (só aceita `E0`/`E0_V1`), `RESPOSTA_HUMANA` (janela de 24 h), `ACAO_EXECUTADA_POR_HUMANO` (exige `action_id` + usuário). Sem motivo: recusa + auditoria no mesmo log que a Safety Lock já usa (`relationship_engine_log`).

Por que isso é à prova de caminho antigo: um cron legado, um retry ou uma rotina futura **não têm como produzir um motivo válido** — não é uma flag que se esquece de checar, é um parâmetro obrigatório da função.

**[LACUNA]** `messaging.server.ts` se declara "única saída do CRM" e chama `sendTextMessage` **sem contexto nenhum** (só telefone e texto). É o caminho mais fácil de burlar a regra sem querer. Precisa passar a exigir contexto, ou ser fechado.

---

## 4. Ação do Dia como registro real

**[HOJE]** `daily-actions.ts` declara no cabeçalho que não cria, não altera e não escreve. Tem chave determinística, precedência de fonte, colapso por lead e buckets. É excelente como leitura e insuficiente como registro.

**[FUTURO]** Tabela de ações com identidade própria: `action_id`, `lead_id`, `etapa`, `ciclo`, `tipo`, `responsável`, `prevista_para`, `estado`, `resultado`, `executada_em`, `executada_por`, `justificativa`, `acao_anterior`, `versao_mensagem`, `origem` — mais eventos append-only para o histórico de alterações.

**Sem perder histórico:** nada é migrado. A tabela nasce vazia e passa a valer **a partir do marco de ativação**; `crm_cadence_tasks`, eventos e `executedSteps` continuam existindo e sendo lidos como passado.

**[LACUNA]** `crm_cadence_tasks` tem chave `lead_id + channel + cycle_date + step_day`; a ação nova terá `lead_id + etapa + ciclo`. As duas precisam ser conciliadas, ou a ação precisa carregar a `CadenceRef` inteira (`crmLeadId`, `step`, `dueDate`, `cycleDate`) para conseguir concluir na origem — hoje `daily-actions.ts` já carrega isso justamente por causa dessa divergência.

---

## 5. Pular e reagendar

**[RECOMENDAÇÃO]** Duas dimensões independentes, e é isso que impede a confusão:

| | `estado` (o que aconteceu com a ação) | `resultado` (o que aconteceu no mundo) |
|---|---|---|
| Realizada | `EXECUTADA` | atendeu / não atendeu / compareceu / realizada… |
| Não realizada | `PLANEJADA` no fim do dia | — |
| Reagendada | `REAGENDADA` + `acao_anterior` | — |
| Pulada | `PULADA` + justificativa + autor + momento + destino | — |
| Bloqueada | `BLOQUEADA` + motivo técnico | — |
| Expirada | `EXPIRADA` (só se vocês decidirem que existe) | — |

"Não atendeu" é resultado **de execução** (tentou). "Estava em outra reunião" é `PULADA` (não tentou). Só `EXECUTADA` alimenta `executedSteps`.

**[LACUNA]** `completeCadenceTask` hoje tem `outcome` binário `SIM`/`NAO` com default `SIM`. Um default silencioso é veneno para auditoria — no modelo novo, resultado não pode ter default.

---

## 6. Mensagens completas

**[HOJE]** `STEPS` declara `templatePurpose` e `contentGroup` por etapa; `decide.ts` devolve os dois e a montagem acontece na execução, resolvendo `relationship_contents` via bindings. `CONTENT_REQUIRED_STEPS` é derivado de `STEPS` — já existe fonte única.

**[RECOMENDAÇÃO]** Evolução aditiva, sem ruptura: a etapa passa a poder ter **versões completas** (texto + com/sem nome + link + material), cada uma um registro próprio e imutável. Ordem de resolução: se a etapa tem versões, usa versão; se não tem, cai no caminho atual. Assim as duas arquiteturas coexistem e a migração é etapa a etapa, não big bang.

A versão escolhida é gravada **na ação**, no momento em que ela é criada — o histórico deixa de depender de recalcular qualquer coisa. Rotação recomendada: determinística por lead (reprodutível em retry e homologação); sequencial exige contador persistido e pode avançar indevidamente em retry.

**[LACUNA]** Definir se `templatePurpose` continua vivendo na etapa ou passa para a versão. Se uma etapa tiver versões com finalidades diferentes, a checagem de template oficial de `decide.ts` (janela de 24 h) precisa saber **qual versão** será usada — hoje ela decide antes de a versão existir.

---

## 7. Etapas atuais x futuras

**[HOJE]** `STEPS` (cadência) + `NON_CADENCE_STEPS` (`E20`, `E27`, `FINALIZACAO`, `RESPOSTA_AUTOMATICA`) formam `KNOWN_STEP_KEYS`, e `isKnownStep` recusa qualquer chave fora disso.

**[RECOMENDAÇÃO]** A porta de entrada já existe: basta que cada etapa declare `status: "ativa" | "planejada"` e `execução: "AUTOMATICA" | "MANUAL"`. Etapa `planejada` fica visível na configuração e é **recusada pelo planejador e pelo despachante** — é assim que E2/E4–E8 podem ser discutidas sem operar.

Chaves históricas **nunca** são renomeadas; novas etapas nascem com chaves novas; cada cadência guarda a versão do vocabulário com que nasceu; o mapa antigo↔novo é tabela de correspondência para relatório, jamais migração.

**[LACUNA]** `FLOW_SEQUENCE` define a ordem por fluxo e `isStepInOrder` exige que todas as anteriores estejam em `executedSteps`. Se uma etapa for pulada, ela **trava a sequência**. Decidir: pular grava a etapa como consumida (destrava, mas mente sobre execução) ou a sequência passa a aceitar lacuna explícita? Esta é a decisão mais estrutural pendente.

---

## 8. Identidade do investidor

**[HOJE]** A base é orientada a ID e nenhuma escrita busca por nome. Mas convivem **duas identidades**: `portal_leads.id` (card operacional, `gs_<external_id>`) e `crm_leads.id` (espelho da origem). `guard.server.ts` traduz entre elas justamente porque a ausência dessa tradução matava a cadência depois da E0, e `daily-actions.ts` carrega `crmLeadId` separado em `CadenceRef`.

**[LACUNA]** A garantia AÇÃO → LEAD_ID → RESULTADO → NOTA → HISTÓRICO é **verdadeira na prática e informal no contrato**: depende de cada chamador passar o ID certo. Falta (a) eleger a identidade canônica da ação, (b) guardar a outra como referência explícita, (c) fazer o servidor **derivar** o `lead_id` do `action_id` em vez de aceitá-lo do cliente, e (d) chave estrangeira + RLS que tornem nota órfã ou cruzada impossível.

---

## 9. Agendamentos e reuniões

**[RECOMENDAÇÃO] Fonte de verdade: `portal_meetings`** para *o compromisso* (quando, com quem, onde). **A ação** é a fonte de verdade para *o trabalho* (apareceu na fila, foi respondida, resultado). A ação **referencia** a reunião e não copia nada — uma reunião = no máximo uma ação aberta.

Estados de reunião (`agendada`, `realizada`, `não compareceu`, `reagendada`, `cancelada`) pertencem à reunião; `compareceu` / `evolucao` / `reagendar` são o resultado da ação. Reagendar em uma transação: reunião original encerrada, nova criada, nova ação com ponteiro para a anterior.

**[LACUNA]** Hoje `SCHEDULE_CREATED` pausa a cadência. No modelo novo quem **retoma** é o resultado da reunião — se o resultado nunca for registrado, o lead fica parado para sempre. Precisa de visibilidade explícita de "reuniões sem desfecho".

---

## 10. Visibilidade e auditoria

**[HOJE] já existe:** `crm_lead_events` (`CADENCE_TASK_DONE` com canal, etapa, outcome), evento de mudança de etapa com `de`/`para`, `relationship_engine_log` (inclusive os bloqueios da Safety Lock, com fluxo/etapa/origem/telefone mascarado), `relationship_message_sends`, `journey.server.ts` como agregador cronológico.

**[LACUNA] falta estruturar:** responsável por ação, previsto x realizado, justificativa, estado (pulada/reagendada/bloqueada), e um vocabulário **comum entre canais** — hoje ligação, mensagem e reunião falam idiomas diferentes, então não são somáveis. Com a tabela de ações, todos os filtros pedidos (investidor, ID, executivo, etapa, tipo, período, resultado, puladas, reagendadas, bloqueadas) viram consulta direta em colunas indexadas.

---

## 11. Filas, atrasos e lotes

**[RECOMENDAÇÃO] Três princípios, que atacam exatamente o incidente já vivido:**
1. **Estado é do item, não do job.** Cada ação tem seu próprio vencimento; um job travado atrasa a *criação*, nunca apaga a obrigação. Quando o job volta, encontra ações já existentes (chave única) em vez de recriar.
2. **Atraso é leitura, não evento.** `resolveBucket` já faz isso: `prevista_para < agora` ⇒ atrasada, e ação atrasada **nunca** é convertida em ação de hoje nem sumida.
3. **Recuperação sem rajada.** Quando a fila destrava, o que se recupera é *apresentação*, não *envio* — E1+ é humano, então não existe lote automático possível. Para E0, teto por ciclo e ordenação por vencimento; e o teto precisa ser **visível** (hoje a janela de 3 dias / limite 200 descarta em silêncio).

---

## 12. Inventário de caminhos

| Caminho | Hoje | Futuro |
|---|---|---|
| `relationship/e0` | primeiro contato automático | **permanece** — única automação, com motivo `E0_AUTOMATICA` |
| `relationship/dispatch` | despacha qualquer etapa | **limitado** pela whitelist |
| `relationship/engine` | decide e executa | **transformado em planejamento** (só E0 executa) |
| `relationship/scheduler` | programa e dispara | **transformado em planejamento** |
| `relationship/closure` (E27/FINALIZACAO) | envia fora do tick | **limitado** — exige motivo explícito |
| `relationship/inbound` / auto-reply | resposta automática | **decisão de negócio**: manter como `RESPOSTA_HUMANA` assistida ou aposentar |
| `remarketing/engine` + cron 1 min | executor paralelo real | **decisão de negócio** — reclassificar ou **aposentar** |
| `campaigns.server` | disparo em lote | **limitado** a ação humana autorizada |
| `crm/messaging` | "única saída do CRM", sem contexto | **alterado** — passa a exigir contexto/motivo |
| `crm/automation` | automações do CRM | **limitado** ou aposentado |
| `crm_cadence_tasks` / `buildCadenceQueue` | cria a obrigação de ligação | **somente leitura** |
| Webhook da Meta | entrada | **permanece** |
| Safety Lock | última barreira | **permanece intacta** |
| `whatsapp-safety-lock.functions` (leitura) | somente leitura, sem escrita | **permanece** |

---

## 13. Ordem de virada

| Fase | Entra | Validação antes de avançar |
|---|---|---|
| **0. Contrato** | decidir identidade canônica, semântica de `null` de coluna, e se pular consome etapa | nenhuma linha de código antes disso |
| **1. Sombra** | tabela de ações + eventos; planejador consome `decide.ts`; nada apresentado, nada executado | uma semana completa (com sábado): toda decisão tem ação correspondente, sem sobra nem falta; nada sai de `PLANEJADA` |
| **2. Apresentação** | Ação do Dia lê a tabela; resultados estruturados; ligações legadas viram leitura | homologação com leads `TEST-`: atrasada continua visível; responder duas vezes não duplica; etapa não reaparece no ciclo; colapso por lead intacto |
| **3. Corte** | whitelist obrigatória; `engine.ts` para de executar E1+; remarketing/closure/inbound/messaging resolvidos | **teste negativo**: acionar cada caminho da seção 12 e confirmar recusa **pela whitelist, antes** da Safety Lock. Se a recusa vier da trava, falhou. E0 continua funcionando |
| **4. Consolidação** | pular, reagendar, relatório, notas por ID, versões de mensagem | relatório bate com contagem direta; pular não conta como executado; reagendamento preserva a reunião; nota com `action_id` alheio é recusada |

---

# BASE PARA OS FUTUROS COMANDOS DE IMPLANTAÇÃO

**A. Mantido:** `decide.ts` (decisão intocada); `FIRST_CONTACT_STEPS`; `step-registry` e `isKnownStep`; `guard.server.ts`; `execution-mode`; `channel.ts` (ambiente antes de credencial); Safety Lock e seu log; toda a lógica de precedência, colapso, buckets e fuso de `daily-actions.ts`; `portal_meetings`; `resolveBoardColumn`; `stage_entered_at` e o evento `de`/`para`; histórico integral.

**B. Alterado:** `executedSteps` escrito no resultado; `engine.ts` executa só E0; `dispatch` exige motivo; `whatsapp.server` recebe a whitelist; `messaging.server` passa a exigir contexto; `daily-actions` lê a tabela; `cadence.server` vira leitura; `STEPS` ganha `status` e `execução`; reunião ganha resultado e reagendamento; `outcome` perde o default.

**C. Criado:** planejador; tabela de ações; eventos de resultado append-only; whitelist de autorização; vocabulário fechado por tipo; estados `PULADA` / `REAGENDADA` / `BLOQUEADA` (e `EXPIRADA`, se decidido); versões completas de mensagem; relatório do dia; painel de resposta ampliado.

**D. Descontinuado (deixa de agir, não é apagado):** `engine.ts` executando E1+; `crm_cadence_tasks` como criador de obrigação; montagem mensagem+conteúdo+link para etapas novas; `remarketing-engine` como executor autônomo (pendente de decisão); saída sem contexto no `messaging.server`.

**E. Regras que não podem ser quebradas:**
1. E0 é a única automação; E1+ nunca sai automaticamente.
2. Identificar não é executar.
3. Nenhum caminho novo até o canal; a saída é única.
4. A whitelist recusa **antes** da Safety Lock; a trava nunca é a primeira linha de defesa.
5. A Safety Lock não é removida, enfraquecida nem contornada.
6. Nenhuma mensagem real durante a construção.
7. Nenhuma etapa histórica renomeada; nenhum backfill retroativo.
8. Toda escrita de ação passa pelo planejador.
9. Todo `lead_id` é derivado do `action_id` no servidor.
10. Nenhuma regra lê texto livre.
11. Ação atrasada nunca some nem executa sozinha.
12. Um único motor de decisão.

**F. Ordem recomendada:** Fase 0 (contrato) → Fase 1 (sombra) → Fase 2 (apresentação) → Fase 3 (corte) → Fase 4 (consolidação). Rollback em qualquer fase: desligar o caminho novo; nada antigo foi removido.

**Decisões pendentes que bloqueiam a Fase 0:** identidade canônica do lead na ação; semântica de "nenhuma coluna reconhecida"; pular consome etapa ou a sequência aceita lacuna; `templatePurpose` na etapa ou na versão; destino do remarketing e do `inbound`; existe `EXPIRADA`?; mapa das etapas atuais para E0…E8.

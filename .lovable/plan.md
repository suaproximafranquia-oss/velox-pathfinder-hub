# Diagnóstico técnico — transição da Ação do Dia `/f`

Somente leitura. Nenhum código, dado, rota, migration ou comportamento foi alterado.

## 1. CAUSA RAIZ

A falha é uma combinação de **duas lacunas independentes**:

1. **Frontend:** o endpoint de conclusão já devolve `result.queue`, mas `completeWithStability()` descarta essa fila, mantém uma espera fixa de 4 segundos e faz uma segunda leitura completa. Essa nova leitura pode selecionar outro lead antes de enxergar ou priorizar a continuação.
2. **Servidor:** a continuidade server-side é explicitamente restrita à E0 (`recentContinuityLead()` só retorna o lead se `step === "E0"`). E1, E2/V2, E3/V3 e E4 geram mensagem pelo mesmo motor, mas não recebem a mesma promoção.

Existe ainda uma janela estrutural curta: a ligação atual passa de `PROCESSING` para `EXECUTED` antes de `tickLead()` criar a próxima ação. O mesmo request aguarda o tick antes de montar `result.queue`, mas outra leitura concorrente pode ocorrer nesse intervalo. Portanto, a proteção do claim termina na conclusão da ação atual; ela não atravessa formalmente a transição até a próxima ação.

## 2. ONDE A PROTEÇÃO SE PERDE

### Servidor

- `currentDailyAction()` protege a ação corrente ao fazer o claim atômico `PENDING → PROCESSING`.
- `registerQueueCallOutcome()` muda essa linha para `EXECUTED`. Nesse instante ela deixa de ser lida por `buildDailyActions()`.
- Depois disso, `tickLead()` roda e cria a próxima ação.
- Não existe um estado persistido “conclusão em processamento” nem uma trava que una atomicamente ação concluída + próxima ação criada.
- `queueAfterOutcome()` só monta a fila definitiva **depois** do tick.
- Se o tick falhar, a exceção é absorvida e o scheduler regular deverá criar a continuação posteriormente; nesse caso `result.queue` pode legitimamente vir sem a mensagem.

### Frontend

- Enquanto `run()` está pendente, `transitioningRef` mantém a tela inerte e a fila anterior visível; não há troca intermediária causada por `setActions` nesse período.
- A perda ocorre ao final: `completeWithStability()` ignora `result.queue`, espera 4 segundos e chama `revalidateCompletion()`.
- `commitQueue()` recebe a fila dessa segunda consulta. Se ela não contém uma ação automática do lead atual, limpa `continuityLeadRef.current` e `firstExecutableKey()` escolhe outro lead.
- `continuityLeadRef` é preenchida antes de saber se a conclusão deu certo; em falha, pode deixar uma continuidade falsa.

## 3. QUAIS ETAPAS SÃO AFETADAS

| Etapa/contexto | Sequência real | “Não atendeu” | Continuidade server-side atual |
|---|---|---|---|
| E0 | Ligação 1 → 10 min → Ligação 2 → Mensagem | `tickLead()` libera/cria a próxima ação | Sim, regra especial de 20 min |
| E1 | Ligação 1 → Mensagem; ligação adicional em +2h | Mensagem liberada após a ligação | Não |
| E2 / V2 | Ligação → Mensagem; ligação compensatória quando aplicável | Mensagem liberada após a ligação | Não |
| E3 / V3 | Ligação → Mensagem | Mensagem liberada após a ligação | Não |
| E4 | Ligação → Mensagem | Mensagem liberada após a ligação | Não |
| E7 | Somente mensagem | Não há ligação anterior | Não se aplica |
| R1 | Somente mensagem | Não há ligação anterior | Não se aplica |
| R2 | Somente mensagem | Não há ligação anterior | Não se aplica |
| RE0 | Somente mensagem | Não há ligação anterior | Não se aplica |
| RE1 | Somente mensagem | Não há ligação anterior | Não se aplica |

No código atual, apenas **E0, E1, E2/V2, E3/V3 e E4** possuem o padrão ligação → possível mensagem. E7, R1, R2, RE0 e RE1 caem no plano padrão de mensagem única; não possuem resultado de ligação `SIM/NAO`.

## 4. SERVIDOR

Fluxo real:

```text
assertCurrentQueueItem()
→ confirma que a ação é a posição 1 oficial
→ registerQueueCallOutcome()
→ linha atual: PROCESSING/PENDING → EXECUTED
→ se SIM: cancela ações restantes da mesma etapa
→ tickLead(leadId)
→ decideCadenceV2()
→ repository.upsertQueueItem()
→ cria/libera a próxima ação em relationship_queue
→ queueAfterOutcome()
→ currentDailyAction(skipReconcile: true)
→ result.queue
```

Proteções existentes:
- claim atômico impede duas abas de reivindicarem a mesma ação;
- `assertCurrentQueueItem()` impede conclusão fora da ordem;
- update condicionado a `PENDING/PROCESSING` impede resultado duplicado.

O que não existe:
- proteção persistida do lead entre `EXECUTED` e o `upsert` da continuação;
- continuidade genérica para qualquer ação `call + NAO + próxima ação da mesma etapa`;
- garantia de continuação se `tickLead()` falhar.

## 5. FRONTEND

Arquitetura relevante:

- `DailyActionCard.resolveNow()` delega ao `onComplete` no modo real.
- O overlay sempre passa `completeWithStability()` no `/f`.
- Por isso, o ramo de `resolveNow()` que já utiliza `result.queue` não é usado no fluxo real.
- `completeWithStability()`:
  - marca transição;
  - define continuidade de forma otimista;
  - espera mutation + 4 segundos;
  - descarta `result.queue`;
  - faz um GET completo;
  - só então chama `commitQueue()`.
- `commitQueue()` reclassifica, limpa continuidade se não encontrar ação automática do mesmo lead e escolhe `firstExecutableKey()`.

Conclusão: o “pulo” visível não é produzido pelo motor da cadência. Ele nasce do desacordo entre dois caminhos do frontend: o caminho comum aceita a fila devolvida pela mutation; o caminho real com barreira descarta essa fila.

## 6. CADÊNCIA / `relationship_queue`

- As ações são relacionadas por `scope + run_id + lead_id + step + action_order`.
- A mensagem não é derivada visualmente.
- Para E1/E2/E3/E4, ela não fica pré-criada aguardando liberação: nasce quando `tickLead()` observa a ligação como concluída e `decideCadenceV2()` libera a próxima ação.
- O repositório persiste a mensagem em `relationship_queue` com `action_kind="message"`, `status="PENDING"`, `due_at` e `action_order`.
- A Ação do Dia lê apenas `PENDING/PROCESSING` e converte a linha em `DailyAction`.
- E0 segue a mesma arquitetura, com plano interno próprio (duas ligações e espera de 10 minutos).

### Caso “Atendeu”

- A ligação vira `EXECUTED`, `result="SIM"`.
- Ações restantes da mesma etapa são `CANCELLED` com `cancel_reason="contact_attended"`.
- A mensagem daquela etapa deixa de ser necessária.
- A cadência não é congelada só por atender; o motor segue para a próxima transição normal, salvo bloqueio por compromisso/estágio.

### Caso “Não atendeu”

- A ligação vira `EXECUTED`, `result="NAO"`.
- `tickLead()` libera/cria a próxima ação interna.
- Quando a próxima é mensagem, ela é inserida em `relationship_queue`; não é mera mudança visual.

## 7. `result.queue`

Quando `tickLead()` termina com sucesso:
- a mensagem já está persistida;
- a fila já foi reconstruída no servidor;
- a linha concluída já saiu;
- a nova mensagem já está presente;
- deduplicação, colapso por lead, bucket e ordenação já foram aplicados.

Limitações:
- para E0 há promoção server-side de continuidade;
- para E1/E2/E3/E4 não há promoção equivalente;
- se `tickLead()` falhar e a exceção for absorvida, a fila pode vir sem a continuação até o scheduler regular;
- `skipReconcile: true` evita uma reconciliação extra, mas não torna a fila “local” ou não oficial.

O frontend real não usa essa fila imediatamente: descarta-a e faz nova consulta.

## 8. ORDENAMENTO / CONTINUIDADE

Pipeline:

```text
dedupeDailyActions()
→ collapseByLead()
→ sortDailyActions()
→ actionRank()
→ firstExecutableKey()
```

- Uma mensagem recém-criada normalmente recebe `hoje` (rank 4) ou `atrasada` (rank 3).
- Ações `claimed` recebem rank 0.
- `continuityLeadId` é aplicado **antes do rank**, colocando a ação automática do mesmo lead à frente.
- No servidor, `recentContinuityLead()` aplica isso apenas à E0.
- No cliente, `continuityLeadRef` tenta aplicar a qualquer lead, mas não pode ser a única fonte de verdade e hoje depende da segunda leitura encontrar a continuação.
- `collapseByLead()` pode colocar a mensagem em `secondary` se houver reunião/handoff/agenda/closure de maior precedência para o mesmo lead.

Assim, uma continuação de E1/E2/E3/E4 pode perder a posição para outro lead mesmo dentro da própria `result.queue`. O problema não é apenas atraso de renderização; existe assimetria real na autoridade server-side.

## 9. BOTÃO “COPIAR MENSAGEM”

Componente: `src/components/crm/daily-action-card.tsx`.

Fluxo atual:

```text
botão “Copiar mensagem”
→ handleOpenMessage()
→ prefetch ou adapter.loadMessage()
→ getDailyActionMessageFn()
→ Biblioteca ativa
→ setMessageOpen(true)
→ copyMessageBody()
→ Clipboard API / fallback textarea
```

- O primeiro clique **sempre abre um painel** (`messageOpen=true`) e só depois tenta copiar.
- O painel possui novamente “Copiar mensagem/Copiar novamente” e “Concluído”. Portanto, o comportamento observado é exatamente o código atual, não efeito da transição da fila.
- Se a leitura da Biblioteca lança erro, o painel não abre e o card permanece.
- Se a leitura retorna `null`, o painel abre sem mensagem oficial e nada é copiado.
- Se a Clipboard API falha, o painel abre e orienta cópia manual.
- O painel usa `absolute inset-0`; como o card não é o ancestral posicionado, ele pode cobrir todo o diálogo da Ação do Dia, reforçando a sensação de “outro card/modal”.
- “Copiar” nunca conclui. “Concluído” exige mensagem e cópia bem-sucedida, registra a mensagem e então entra no mesmo `completeWithStability()` defeituoso.

Esse problema é **separado** da troca Tiago/Felipe. Eles apenas convergem quando “Concluído” da mensagem dispara a transição de fila.

## 10. CORREÇÃO MÍNIMA RECOMENDADA

Sem nova fila, scheduler, tabela, polling ou exceção por etapa:

1. **Servidor:** generalizar a continuidade de `recentContinuityLead()` para reconhecer uma ligação `EXECUTED` com `result="NAO"` cuja próxima ação automática da mesma etapa/lead já exista, em vez de testar `step === "E0"`.
2. **Resposta da mutation:** manter `queueAfterOutcome()` como o ponto único que devolve a fila definitiva. Quando o tick falhar, devolver explicitamente ausência/estado de reconciliação, sem fingir que a fila está completa.
3. **Frontend:** manter o card atual e a interface inerte apenas enquanto `run()` estiver pendente; ao receber `result.queue`, aplicar essa fila diretamente via `commitQueue()`.
4. Remover a espera fixa de 4 segundos. Usar releitura somente como fallback quando não vier `queue` ou houver falha.
5. Definir `continuityLeadRef` somente após sucesso; nunca antes da mutation.
6. Unificar o tratamento de retorno entre `resolveNow()` e `completeWithStability()` para existir um único caminho “mutation → fila oficial → commit”.
7. **Cópia:** separar a ação “Copiar” da ação “Abrir detalhes/concluir”. O botão “Copiar” deve carregar e copiar diretamente; o painel só deve abrir quando a cópia falhar ou quando o executivo escolher concluir/registrar. Corrigir também o ancestral posicionado do painel.

A correção operacional principal é estrutural e genérica: **resultado confirmado + próxima ação existente do mesmo lead = continuidade**, independentemente da etapa.

## 11. ARQUIVOS / FUNÇÕES EXATOS A ALTERAR

Obrigatórios para a correção futura:
- `src/server/crm/daily-actions-gate.server.ts`
  - `recentContinuityLead()`
  - `currentDailyAction()` (somente se necessário para receber contexto explícito da mutation)
- `src/lib/crm/daily-actions.functions.ts`
  - `queueAfterOutcome()` / `registerQueueCallOutcomeFn`
- `src/components/crm/daily-actions-overlay.tsx`
  - `completeWithStability()`
  - `commitQueue()`
  - `revalidateCompletion()` apenas como fallback
- `src/components/crm/daily-action-card.tsx`
  - `resolveNow()`
  - `handleOpenMessage()`
  - painel `messageOpen`

Possivelmente, apenas para tornar falha do tick explícita:
- `src/server/relationship/call-outcome.server.ts`
  - `registerQueueCallOutcome()`

## 12. O QUE NÃO PRECISA SER ALTERADO

- `relationship_queue` e seu schema;
- `cadence-v2.ts`;
- `cadence-v2-decide.ts`;
- `config.ts` / `flow-plan.ts`;
- `tickLead()` e o motor, salvo sinalização explícita de falha;
- `repository.server.ts`;
- `buildDailyActions()`;
- `resolveBucket()`, `actionRank()`, `collapseByLead()` e `normalizeDailyActions()`;
- Biblioteca de mensagens;
- prefetch da mensagem;
- Clipboard helper;
- regras SIM/NAO;
- espera de 10 minutos da E0;
- GreenSales;
- outras rotas/ambientes.

## 13. RISCOS DE IMPACTO EM OUTRAS ETAPAS

- Generalizar a continuidade muda E1, E2/V2, E3/V3 e E4, além da E0. Esse é o objetivo, mas exige testes focados em cada uma.
- Não aplicar a continuidade a etapas de mensagem única (E7, R1, R2, RE0, RE1), nem ao caso `SIM`.
- Não promover próxima etapa macro após “Atendeu” como se fosse continuação interna; a regra deve exigir `NAO` + próxima ação da mesma cadeia/etapa.
- Reutilizar `result.queue` afeta também conclusão de mensagem, reunião e follow-up porque todos passam por `completeWithStability`; a implementação deve aplicar a regra genericamente apenas quando a resposta realmente trouxer `queue`.
- Alterar o botão “Copiar” não pode marcar mensagem como concluída nem contornar a exigência de confirmação.

Problema fora do escopo, apenas registrado: o servidor absorve falha de `tickLead()` e deixa a próxima obrigação para o scheduler; isso impede garantia absoluta de fila definitiva sem um sinal explícito no retorno.

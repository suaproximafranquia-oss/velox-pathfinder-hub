# Auditoria somente leitura — entrada de lead novo e retomada da E0 fora da janela (Financeira /f)

Nada foi executado, alterado, sincronizado, reprocessado ou limpo. Apenas leitura de banco e de código.
(Observação: em modo planejamento só posso escrever este arquivo; `roadmap.md` não foi tocado.)

## A) Fluxo real atual (GreenSales → Ação do Dia)

```text
origem GreenSales
  → lead-sync.server.ts (cron/scheduler)
  → intakeLead()                        src/server/crm/lead-intake.server.ts
      1 normalizeGreenSalesLead
      2 upsertLead()                    → crm_leads (+is_test/test_batch_id)
      3 cadenceEligibility(cutover)     → corta LEGADO
      4 isE0NightWindow()               → se fora da janela: deferFirstContact() e RETORNA
      5 executionMode({isTestLead})     → simulado x real
      6 resolveResponsibleByUserId(connectionUserId) → executive_profiles
      7 ensureWorkspaceCard()           → portal_leads gs_<externalId> (com responsável, is_test)
      8 resolveExecutiveE0Mode(exec)    → automatico | manual
         manual    → createPendingE0Action() → workspace_e0_actions (PENDENTE) → Ação do Dia
         automatico→ registerFirstContact() → dispatchFirstContact() (e0.server)
              → destinos → Biblioteca (renderFromLibrary "E0") → crm_messages msg_e0_<cardId>
              → engine.handleEvent(FIRST_CONTACT_SENT) → relationship_cadences CADENCE_ACTIVE
  → Ação do Dia agrega: E0 pendente, relationship_queue, ligações recalculadas, reuniões, agenda
```

## B) O que aconteceu com `[TESTE] Ana Teste 01`

- `crm_leads.id = f99b30ef-1b55-4667-8649-e2e80a9d0734`, `external_id = TEST-20260904-A-01`,
  `is_test = true`, `test_batch_id = TEST-20260904-A`, `stage_key = novos`,
  `canonical_investor_id = null`, `environment = null`.
- `crm_lead_events`: `lead_criado` (01:57:28Z) e `e0_adiada` (01:57:29Z, "retomada automática em 04/09 às 07:00").
- **Não existe** `portal_leads`, `workspace_e0_actions`, `msg_e0_*`, `relationship_cadences` nem
  `relationship_queue` para este lead (verificado por consulta).
- Logo, `Mensagens = 0` e `Próxima ação: —` na tela são o estado real; o único dado "otimista"
  é `Responsável: Thiago`, que hoje só existe como parâmetro do lote, não persistido em card.

## C) Por que o card não nasceu às 22:57

Em `intakeLead`, a checagem `isE0NightWindow()` ocorre **antes** de `ensureWorkspaceCard`
(linhas ~165-169) e faz `return` imediato. Card, responsável, modo E0 e E0 estão todos
depois desse ponto. Entrada às 22:57 BRT está fora de Seg–Sex 07:00–22:30 (§16).

## D) Como ocorrerá a retomada às 07:00

`processDeferredFirstContacts()` (`first-contact-queue.server.ts`), chamado por
`sync-scheduler.server.ts` e `lead-sync.server.ts`:

1. lê `crm_lead_events` com `type = 'e0_adiada'` nos últimos 3 dias;
2. descarta quem já tem `e0_simulada` / `boas_vindas_enviada`;
3. relê `crm_leads` (id, external_id, name, phone, email, datas, remarketing, raw_payload) —
   **não seleciona `is_test`/`test_batch_id`**;
4. chama `ensureWorkspaceCard({ ... })` **sem** `responsibleExecutiveId`, `responsibleExecutiveSlug`,
   `isTest`, `testBatchId`;
5. chama `registerFirstContact(... simulated: isSimulatedExecution())` — sem `isTestLead`;
6. `registerFirstContact` → `dispatchFirstContact` cria `msg_e0_<cardId>` e o motor inicia a cadência.

Note que a retomada **nunca consulta `resolveExecutiveE0Mode`**: ela executa a E0 direto,
sem passar pela bifurcação automático/manual do `intakeLead`.

## E) Responsável — preservado?

- Fonte de verdade no fluxo normal: `crm_connections.user_id` → `executive_profiles`
  (`resolveResponsibleByUserId`), resolvido dentro do `intakeLead` e persistido em
  `portal_leads.responsible_executive_id/_slug` pelo `ensureWorkspaceCard`.
- `crm_leads` **não tem coluna de responsável** — nada da resolução é guardado antes do card.
- Lead dentro da janela: responsável resolvido e persistido. ✔
- Lead fora da janela: o `intakeLead` retorna antes de resolver; a retomada não tem de onde
  recuperar (não há connectionUserId no evento, nem responsável em `crm_leads`).

**Resposta direta:** se um lead real do Thiago entrar às 22:57, a retomada das 07:00
**não** recupera Thiago. O card nasce com `responsible_executive_id = null`.
Ponto exato da perda: `intakeLead` retorna antes de `resolveResponsibleByUserId`, e
`processDeferredFirstContacts` chama `ensureWorkspaceCard` sem responsável.

## F) Marcador de teste — preservado?

- `crm_leads`: sim (`is_test`, `test_batch_id` gravados no upsert).
- Card na retomada: **não** — `ensureWorkspaceCard` grava `is_test = false`, `test_batch_id = null`.
- `crm_messages`: a E0 grava `simulated` a partir de `isSimulatedExecution()` **global**,
  não de `executionMode({ isTestLead: true })` — o lead de teste deixa de ser reconhecido como teste.
- Cadência/fila: nascem sob `scope = production`, sem marcador de teste.

Ou seja, na retomada o lote de homologação se mistura à carteira operacional.
(O ramo Portal da mesma função tem `if (lead.is_test) continue;` — o ramo GreenSales não tem.)

## G) Afeta leads reais?

**Sim — B.** O problema não é do laboratório: qualquer lead GreenSales real que entre entre
22:30 e 07:00 (ou domingo, ou sábado após 12:00) sofre a mesma perda:

- card criado sem responsável;
- não passa por `resolveExecutiveE0Mode` (a distinção Automático/Manual é ignorada);
- E0 é executada direto pela fila, mesmo para executivo configurado como Manual;
- card sem responsável aparece como não atribuído no Workspace/Ação do Dia — risco de
  ser tratado por outro executivo.

## H) Automático × Manual

- Dentro da janela: `resolveExecutiveE0Mode` decide; sem responsável → fallback seguro Manual.
- Na retomada: a bifurcação **não existe**; a E0 é sempre executada automaticamente.
  Portanto "Manual continua Manual" **não** é verdade hoje, e o fallback seguro
  (sem responsável ⇒ manual) também não é aplicado.

## I) Cadência

`FIRST_CONTACT_SENT` (emitido por `registerFirstContact` após a E0) é o evento que leva
`CADENCE_NOT_STARTED → CADENCE_ACTIVE` (`src/lib/relationship/machine.ts`).
E0 adiada não inicia cadência (confirmado: Ana não tem `relationship_cadences`).
E0 duplicada não reinicia: a inserção de `msg_e0_<cardId>` falha com 23505 e
`dispatchFirstContact` retorna "primeiro contato já registrado".
A retomada usa o mesmo caminho, logo mantém a regra.

## J) NOVOS bloqueia a E1

`src/lib/relationship/decide.ts`: enquanto o lead está em NOVOS só as etapas de primeiro
contato são permitidas — "Lead ainda em NOVOS — aguardando a primeira ação humana".
A E1 é contada a partir da **saída de NOVOS** (primeira ação humana), não do cadastro.

## K) Dívida artificial

- Mensagens: a fila é por item (`relationship_queue`); E1 PENDING atrasada continua E1,
  não gera E3/E4 em cascata.
- Ligações: são **recalculadas**, não persistidas, a partir de `stage_entered_at` e do
  `cadence_activation_date`; foi exatamente o corte para 2026-09-03 que zerou as 210 ligações
  em atraso. O risco residual está em `stage_entered_at` sendo reescrito em massa (foi o que
  produziu a dívida anterior), não na passagem do tempo em si.

## L) Ação do Dia

Fontes: `workspace_e0_actions` (E0 pendente), `relationship_queue` (mensagens),
ligações recalculadas de `crm_leads`/`crm_cadence_tasks`, `portal_meetings`,
`workspace_agenda_events`. Precedência AGENDA > REUNIÃO > MENSAGEM > LIGAÇÃO.
No fluxo novo: a E0 aparece quando o modo é Manual; a E1 só aparece após a saída de NOVOS
e o vencimento do item da fila.

## M) Biblioteca

Step técnico `E0`. `renderFromLibrary("E0", { executiveName, portalLink, rawInvestorName })`
usa a versão **ativa** da Biblioteca, escolhe a variante com/sem nome pelo nome recebido e
aplica a assinatura do executivo responsável; o link do Portal é obrigatório
(`resolveLeadDestinations({ portalRequired: true })`) e o WhatsApp do executivo é apenas
destino de botão. A retomada usa exatamente o mesmo caminho — mas, sem responsável,
`executiveName` e o link personalizado podem ficar vazios, o que tende a **bloquear** a E0
(`e0_bloqueada` em `relationship_engine_log`) em vez de gerar mensagem errada.

## N) Idempotência

- `msg_e0_<cardId>` é PK determinística — segunda E0 colide (23505).
- `ensureWorkspaceCard` é idempotente por `gs_<externalId>`.
- `workspace_e0_actions` é único por `card_id`.
- A fila de adiados descarta quem já registrou E0 e o scheduler pode repetir sem duplicar.
Uma correção da retomada pode preservar tudo isso, pois nenhuma dessas travas depende
de responsável ou de marcação de teste.

## O) Fase 1 (identidade)

`intakeLead` ainda não grava `canonical_investor_id`; Ana está com o campo nulo.
Nenhuma das etapas (card, responsável, E0, cadência, Ação do Dia) depende de `investors`
hoje, então não há bloqueio — apenas backlog de vínculo para a Fase 2.

## P) Marco / legado

`cadence_activation_date = 2026-09-03` é lido por `cadenceEligibility` no início do
`intakeLead` e pelo cálculo das ligações. Ana entrou em 03/09 22:57 → **nova operação**
(passou na elegibilidade e só parou na janela). Na retomada das 07:00 continua nova
operação: `registerFirstContact` reavalia a mesma elegibilidade com a mesma data.

## Q) Laboratório

O ajuste mínimo (`responsibleExecutiveId` → `connectionUserId` → `intakeLead`) é
equivalente ao fluxo real **dentro da janela**. Fora da janela ele não tem efeito, porque o
`intakeLead` retorna antes de usar o `connectionUserId`. Foi exatamente esse o caso do lote.

## R) Parecer sobre o problema central (item 17)

**A) Confirmado.**

- Onde se perde: `intakeLead` (retorno antecipado antes de resolver responsável/card) e
  `processDeferredFirstContacts` (chama `ensureWorkspaceCard` sem responsável/`is_test` e
  `registerFirstContact` sem `isTestLead` e sem consultar `resolveExecutiveE0Mode`).
- O que deveria ser preservado: `connectionUserId`/responsável resolvido, `is_test`,
  `test_batch_id`, e a decisão Automático/Manual.
- De onde recuperar: responsável a partir do card (se o card nascer antes) ou da conexão de
  origem; `is_test`/`test_batch_id` já existem em `crm_leads`.
- Onde corrigir: preferencialmente **na origem** (criar o card antes da trava de janela) e
  **na retomada** (repassar os campos que já existem em `crm_leads`). Não é necessário
  mudar payload de evento.
- Afeta leads reais: sim, a correção beneficia leads reais tanto quanto os de teste.
- Pode ser isolada: sim — não toca motor, janela, Biblioteca, cadência nem Safety Lock.

## S) Menor correção futura (descrição, não implementação)

1. Em `intakeLead`, mover a criação do card (`resolveResponsibleByUserId` +
   `ensureWorkspaceCard`) para **antes** da trava de janela, mantendo a trava apenas sobre a
   E0. Resultado: card nasce às 22:57 com responsável e marcação de teste; só a E0 espera.
2. Em `processDeferredFirstContacts`, selecionar também `is_test`/`test_batch_id`, reusar o
   card já existente e resolver o modo E0 com `resolveExecutiveE0Mode` (Manual → criar
   `workspace_e0_actions` em vez de executar), e usar `executionMode({ isTestLead })`
   em lugar de `isSimulatedExecution()`.

Nada disso cria segundo motor, muda janela, cadência, Biblioteca, Safety Lock, outros
ambientes, nem reabre E0 histórica (a fila só olha 3 dias e só eventos `e0_adiada`).

## T) Riscos / o que NÃO fazer

Perigosos: apagar `msg_e0_*` (quebra a idempotência), criar card manualmente no banco
(nasce fora do caminho oficial), mudar a janela, mudar `cadence_activation_date` de novo
(reintroduz dívida), criar fila paralela, rodar sync/tick só para acelerar (dispararia a
retomada defeituosa sobre leads reais), e **deixar o cron resolver sozinho** — às 07:00 a
retomada criaria o card de Ana sem responsável e sem marcação de teste, contaminando a
carteira. Neutros/aceitáveis: criar outro lead depois da correção; mudar o E0 do Thiago
para Manual não resolve o problema (a retomada ignora o modo).

## U) Recomendação objetiva para o próximo passo

Decidir antes das 07:00 BRT entre:

1. aplicar a correção mínima descrita em (S) antes que o cron rode; ou
2. manter tudo como está, deixar a retomada acontecer e usar o resultado como evidência
   documental do defeito, aceitando um card de teste sem responsável na carteira.

A opção 1 é a recomendada, por ser a única que também protege leads reais que entrem
fora da janela nesta madrugada.

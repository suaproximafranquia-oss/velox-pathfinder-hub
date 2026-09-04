# Fundação da Cadência — Desenho Arquitetural (/f)

Somente desenho. Nada é implementado, nenhuma migration, nenhuma alteração de motor, banco ou Ação do Dia.

Legenda usada em todo o documento:
- [C] comprovado no código/banco
- [R] recomendação arquitetural
- [D] decisão que ainda precisa ser tomada por você

---

## 0. Modelo de negócio validado com dados reais

### 0.1 As quatro entidades

| Entidade | O que é | Onde vive hoje [C] |
|---|---|---|
| PESSOA / INVESTIDOR | o ser humano; nasce uma vez e nunca se duplica | não existe. `portal_leads` (96 linhas) é o mais próximo |
| OPORTUNIDADE | intenção comercial datada, com estágio e cadência | `crm_leads` (621 linhas), `stage_key`, `entry_count` |
| CARD | projeção operacional de uma oportunidade para um responsável | `workspace_e0_actions.card_id`, board do Workspace |
| ORIGEM | como aquela intenção chegou | `origin` / `external_source` espalhados em ambas as tabelas |

### 0.2 Três casos reais

**Caso 1 — GreenSales (`gs_58419` / Carlos)**
```text
PESSOA        não existe como entidade
IDENTIDADE    portal_leads.identity_key = NULL  ← GreenSales não gera identity_key [C]
ORIGEM        portal_leads.origin=GreenSales | crm_leads.origin=LeadAds  ← duas origens divergentes p/ o mesmo fato [C]
OPORTUNIDADE  crm_leads 61f20e85-58c8-4662-b392-a549abe0301a, stage_key=zero_contato
CARD          existe via gs_58419
RESPONSÁVEL   portal_leads.responsible_executive_id=usr_thiago (crm_leads não tem responsável) [C]
CADÊNCIA      relationship_queue lead_id='gs_58419' (texto) + ligações recalculadas de crm_leads (UUID)
HISTÓRICO     crm_timeline.investor_id='gs_58419'
```
Falha: a mesma pessoa é referenciada por dois identificadores incompatíveis conforme o trecho do sistema.

**Caso 2 — Meta (`ld_752e4c86…` / "TEST META Canal")**
```text
IDENTIDADE    identity_key = 'p:11983482822'  ← aqui existe [C]
ORIGEM        Meta
OPORTUNIDADE  não existe: workspace_e0_actions.crm_lead_id = NULL [C]
CARD          existe sem oportunidade
CADÊNCIA      impossível: o motor de ligações lê crm_leads
```
Falha: card sem oportunidade ⇒ o canal Meta/TikTok não consegue entrar na cadência.

**Caso 3 — mesma pessoa, mais de uma entrada (telefone 12999887766)**
```text
portal_leads ld_mt7zwv6mr87x  "Juvanildo"  origem: Link personalizado · Velox Financeira
portal_leads ld_mt7p6loyurxj  "Lucas"      origem: Portal Velox
mesmo telefone, dois registros, duas "pessoas" para o sistema [C]
```
E na reentrada: 8 linhas de `crm_leads` têm `entry_count = 2` (ex.: Claudio gregorio, `last_entry_at` 03/09/2026) [C] — a segunda entrada **sobrescreve** o mesmo registro em vez de criar uma segunda oportunidade. Histórico da primeira passagem fica mesclado com o da segunda.

### 0.3 Cobertura medida [C]
- `crm_leads` = 621; `portal_leads` = 96.
- Apenas **72** oportunidades têm pessoa correspondente — mesmo número pelo `id` (`gs_||external_id`) e pelo telefone. Ou seja: **549 oportunidades sem pessoa**, e a reconciliação por telefone não recupera nenhuma além das já ligadas.
- `identity_key` está preenchida nos leads Portal/Meta/TikTok e **nula** nos GreenSales.

### 0.4 Resposta à regra de negócio (item 3)
**Sim, confirmado como necessário:** uma pessoa pode gerar N oportunidades ao longo do tempo sem virar outra pessoa. O motor já pressupõe isso (fluxos RE0–RE3 de reentrada) e o dado real já mostra o fenômeno (`entry_count=2`, duplicatas por telefone). Hoje o sistema representa isso de duas formas erradas: incrementando um contador sobre a mesma linha, ou criando um segundo "lead" que é lido como outra pessoa.

### 0.5 Cardinalidades necessárias
- **INVESTIDOR 1 ─ N OPORTUNIDADES** — obrigatório. 1:1 quebra reentrada e multiproduto (Financeira, Solar, Seguros).
- **OPORTUNIDADE 1 ─ N CARDS** — necessário, não 1:1. Uma oportunidade pode ser recriada no board após transferência de responsável, reabertura ou mudança de pipeline, e cada card tem seu próprio ciclo de vida operacional. O card é o que o executivo vê; a oportunidade é o que o negócio mede.
- **INVESTIDOR 1 ─ N IDENTIFICADORES DE ORIGEM** — `(source, external_id)` único por origem.

### 0.6 Alternativa A x B

**A) `portal_leads` promovida a INVESTIDOR**
- Vantagens: já tem `identity_key`, responsável e origem; menos tabelas novas; a ficha do investidor e o `step-message` já resolvem por ela.
- Desvantagens: a tabela tem 57 colunas misturando pessoa, jornada do Portal, liberação de conteúdo, janela de conversa e estado comercial; `identity_key` nula em GreenSales; ela própria já contém duplicatas da mesma pessoa [C] — promover uma tabela que duplica pessoas não resolve o bloqueador.
- Migração: aparentemente menor, mas exige deduplicar as linhas existentes *dentro* da tabela canônica, o processo mais arriscado possível.
- Histórico: `crm_timeline` já aponta para ela — ganho real.
- Quatro origens: GreenSales entraria com identidade nula; Meta/TikTok ok; Portal ok.
- Central de Cadência: herda campos de jornada do Portal que não têm sentido para Solar/Seguros.
- Dívida técnica: alta — perpetua "lead do Portal" como se fosse "pessoa".

**B) Nova tabela `investors`, `portal_leads` como registro de entrada do Portal**
- Vantagens: pessoa fica mínima e estável (nome, `identity_key`, telefone, e-mail, criada em); as quatro origens entram pelo mesmo caminho via `investor_identifiers`; deduplicação acontece *fora* das tabelas de origem, sem mexer nelas; serve Financeira, Solar e Seguros sem carregar jornada do Portal.
- Desvantagens: uma tabela e um backfill a mais; conviver com duas leituras durante a transição.
- Migração: aditiva. `portal_leads` e `crm_leads` só ganham `investor_id`; nada é reescrito.
- Histórico: `crm_timeline`/`relationship_engine_log` ganham `investor_id` como coluna adicional e mantêm o `lead_id` textual original.
- Quatro origens: simétricas por construção. GreenSales sem `identity_key` é resolvido no ato do vínculo, por telefone/e-mail, com fila de revisão.
- Central de Cadência: a instância da cadência pende de `investor_id` + `opportunity_id`, sem dependência do Portal.
- Dívida técnica: baixa. O risco é apenas o custo do backfill.

### 0.7 RECOMENDO B

Motivo: o bloqueador não é "falta um ID", é **falta a entidade pessoa**. `portal_leads` não pode ser a pessoa porque ela mesma já representa a mesma pessoa em linhas separadas [C] e cobre só 72 das 621 oportunidades. Promovê-la transformaria um registro de entrada em verdade canônica e a deduplicação teria de ser feita destrutivamente dentro da própria tabela canônica. Com `investors` + `investor_identifiers`, `portal_leads` permanece intacta como o que sempre foi — o registro de entrada do Portal — e a cadeia ORIGEM → INVESTIDOR → OPORTUNIDADE → CARD → CADÊNCIA → AÇÕES → EXECUÇÕES → HISTÓRICO passa a ser idêntica para GreenSales, Portal, TikTok e Meta.

---

## 1. Identidade única do investidor

Fatos [C]:
- `portal_leads` já possui `identity_key`, `identity_alternates`, `identity_conflict`, `external_id`, `external_source`, `origin`, `responsible_executive_id` e `responsible_executive_slug` — mas `identity_key` é nula nos leads GreenSales.
- `crm_leads` possui `external_id`, `external_source`, `origin`, `stage_key`, `entry_count` — e **não** possui coluna de responsável.
- `workspace_e0_actions` possui `card_id`, `crm_lead_id` (nulo nos cards TikTok/Meta), `responsible_executive_id`.
- `relationship_queue`, `relationship_cadences`, `crm_cadence_tasks`, `crm_timeline` guardam `lead_id`/`investor_id` como texto livre, com formatos misturados (`gs_<external_id>`, UUID, `ld_...`).
- Cobertura real: 621 oportunidades, 96 leads de Portal, 72 vínculos.

Desenho proposto:

a) **Investidor canônico = nova entidade `investors`** (alternativa B) [R]. `portal_leads` continua sendo o registro de entrada do Portal.

b) **Chave canônica = `investors.id` (UUID), com `identity_key` como chave de deduplicação** (telefone normalizado em 11 dígitos + e-mail) [R]. Nenhuma outra tabela deve inventar um formato de ID.

c) **Origens apontam, nunca criam identidade** [R]: `investor_identifiers` com `(investor_id, source, external_id)` único — `source` ∈ GreenSales, Portal, TikTok, Meta, manual. `gs_58619` deixa de ser um ID e passa a ser um *identificador de origem*.

d) **`investors` 1:N `crm_leads` (oportunidades)** e **oportunidade 1:N cards** [R]. `crm_leads` ganha `investor_id`; reentrada passa a criar nova oportunidade em vez de incrementar `entry_count` sobre a mesma linha.

e) **Card = projeção da oportunidade, nunca da pessoa** [R]. Card referencia a oportunidade e, por ela, o investidor. Cards TikTok/Meta hoje sem `crm_lead_id` [C] passariam a exigir a criação da oportunidade no ato da entrada — caminho único de entrada.

f) **Preservação do histórico**: nada é apagado nem reescrito [R]. Cada tabela histórica ganha `investor_id` por backfill; o identificador textual original permanece para sempre. Sem correspondência ⇒ `investor_id` nulo, histórico órfão legítimo (ex.: `gs_55023` [C]).

g) **Continuam existindo**: `portal_leads`, `crm_leads`, `relationship_queue`, `relationship_cadences`, `crm_timeline`, `relationship_engine_log`, `workspace_e0_actions`, `portal_meetings`. **Passam a apontar** para `investor_id`: queue, cadences, timeline, engine_log, e0_actions, cadence_tasks. **Nada é substituído nesta fase.**

---

## 1-bis. Isolamento multiambiente (/f, /s, /seg)

### Estado atual [C]
- Não existe hoje nenhuma dimensão de ambiente comercial no dado. `portal_leads.scope` guarda **canal de origem**, não ambiente: `green_sales` (72), `portal` (12), `tiktok` (3), `meta` (2), `redistribuicao` (1).
- `relationship_queue`, `relationship_cadences` e `relationship_engine_log` têm `scope`, mas o único valor existente é `production` — é a separação produção/homologação, **não** Financeira/Solar/Seguros.
- `responsible_executive_id` vive em `portal_leads` (pessoa/registro de entrada), ou seja, hoje o responsável é global à pessoa — exatamente o modelo que você quer eliminar.

### 1. O que pode existir em `investors` [R]
Apenas identidade da pessoa, imutável entre ambientes: `id`, `nome` (nome civil de referência), `identity_key` (telefone normalizado 11 dígitos), `telefones[]`, `emails[]`, `created_at`, `updated_at`, e opcionalmente `merged_into_id` para deduplicação auditável. Nada mais.

### 2. O que NÃO pode existir em `investors` [R]
Todos estes pertencem à oportunidade (portanto ao ambiente): origem, responsável, estágio, cadência, status/estado comercial, card, ações, tarefas, observações, histórico, produto/interesse, unidade/franquia, datas operacionais, jornada do Portal, janela de conversa, liberação de conteúdo, flags de teste. Regra prática: **se muda quando o negócio age, não é identidade.**

### 3. "AMBIENTE" precisa ser explícito?
**Sim, mas como atributo obrigatório e não-nulo da OPORTUNIDADE, não como tabela intermediária** [R]. Uma tabela `environments` acrescentaria um salto sem ganhar isolamento; o que garante isolamento é `opportunity.environment ∈ {financeira, solar, seguros}` sendo NOT NULL, imutável após criação, e propagado obrigatoriamente para card, cadência, ações, execuções e histórico. Modelo:

```text
INVESTOR (identidade, sem ambiente)
   └─ OPORTUNIDADE (environment obrigatório, origem, responsável, estágio)
        └─ CARD (herda environment)
             └─ INSTÂNCIA DE CADÊNCIA (herda environment + versão congelada)
                  └─ AÇÕES PLANEJADAS → EXECUÇÕES → HISTÓRICO (todos carregam environment)
```
Só o topo é compartilhado. Tudo abaixo da oportunidade é local ao ambiente.

### 4. Cenário da mesma pessoa nos três ambientes
```text
INVESTOR i_123  (Maria, 11 9xxxx-xxxx)   ← única coisa compartilhada
  ├─ OPORTUNIDADE /f   environment=financeira origem=GreenSales resp=Exec A cadência Financeira histórico F
  ├─ OPORTUNIDADE /s   environment=solar      origem=TikTok     resp=Exec B cadência Solar      histórico S
  └─ OPORTUNIDADE /seg environment=seguros    origem=Meta       resp=Exec C cadência Seguros    histórico Sg
```
- Reconhecido como a mesma pessoa: apenas identidade (nome, telefone, e-mail) e o fato de existirem outras oportunidades — e mesmo isso só para quem tiver permissão cross-ambiente.
- Permanece independente: origem, responsável, estágio, cadência, ações, execuções, observações, reuniões, métricas.
- **Jamais atravessa**: histórico/timeline, conteúdo de mensagens, notas do executivo, resultado de ligação, estado comercial, agenda e qualquer dado que permita a um executivo de /s saber o que foi conversado em /f.

### 5. Um `investor_id` visível em /f pode retornar dados de /s? **NÃO** [R]
Defesa em profundidade, em todas as camadas:
- **Banco**: `environment` NOT NULL em oportunidade, card, cadência, ação, execução e histórico; índice composto `(environment, investor_id)`; nenhuma FK direta de histórico para `investors` sem o ambiente junto.
- **Queries**: `environment` é parâmetro obrigatório de toda função de leitura operacional — nunca opcional com default, porque default vira vazamento silencioso.
- **Server functions**: o ambiente vem do contexto autenticado do executivo (permissão de módulo), nunca de parâmetro enviado pelo cliente.
- **RLS**: política por ambiente cruzando o vínculo executivo↔ambiente; a leitura da tabela `investors` (identidade) é separada e mínima — nome e telefone, sem nada operacional.
- **Ação do Dia**: agrega apenas ações do ambiente da sessão; o colapso por lead passa a ser colapso por `(environment, opportunity_id)`.
- **Histórico**: `crm_timeline`/`relationship_engine_log` filtram por ambiente antes de qualquer junção por pessoa.
- **Cadência**: instância pertence à oportunidade; não existe cadência "do investidor".

### 6. Origem
Origem é atributo da **oportunidade**, não da pessoa [R]. `investor_identifiers (investor_id, source, external_id)` serve só para *reconhecer* a pessoa; o contexto comercial (`GreenSales` em /f, `TikTok` em /s, `Meta` em /seg) fica gravado em cada oportunidade separadamente. Um mesmo `external_id` nunca implica compartilhar dados entre ambientes.

### 7. Responsável — modelo confirmado [R]
Responsável é atributo da oportunidade (ou do card), nunca da pessoa. Hoje ele está em `portal_leads` [C], o que produz exatamente o "lead é do Thiago" global que precisa acabar. Transferência de responsável é evento local ao ambiente e não afeta as demais oportunidades da mesma pessoa.

### 8. Modelo canônico final (conceitual)
```text
investors                identidade pura, sem ambiente                 [R]
investor_identifiers     (investor_id, source, external_id)            [R]
opportunities            investor_id + environment(NOT NULL) + origem
                         + responsável + estágio                       [R]
cards                    opportunity_id (+environment herdado)         [R]
cadence_instances        opportunity_id + cadence_version_id congelada [R]
planned_actions          instance_id + depends_on + required_outcome   [R]
executions               planned_action_id + resultado + executor      [R]
history                  append-only, environment obrigatório          [R]
```
Limite duro: **acima da oportunidade, compartilhado; da oportunidade para baixo, estritamente isolado por ambiente.**

### Decisões pendentes deste bloco [D]
- Se existe perfil com permissão de ver que a mesma pessoa tem oportunidade em outro ambiente (visão "existe", sem conteúdo) ou se o isolamento é total inclusive quanto à existência.
- Se `crm_leads` atual vira `opportunities` do ambiente `financeira` por backfill, ou se `opportunities` nasce como entidade nova com `crm_leads` mantido em convivência.
- Se `scope` existente (`production`) e `environment` convivem como dimensões separadas — recomendação: sim, são ortogonais (ambiente comercial x produção/homologação).

---


## 2. Dependência entre ações

Fato [C]: `src/lib/crm/cadence.ts` calcula ligações com offsets `[1,1,3,7]`, canal de mensagem desativado, e `plannedMessageDates` serve apenas a `preferNonCollidingCallDate` — o próprio código declara que não cria dependência. Ligação e mensagem são filas independentes que apenas coincidem no calendário.

Desenho proposto:

a) A dependência pertence à **ação planejada** (instância), derivada da **configuração** [R]. Nunca ao componente de tela.

b) **Em ambos**: a configuração declara a *regra* ("após L2 com resultado NAO_ATENDEU+CHAMOU, liberar Mensagem X em D+0"); a instância materializa o *vínculo concreto* entre duas ações específicas daquele investidor [R].

c) Representação conceitual mínima na ação planejada:
   - `depends_on_action_id` — ação anterior que a origina;
   - `required_outcome` — conjunto de resultados que a liberam;
   - `status` ∈ `BLOQUEADA` (dependência não satisfeita), `LIBERADA` (satisfeita, aguardando data), `AGENDADA`, `EXECUTADA`, `CANCELADA`;
   - `cancel_cause` — inclui `RESOLVIDA_POR_OUTRA_ACAO` com `resolved_by_action_id`.
   Ligação atendida ⇒ a mensagem dependente vai para `CANCELADA / RESOLVIDA_POR_OUTRA_ACAO`, com rastro, e não some silenciosamente.

d) Coincidência de calendário deixa de ser interpretável como relação: **toda ação nasce `BLOQUEADA` salvo a raiz do fluxo** [R]. Se não há `depends_on_action_id` nem gatilho de tempo declarado, a ação não existe.

e) Genérico por construção: a dependência é `(ação anterior, resultado, ação liberada)` — não conhece "ligação" nem "mensagem". Serve a reunião → follow-up, E20 → E27, visualização de conteúdo → V3, reengajamento e finalização, exatamente como serve ligação → mensagem.

---

## 3. Próxima ação persistida

Fato [C]: a próxima ligação é recalculada a cada abertura da Ação do Dia a partir de `crm_leads` + histórico DONE; `crm_cadence_tasks` só tem linhas `DONE`. Nada garante estabilidade se a configuração mudar.

Cinco entidades distintas [R]:

```text
CONFIGURAÇÃO DA CADÊNCIA   versionada, imutável após publicação
        ↓
INSTÂNCIA DA CADÊNCIA      investidor + versão congelada da config
        ↓
AÇÃO PLANEJADA             o que deve acontecer, com dependência e data
        ↓
EXECUÇÃO DA AÇÃO           tentativa concreta + resultado informado
        ↓
HISTÓRICO                  append-only, nunca reescrito
```

a) A **ação planejada** é a entidade central (a `relationship_queue` já é o embrião mais próximo disso [C]).

b) Deve armazenar: investidor canônico, instância, etapa, canal, data/hora prevista, status, responsável, `depends_on_action_id`, `required_outcome`, versão da configuração e id da regra que a gerou.

c) A regra fica gravada por referência imutável: `cadence_version_id` + `rule_id` [R]. Nunca por cópia livre de texto.

d) A ação anterior fica em `depends_on_action_id`; a execução que a liberou, em `created_by_execution_id`.

e) O resultado vive na execução (`outcome`, executor, timestamp, observação) e é o único gatilho de liberação.

f/g) **Imutabilidade retroativa**: a instância congela `cadence_version_id` no momento da criação. Publicar uma nova versão da configuração afeta apenas instâncias novas — ou instâncias existentes somente por migração explícita e auditada [D: migrar instâncias em curso ao publicar nova versão, sim ou não]. Ações já executadas nunca são recalculadas.

---

## 4. Onde a Central de Cadência se encaixa

```text
CONFIGURAÇÃO (Central de Cadência, versionada)
   ↓ publicar versão
MOTOR (src/lib/relationship — único, já existente)
   ↓ instanciar
INSTÂNCIA DO INVESTIDOR (versão congelada)
   ↓ materializar
AÇÕES PLANEJADAS (fila única, com dependências)
   ↓ ler o dia
AÇÃO DO DIA (agregador, permanece somente-visão)
   ↓ executar
EXECUÇÃO → RESULTADO
   ↓
HISTÓRICO (append-only) → realimenta o motor
```

Na Central (configuração): versões, ativação/desativação, estágios, branches/condições, intervalos, dias úteis vs corridos, calendário de exceções, e a declaração de canal por etapa (mensagem, chamada, reunião) e dos fluxos de reengajamento, reentrada e finalização.

No motor: interpretação da versão, cálculo de datas, avaliação de dependências.

Na Ação do Dia: **nada de regra**. Ela continua sendo leitura das ações planejadas do dia + reuniões + agenda, com precedência de apresentação. Isso preserva a decisão já firmada de não existir um segundo motor.

Safety Lock 2029 permanece intacto em todas as fases; nenhuma delas exige envio real.

---

## 5. Migração e compatibilidade (nada é apagado)

Preservável como está: `portal_leads`, `crm_leads`, `crm_timeline`, `relationship_engine_log`, `workspace_e0_actions`, `portal_meetings`, biblioteca de mensagens.

Passam a se relacionar (coluna nova `investor_id`, valor antigo mantido): `relationship_queue`, `relationship_cadences`, `crm_cadence_tasks`, `crm_timeline`, `relationship_engine_log`, `workspace_e0_actions`.

Substituídas no futuro, com convivência: o cálculo dinâmico de ligações em `src/lib/crm/cadence.ts` (vira materialização de ações planejadas) e a cadência hardcoded em `src/lib/relationship/config.ts` (vira versão 1 publicada na Central).

Exigem backfill: vínculo `gs_<external_id>` → investidor; `crm_leads.investor_id`; `workspace_e0_actions.crm_lead_id` nulo dos cards TikTok/Meta.

Sem identidade suficiente para migração automática [C]: os 408 leads elegíveis sem correspondência em `portal_leads`, eventos de timeline órfãos (`gs_55023`), cards de teste TikTok/Meta sem `crm_lead_id`. Estes exigem reconciliação por `identity_key` (telefone/e-mail) com fila de revisão humana — nunca chute automático.

---

## 6. Ordem técnica correta de implementação

**FASE 1 — Identidade canônica e vínculos (sem mudar comportamento).**
Objetivo: todo registro passar a saber a quem pertence. Dependências: nenhuma. Impacto: colunas novas, nada removido. Regressão: baixa (colunas ignoradas pelo código atual). Migration: sim. Backfill: sim, com fila de reconciliação manual. Envio real: não exigido.

**FASE 2 — Ação planejada como entidade de primeira classe.**
Objetivo: `relationship_queue` evoluir para fila única de ações planejadas, com status, responsável e origem da regra; ligações passam a ser materializadas em vez de recalculadas. Dependências: Fase 1. Regressão: média (Ação do Dia lê da fila). Mitigação: escrita em paralelo com o cálculo atual e comparação em sombra antes do corte. Migration: sim. Backfill: parcial. Envio real: não.

**FASE 3 — Execução e resultado persistidos.**
Objetivo: toda execução vira registro com resultado, executor e vínculo com a ação planejada; `relationship_engine_log` e `crm_timeline` passam a ser derivados, não fonte. Dependências: Fase 2. Migration: sim. Backfill: não (histórico antigo permanece como está). Envio real: não.

**FASE 4 — Dependências entre ações.**
Objetivo: `depends_on_action_id` + `required_outcome` + cancelamento por resolução. Dependências: Fases 2 e 3 (não há dependência sem resultado persistido). Migration: sim (colunas). Backfill: não. Envio real: não.

**FASE 5 — Central de Cadência (configuração versionada).**
Objetivo: tirar a regra do código; publicar `config.ts` atual como versão 1 imutável. Dependências: Fases 2–4. Regressão: alta se feita antes; baixa depois. Migration: sim. Backfill: uma versão inicial. Envio real: não.

**FASE 6 — Adaptação da Ação do Dia.**
Objetivo: passar a ler somente ações planejadas e responder "por que esta ação apareceu" e "qual é a próxima". Dependências: todas as anteriores. Migration: não. Backfill: não. Envio real: não.

Justificativa da ordem: dependência (Fase 4) é impossível sem resultado persistido (Fase 3), que é impossível sem ação planejada estável (Fase 2), que é impossível sem identidade (Fase 1). A Central de Cadência vem depois porque configurar regras sobre uma fila que ainda se recalcula sozinha reintroduz exatamente o problema atual.

---

## Decisões pendentes [D]

1. Tabela canônica: recomendação fechada em **B — nova `investors`** (seção 0.7); falta seu aceite.
2. Publicar nova versão da cadência migra instâncias em curso ou só afeta novas.
3. Reconciliação das 549 oportunidades sem pessoa: telefone/e-mail não resolve nenhuma além das 72 já ligadas [C] — decidir entre criar um investidor por oportunidade órfã ou tratá-las como histórico sem pessoa.
4. Cards de teste TikTok/Meta: reconciliar ou marcar definitivamente como não-produção.
5. Reentrada: criar nova oportunidade (recomendado) ou manter `entry_count` na mesma linha.

# Fundação da Cadência — Desenho Arquitetural (/f)

Somente desenho. Nada é implementado, nenhuma migration, nenhuma alteração de motor, banco ou Ação do Dia.

Legenda usada em todo o documento:
- [C] comprovado no código/banco
- [R] recomendação arquitetural
- [D] decisão que ainda precisa ser tomada por você

---

## 1. Identidade única do investidor

Fatos [C]:
- `portal_leads` já possui `identity_key`, `identity_alternates`, `identity_conflict`, `external_id`, `external_source`, `origin`, `responsible_executive_id` e `responsible_executive_slug`.
- `crm_leads` possui `external_id`, `external_source`, `origin` — e **não** possui coluna de responsável.
- `workspace_e0_actions` possui `card_id`, `crm_lead_id` (nulo nos cards TikTok/Meta), `responsible_executive_id`.
- `relationship_queue`, `relationship_cadences`, `crm_cadence_tasks`, `crm_timeline` guardam `lead_id`/`investor_id` como texto livre, com formatos misturados (`gs_<external_id>`, UUID, `ld_...`).
- Cobertura real: 419 leads elegíveis em `crm_leads` contra 11 correspondências em `portal_leads`.

Desenho proposto:

a) **Investidor canônico = `portal_leads`** [R]. É a única tabela que já carrega identidade (`identity_key`), responsável e origem. Ela deve ser promovida a "pessoa", não a "lead comercial".

b) **Chave canônica = `portal_leads.id` (UUID/texto estável), com `identity_key` como chave de deduplicação** (telefone normalizado em 11 dígitos + e-mail) [R]. Nenhuma outra tabela deve inventar um formato de ID.

c) **Origens apontam, nunca criam identidade** [R]: uma tabela de vínculos (conceitual) `investor_identifiers` com `(investor_id, source, external_id)` — `source` ∈ GreenSales, Portal, TikTok, Meta, manual. `gs_58619` deixa de ser um ID e passa a ser um *identificador de origem* de um investidor.

d) **`portal_leads` 1:N `crm_leads`** [R]. Uma pessoa pode ter mais de uma oportunidade comercial ao longo do tempo (reentrada, nova unidade, novo produto). `crm_leads` ganha `investor_id` apontando para o canônico. O inverso (1:1) fecharia a porta para reentrada, que já existe no motor (RE0–RE3).

e) **Card do Workspace = projeção da oportunidade, não da pessoa** [R]. Card referencia `crm_lead_id` (oportunidade) e, por ele, `investor_id`. Cards TikTok/Meta hoje sem `crm_lead_id` [C] passariam a exigir a criação da oportunidade no ato da entrada — caminho único de entrada.

f) **Preservação do histórico**: nada é apagado nem reescrito [R]. Cada tabela histórica ganha uma coluna adicional `investor_id` preenchida por backfill; o `lead_id` textual original permanece para sempre como registro do que foi gravado à época. Registros sem correspondência ficam com `investor_id` nulo e são tratados como histórico órfão legítimo (ex.: `gs_55023`, que tem timeline mas não tem linha em `portal_leads` [C]).

g) **Continuam existindo**: `portal_leads` (promovida), `crm_leads` (oportunidade), `relationship_queue`, `relationship_cadences`, `crm_timeline`, `relationship_engine_log`, `workspace_e0_actions`. **Passam a apontar** para `investor_id`: queue, cadences, timeline, engine_log, e0_actions, cadence_tasks. **Nada é substituído nesta fase.**

[D] Se a pessoa canônica deve viver em `portal_leads` renomeada conceitualmente para "Investidor", ou se preferimos uma tabela nova `investors` com `portal_leads` virando apenas mais uma origem. A primeira preserva mais dados; a segunda é mais limpa semanticamente.

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

1. Tabela canônica: promover `portal_leads` ou criar `investors` nova.
2. Publicar nova versão da cadência migra instâncias em curso ou só afeta novas.
3. Reconciliação dos ~408 leads sem vínculo: automática por telefone/e-mail com revisão, ou 100% manual.
4. Cards de teste TikTok/Meta: reconciliar ou marcar definitivamente como não-produção.

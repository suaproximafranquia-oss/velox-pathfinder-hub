# AUDITORIA DE VIABILIDADE — Biblioteca como fonte única das etapas (Financeira /f)

Somente leitura. Nada construído, alterado, migrado ou executado.

## P1 — É tecnicamente possível?

**SIM, MAS COM RESSALVAS.** Não é reconstrução do motor. As ressalvas concretas:

1. **`CadenceStep` é um tipo TypeScript literal** (`src/lib/relationship/types.ts:24`), usado em `CadenceRecord.executedSteps`, `EngineAction`, `applyEvent`. Uma chave criada em runtime não existe nesse tipo — o tipo precisa passar a ser `string` com validação em runtime. É a mudança de maior alcance, mas é mecânica.
2. **`FLOW_SEQUENCE`** (`config.ts`) define a ordem. Criar E9 na Biblioteca **não diz ao motor onde E9 entra** — esse é o problema real, não a validação.
3. **`STEPS[step]`** é consultado em `decide.ts:151` para obter `businessDaysAfterReference`, `templatePurpose` e `contentGroup`. Uma etapa sem essas propriedades não pode ser programada. Precisam vir da Biblioteca.
4. **`message-library.server.ts`** semeia a partir de listas literais; a Biblioteca só mostra o que está nessas listas.

## P2 — Mapa de dependências

| Arquivo | Função/uso | Dependência | O que faz | Pode virar dinâmica? | Risco |
|---|---|---|---|---|---|
| `lib/relationship/config.ts` | `STEPS`, `FLOW_SEQUENCE`, `RELATIONSHIP_CONFIG` | — (origem) | Declara etapas, prazos, finalidade, conteúdo e ordem dos fluxos | Etapas/ordem: sim. Janelas/calendário: não | 🔴 alto |
| `lib/relationship/types.ts` | `CadenceStep`, `CadenceFlow` | tipo literal | Restringe a chave em tempo de compilação | Sim (virar `string`) | 🔴 alto |
| `lib/relationship/step-registry.ts` | `KNOWN_STEP_KEYS`, `isKnownStep`, `CONTENT_REQUIRED_STEPS` | `STEPS` | Recusa etapa desconhecida | Sim — vira consulta à Biblioteca ∪ histórico | 🟡 médio |
| `lib/relationship/decide.ts` | `nextStep`, `isStepInOrder`, `decideNextAction` | `FLOW_SEQUENCE`, `STEPS` | Escolhe a próxima etapa e calcula vencimento | Sim, se ordem/prazo vierem como dado | 🔴 alto |
| `lib/relationship/machine.ts` | `applyEvent` | `CadenceStep` | Máquina de estados | Só o tipo | 🟢 baixo |
| `lib/relationship/reactivation.ts` | regra E30 | `STEPS`, `FLOW_SEQUENCE` | Reativação | Parcial | 🟡 médio |
| `lib/relationship/current-steps.ts` | fotografia das etapas | `STEPS`, `FLOW_SEQUENCE` | Exibição | Sim | 🟢 baixo |
| `lib/relationship/engine.ts` | orquestração + `confirmManualExecution` | `STEPS` | Executa/conclui | Parcial | 🟡 médio |
| `server/relationship/message-library.server.ts` | `WORD_STEP_ORDER`, `LEGACY_STEPS`, `WORD_ALIAS_STEPS`, `PENDING_TEXT_STEPS`, `LIBRARY_STEP_ORDER`, `isKnownStep` | listas literais | Semeia e lista a Biblioteca | **Sim — é o ponto central** | 🟡 médio |
| `server/relationship/dispatch.server.ts` | envio | `isKnownStep` | Recusa etapa desconhecida | Sim | 🟡 médio |
| `server/relationship/library-diagnostics.server.ts` | lacunas | `STEPS` | Diagnóstico | Sim | 🟢 baixo |
| `server/relationship/engine.server.ts` | motor de produção | `config` | Instância | Sim | 🟡 médio |
| `server/relationship/audit.server.ts` | auditoria | `config` | Leitura | Sim | 🟢 baixo |
| `server/relationship/calendar-admin.server.ts` | calendário | `config` | Janelas — **deve continuar em código** | Não | 🟢 baixo |
| `server/crm/automation.server.ts` | automação | `config` | Agendamento | Parcial | 🟡 médio |
| `server/crm/daily-actions-log.server.ts` | conclusão | `isKnownStep` | Valida antes de concluir | Sim | 🟡 médio |
| `routes/universo.tsx` | apresentação | `STEPS` | Exibição institucional | Sim | 🟢 baixo |
| Testes (`engine.test`, `entry.test`, `comando-3d`, `comando-4f`, `refino-final`) | — | `STEPS`, `FLOW_SEQUENCE`, `isKnownStep` | Fixam o comportamento atual | Precisarão ser ajustados | 🟡 médio |
| `step_key` (14 ocorrências em `server/relationship/*`) | leitura/gravação | coluna texto | Identidade da mensagem | Já é dado | 🟢 baixo |

## P3 — Código x dado

**Hoje em código, deveria ser dado da Biblioteca:** existência da etapa (`STEPS`), rótulo, prazo em dias úteis (`businessDaysAfterReference`), finalidade do template (`templatePurpose`), exigência de conteúdo (`contentGroup`), ordem no fluxo (`FLOW_SEQUENCE`), listas de semeadura da Biblioteca.

**Obrigatoriamente em código:** máquina de estados e prioridade de eventos (`machine.ts`), bloqueios de automação (`blocksAutomation`), janelas/dias úteis (`calendar.ts`), regra de contato humano real, idempotência e claim de fila, E0/primeiro contato e ownership, etapas terminais (`closing.ts`), decisão de canal/modo de execução e **Safety Lock**.

## P4 — O problema dos fluxos

**A) Ordem na Biblioteca.** Adiciona-se `flow` + `position` por mensagem. Simples de ler, mas transforma a sequência inteira em dado editável: um erro de digitação da Gestora reordena a cadência real de todos os leads.
**B) Etapa criada e depois associada a um fluxo, também na Biblioteca.** Mesma estrutura de (A), porém em duas ações: criar a mensagem (inerte) e depois publicá-la num fluxo. Uma etapa recém-criada **não entra em produção sozinha** — precisa de um ato explícito.
**C) Alternativa: Biblioteca declara existência+conteúdo; o fluxo permanece uma configuração versionada, editável em tela própria, com fotografia por versão.** O ciclo guarda a versão do fluxo com que nasceu — ninguém tem a sequência mudada no meio do caminho.

**Mais segura para o sistema atual: (B) com o mecanismo de versão de (C).** (A) é a mais arriscada. A regra "o que está na Biblioteca manda" continua valendo — só distingue "existe" de "está em produção neste fluxo".

## P5 — Casos

- **CASO A** — funciona; é o estado atual.
- **CASO B (E9 só na Biblioteca)** — hoje: `isKnownStep("E9")` = falso; `dispatch.server.ts` e `daily-actions-log.server.ts` recusam; `nextStep()` nunca a escolhe, pois não está em `FLOW_SEQUENCE`; e a tela nem a exibe, porque `LIBRARY_STEP_ORDER` não a contém. **Efeito prático: E9 é invisível e inerte.** Para reconhecer: `KNOWN_STEP_KEYS` derivado da Biblioteca ∪ histórico; `CadenceStep` como `string`; posição no fluxo declarada.
- **CASO C (E3 desativada na Biblioteca)** — hoje: **E3 continua sendo criada**, porque a decisão vem de `FLOW_SEQUENCE`, não da Biblioteca. O envio é que falha depois, por falta de texto ativo. Para corrigir: `nextStep()` deve pular etapa sem versão ativa; itens já na fila devem ser bloqueados com motivo; histórico intocado.
- **CASO D (E9 e E10)** — **NÃO COMPROVADO que exista qualquer ordenação automática**. Não há ordem alfanumérica no motor. Sem posição declarada, o motor não saberia. Reforça a escolha (B).
- **CASO E (conteúdo de E3 alterado)** — nova ação usa a versão ativa (funciona hoje, via `renderFromLibrary`); ação antiga **deveria** mostrar o snapshot — ver P7.

## P6 — Versionamento na execução

**Já existe o campo certo.** `relationship_message_sends` tem `library_id`, `library_version`, `rendered_body`, `step`, `content_url`, `investor_name_used`, `cadence_id`, `simulated`, `sent_at`. **Nenhuma migration é necessária** para o snapshot.

**Lacuna:** apenas `e0.server.ts` e `e20.functions.ts` gravam nessa tabela. `confirmManualExecution` (`engine.ts`) — o caminho da Ação do Dia — **não grava**. Corrigir é acrescentar uma escrita, sem quebrar histórico.

## P7 — Histórico (E3 v1 em 05/09, v2 em 10/09)

**Tecnicamente possível, e a estrutura já existe** — `relationship_message_sends` guardaria `rendered_body` + `library_version = 1`. **A lacuna é exatamente a de P6**: execuções manuais pela Ação do Dia não geram essa linha, então hoje o Workspace mostraria a etapa mas não o texto de 05/09. Auditoria adicional recomendada: contar linhas de `relationship_message_sends` por origem para medir a cobertura real.

## P8 — Fila

`relationship_cadences` = ciclo; `relationship_queue` = ação planejada/executada; Biblioteca = conteúdo. **A Biblioteca nunca deve escrever na fila.**

- **Duplicação**: unicidade lógica `(lead_id, ciclo, step, ownership_seq)`; a fila só é criada pelo motor.
- **Retroatividade indevida**: etapa nova vale a partir da sua data de criação; `operational_since` (Bloco 1) já é o precedente.
- **Duas E9 no mesmo ciclo**: `decide.ts` já impede via `executedSteps.includes(step)` e `isStepInOrder`.
- **Idempotência**: preservada pelo claim de `confirmManualExecution`; publicar versão nova não recria item nem reabre item concluído.

## P9 — Ciclos existentes

- **(A) Receber E9 automaticamente** — o lead em curso ganha obrigação retroativa; `isStepInOrder` pode recusá-la se E9 for posicionada antes de etapas já executadas, gerando fila travada. **Alto risco.**
- **(B) Só ciclos novos** — comportamento previsível, alinhado ao marco operacional já implementado. **Menor risco; recomendada.**
- **(C) Caso a caso** — mais flexível, exige tela de aplicação e auditoria por lead. Bom como evolução posterior de (B).

## P10 — Limite atual

- **Banco**: suporta — `step_key` é `text`, sem enum, sem CHECK observado.
- **Backend**: a leitura é `select` completo sem `.limit()` nessa consulta; suporta.
- **UI**: `MessageLibraryPanel` renderiza `[...steps.keys()]` num container com `max-h-[360px] overflow-y-auto` — rola, não limita.
- **Paginação**: não existe, e não é necessária nessa ordem de grandeza.
- **Limite artificial real**: apenas as listas `WORD_STEP_ORDER`/`LEGACY_STEPS`/`WORD_ALIAS_STEPS`/`PENDING_TEXT_STEPS` em `message-library.server.ts`, mais `isKnownStep`. Nenhum outro limite encontrado no projeto.

## P11 — Botão "+"

**A estrutura suporta.** `publishLibraryVersion` já cria a versão 1 quando não existe linha para a `step_key`; falta apenas a UI passar uma chave nova em vez de escolher de uma lista, e a listagem deixar de se basear em `LIBRARY_STEP_ORDER`.

**Obrigatórios hoje**: `stepKey`, `body`. **Deveriam passar a ser preenchíveis** (hoje escondidos da tela, mas usados pelo motor): `content_group`, `requires_video`, `requires_template`, `meta_template_name`, `button_kind`, `code`, `scope` — mais os campos novos de fluxo/posição/prazo, se adotarmos (B).

## P12 — "Qualquer mensagem"

**O banco já aceita qualquer texto** em `step_key` — não há enum nem CHECK. A restrição é 100% de código (`isKnownStep`). O regex `^[A-Z][A-Z0-9_]{0,15}$` **não é tecnicamente necessário**; é higiene, para evitar `e9`, `E 9`, acento ou espaço criando chaves que parecem iguais mas não são — lembrando que `isKnownStep` já faz `toUpperCase()`, o que hoje mascara parte do problema.

## P13 — Podemos eliminar a lista manual?

**SIM, quanto à existência das etapas.** Arquitetura mínima: (1) `CadenceStep` vira `string`; (2) `KNOWN_STEP_KEYS` passa a ser função assíncrona = chaves ativas da Biblioteca ∪ chaves já presentes no histórico; (3) `STEPS[step]` é substituído por leitura das propriedades da própria mensagem; (4) a semeadura por lista literal é removida.

**NÃO pode sair do código**: a *ordem e as condições de transição* como lógica — mesmo que a sequência vire dado, quem interpreta a sequência, aplica prioridade de eventos, calcula dia útil, verifica bloqueio e garante idempotência continua sendo código. Motivo: são regras com dependência temporal e de concorrência, não texto.

## P14 — Prova de conceito (E9 "Primeiro contato")

1. **Nasce** — o administrador usa "+ Adicionar mensagem", informa `E9`, título e texto.
2. **Armazenada** — uma linha em `relationship_message_library` com `step_key='E9'`, `version=1`, `active=true`. *(funciona hoje se a UI permitir a chave)*
3. **Motor descobre** — **GAP**: hoje `isKnownStep('E9')` é falso. Falta derivar o registro da Biblioteca.
4. **Sabe se está ativa** — `active = true`; já existe.
5. **Qual conteúdo usar** — `renderFromLibrary` lê a versão ativa; já existe.
6. **Onde E9 entra** — **GAP**: falta `flow` + `position` na Biblioteca. Sem isso, `nextStep()` nunca a escolhe.
7. **Cria a ação** — **GAP parcial**: `decide.ts` precisa dos prazos vindos da mensagem em vez de `STEPS[step]`.
8. **Ação do Dia encontra** — funciona sem mudança: lê `relationship_queue` genericamente por `step`.
9. **Executivo executa** — funciona: "Etapa E9 — Copiar mensagem" + confirmação SIM/NÃO.
10. **Workspace registra** — funciona parcialmente: `writeLedger` grava em `relationship_engine_log` + `crm_timeline`. **GAP**: eventos `acao_do_dia_*` podem estar fora da whitelist da visão relacional.
11. **Histórico preserva a versão** — **GAP**: `confirmManualExecution` não grava em `relationship_message_sends`, embora os campos existam.
12. **Central contabiliza** — **GAP**: a Central não existe, e "previstas" exige o snapshot diário de planejado.

**Cinco GAPs, nenhum deles estrutural.**

## P15 — Arquitetura proposta

```text
BIBLIOTECA  relationship_message_library
   conteúdo · etapa (step_key) · versão · ativo · link · fluxo+posição · prazo
        ↓ (lida, nunca escreve fila)
MOTOR       machine.ts · decide.ts · calendar.ts · engine.ts
   transições · janelas · idempotência · Safety Lock   [CÓDIGO]
        ↓
CICLO       relationship_cadences
   flow · state · executedSteps · operational_since · versão do fluxo
        ↓
FILA        relationship_queue
   step · due_at · status · executed_at · result · canonical_investor_id
        ↓
AÇÃO DO DIA  leitura pura, sem tabela própria
   prioridade: primeiro contato > reunião > agenda > cadência
        ↓
EXECUÇÃO    queue (verdade) + relationship_message_sends (SNAPSHOT: library_id, version, rendered_body)
        ↓
WORKSPACE   relationship_engine_log (auditoria) + crm_timeline (histórico humano)
        ↓
CENTRAL DE OPERAÇÕES  agregação do ledger + snapshot diário de planejado
```

## P16 — Impacto

**🟡 MÉDIA — refatoração controlada, não reconstrução.**

Motivo: a máquina de estados, a fila, o versionamento e os campos de snapshot **já existem e não mudam**. O que muda é a *origem da lista de etapas* e a *tipagem*. O maior volume é mecânico (`CadenceStep` literal → `string`, mais ajuste de testes). Se a ordem dos fluxos também virasse dado sem versionamento, aí sim subiria para 🔴.

## P17 — Regra de segurança

Confirmado: nenhuma solução proposta altera o Safety Lock (que segue chamado nas 5 saídas para a Graph API, imediatamente antes de cada `fetch`), cria caminho alternativo para a Meta, toca `/s`, `/seg` ou `/`, mexe em E0 sem autorização, apaga histórico, renumera etapas existentes, reseta ciclos, cria redistribuição automática ou ativa envio real.

---

## CONCLUSÕES

### 1. É POSSÍVEL?
**SIM, COM RESSALVAS** — as ressalvas são o tipo `CadenceStep`, a ordem dos fluxos e as propriedades de prazo hoje em `STEPS`.

### 2. O QUE PRECISA MUDAR
1. `CadenceStep`/`CadenceFlow`: tipo literal → `string` validado em runtime.
2. `KNOWN_STEP_KEYS`/`isKnownStep`: derivar da Biblioteca ∪ histórico.
3. `message-library.server.ts`: remover as quatro listas literais de semeadura.
4. Biblioteca ganha `flow`, `position` e prazo por mensagem.
5. `decide.ts`: ler prazos/finalidade da mensagem em vez de `STEPS[step]`; pular etapa sem versão ativa.
6. `confirmManualExecution`: gravar snapshot em `relationship_message_sends`.
7. UI: botão "+" e campos hoje ocultos.
8. Testes atualizados.

### 3. O QUE NÃO PODE SER MEXIDO
Safety Lock; `whatsapp.server.ts`; `machine.ts` (prioridade de eventos); `calendar.ts` (janelas/dias úteis); E0 e `workspace_e0_actions`; ownership/`lead_ownership_history`; identidade canônica; histórico em queue/log/timeline/sends; `step_key` de etapas existentes; `/s`, `/seg`, `/`.

### 4. MENOR CAMINHO SEGURO
- **Bloco A** — Snapshot da execução (`confirmManualExecution` → `relationship_message_sends`). Sem migration, ganho imediato de rastreabilidade, risco baixo.
- **Bloco B** — Registro dinâmico: `isKnownStep` por Biblioteca ∪ histórico, com `CadenceStep` como `string`. Ainda sem mudar decisão de fluxo.
- **Bloco C** — Biblioteca dinâmica: fim das listas de semeadura + botão "+" + campos ocultos expostos. Etapa nova nasce inerte.
- **Bloco D** — Fluxo como dado: `flow`/`position`/prazo na mensagem; `decide.ts` passa a lê-los; versão de fluxo por ciclo; nova etapa só vale para ciclos novos.
- **Bloco E** — Central de Operações (snapshot de planejado + relatório).

## NÃO COMPROVADO NO CÓDIGO ATUAL
1. Ordenação automática de chaves novas (E9/E10) — não existe; ver P5-D.
2. Cobertura real de `relationship_message_sends` por origem — auditoria: contagem por `origin` na tabela.
3. Se `acao_do_dia_*` aparece na visão relacional da jornada — auditoria: ler a whitelist em `journey.server.ts`.
4. Existência de CHECK/enum em `step_key` — o schema tipa como texto; auditoria: consultar as constraints da tabela.

## Observação de escopo
Em modo de planejamento só posso escrever este arquivo; `roadmap.md` será atualizado no primeiro bloco de construção aprovado.

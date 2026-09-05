# RODADA DE ARQUITETURA — Biblioteca como fonte dinâmica (Financeira /f)

Somente leitura. Nada foi construído, alterado, migrado ou executado.

## BLOCO 1 — Biblioteca de Conteúdo

**Estrutura de dados.** Tabela única: `relationship_message_library` (27 colunas). Campos relevantes: `step_key`, `purpose`, `code`, `title`, `body`, `body_without_name`, `content_url`, `content_label`, `content_group`, `version`, `active`, `supersedes_id`, `scope`, `requires_video`, `requires_template`, `meta_template_name`, `button_kind`, `source_kind`, `source_reference`, `notes`, `created_by`, `created_by_name`. Código: `src/server/relationship/message-library.server.ts` (leitura/gravação), `src/lib/relationship/library.functions.ts` (ponte), `src/components/executive/message-library-panel.tsx` (UI), `src/routes/f.executivo.biblioteca.tsx` (rota).

**Identificação da etapa.** A chave é `step_key` (texto), com fallback histórico para `purpose`. `code` existe mas é secundário. Não há `stage`, `sequence` nem `channel` na Biblioteca.

**Onde está a lista de etapas — três fontes distintas:**

| Fonte | Onde | Papel |
|---|---|---|
| Configuração | `src/lib/relationship/config.ts` (`STEPS`) + `step-registry.ts` (`NON_CADENCE_STEPS`) | Define o que o motor **pode executar** e a sequência dos fluxos |
| Conteúdo | `relationship_message_library` | Define o **texto e o link** de cada etapa |
| Histórico | `relationship_queue`, `relationship_message_sends`, `relationship_engine_log`, `crm_timeline`, `crm_cadence_tasks` | Guarda o que **foi** feito, com as chaves gravadas |

**Dependência obrigatória de config.ts: SIM, é bloqueante.** `step-registry.ts` monta `KNOWN_STEP_KEYS` a partir de `Object.keys(STEPS)`; `isKnownStep()` recusa qualquer chave fora dessa lista, com a mensagem "Etapa desconhecida … não existe no motor". Além disso `message-library.server.ts` mantém suas próprias listas fixas: `WORD_STEP_ORDER`, `LEGACY_STEPS` (`E0_V1`, `V3`, `V4`), `WORD_ALIAS_STEPS` (`E2`, `E5`, `E6`, `E7`), `PENDING_TEXT_STEPS`, `LIBRARY_STEP_ORDER`. O `config.ts` também é importado por `engine.server.ts`, `automation.server.ts`, `audit.server.ts`, `library-diagnostics.server.ts` e `calendar-admin.server.ts`.

**Forma mais segura de inverter a fonte** sem quebrar chaves históricas: manter `step_key` como identificador imutável e passar `KNOWN_STEP_KEYS` a ser a **união** de (a) chaves ativas da Biblioteca e (b) chaves já presentes no histórico. Nunca derivar validade de uma lista literal. `config.ts` deixa de declarar *quais* etapas existem e passa a declarar apenas *regras de comportamento* (janelas, fluxos, dependências) para as chaves que a Biblioteca fornecer.

**Versionamento: JÁ EXISTE.** Publicar cria `version + 1`, marca a anterior `active = false` e liga por `supersedes_id`. Uma versão ativa por `step_key` (índice único parcial). Editar nunca sobrescreve. **Porém**: a execução hoje **não grava o snapshot do texto usado** — só conclui a fila e registra a etapa. Essa é a lacuna real de rastreabilidade.

**Desativar uma mensagem — comportamento recomendado:** novas ações → não devem ser criadas para a etapa; ações já criadas e ainda pendentes → devem ser bloqueadas com motivo legível (o motor já faz isso quando falta texto ativo); ações executadas e histórico → intocados, sempre.

## BLOCO 2 — Novas etapas automáticas

**O que impediria E9 hoje:** `isKnownStep("E9")` retorna falso, porque `E9` não está em `STEPS`. O motor recusaria a etapa e nada sairia. Segundo bloqueio: `LIBRARY_STEP_ORDER` não listaria E9, então a própria tela da Biblioteca não a semearia.

**Cadastro duplicado necessário hoje:** sim — `config.ts` (`STEPS` + fluxo) e `message-library.server.ts` (`WORD_STEP_ORDER`). Duas listas para o mesmo conceito.

**Convenção:** recomendo aceitar qualquer chave que case com `^[A-Z][A-Z0-9_]{0,15}$`, sem exigir sequência numérica. Não existe hoje validação de sequência — mas existe **ordem fixa hardcoded** em `FLOWS`: `sem_resposta: E0→E1→E3→E4→E12→E30`, `visualizacao: E0→E1→V3→V4`, mais `reengajamento`, `reentrada`, `frio`. Isso é o que realmente impede E9 de "entrar sozinha" num fluxo.

**Código x dado:**
- Continua em **código**: máquina de estados, idempotência, janelas de envio, Safety Lock, gatilhos de interrupção, regra de contato humano real, E0 (origem e titularidade).
- Passa a ser **dado**: existência da etapa, rótulo, texto, link, ordem dentro do fluxo, se exige material.

## BLOCO 3 — Botão "+"

**O botão "+" NÃO EXISTE.** A tela só lista as etapas semeadas e permite editar/publicar. O limite de ~9 mensagens **não é do banco nem visual**: é a lista literal `WORD_STEP_ORDER` + `LEGACY_STEPS` + `PENDING_TEXT_STEPS` no servidor, que define quais linhas são semeadas e exibidas. O banco aceita qualquer `step_key`.

**Campos obrigatórios hoje ao publicar:** `stepKey` e `body`. Opcionais: `bodyWithoutName`, `contentUrl`, `contentLabel`, `title`, `notes`.

**Campos usados pelo motor e ausentes na interface:** `content_group`, `requires_video`, `requires_template`, `meta_template_name`, `button_kind`, `scope`, `code`.
**Campos na interface plenamente usados pelo motor:** texto, texto sem nome, link, rótulo do link, rótulo da etapa. Nenhum campo da tela é inútil.

## BLOCO 4 — Motor e fila

**Como o motor descobre ações:** a partir do estado do ciclo em `relationship_cadences`, aplicando `FLOWS`/`STEPS` para calcular a próxima etapa e gravando o item em `relationship_queue`.

| Estrutura | Papel |
|---|---|
| `relationship_cadences` | O ciclo: fluxo, estado, `operational_since` |
| `relationship_queue` | A ação planejada e sua execução (`status`, `executed_at`, `result`, `canonical_investor_id`) |
| `relationship_message_library` | Conteúdo versionado |
| `workspace_e0_actions` | E0 por titularidade (`ownership_seq`) |
| `crm_cadence_tasks` | Fila legada de ligações — **segunda fonte de verdade, divergência real** |

**Com a Biblioteca dinâmica:** conteúdo → Biblioteca; sequência → Biblioteca (ordem declarada) + código (regras de transição); programação → motor/scheduler; execução → `relationship_queue`; histórico → queue + ledger + snapshot.

**Duplicação e idempotência:** manter a unicidade por `(cardId, cycle, step, ownership_seq)`. Alterar a Biblioteca nunca deve recriar item já existente — a Biblioteca muda o *conteúdo*, não a *fila*.

**Etapa nova para ciclos antigos:** recomendo **não aplicar retroativamente**. A etapa nova vale para ciclos iniciados após sua criação (mesma lógica de `operational_since` do Bloco 1). Aplicar a ciclos correntes deve ser decisão explícita do administrador, nunca automática.

## BLOCO 5 — Ação do Dia → Workspace

**Onde a execução é registrada hoje** (`daily-actions-log.server.ts`): `relationship_engine_log` (auditoria, `details` jsonb) + `crm_timeline` (leitura humana) + a fonte oficial (`relationship_queue` via `confirmManualExecution`, ou `portal_meetings` para reunião). Ligação é a exceção: grava em `crm_cadence_tasks` (`outcome`, `rang`, `note`, `completed_at`).

**O registro identifica:** investidor (sim, `leadId`), card (sim, é o mesmo id), etapa (sim), ação (sim), executivo (sim), data/hora (sim), resultado (sim). **Ciclo: NÃO** — o `cycle` não é gravado no evento.

**"Executada" x "concluída com resultado":** existe a distinção — `registerDailyActionMessage` retorna `{ concluded }`; se a fila não puder ser concluída, o evento é gravado como "registrada" em vez de "enviada".

**Resultados hoje:** atendeu / não atendeu / chamou / não chamou → `crm_cadence_tasks`. Mensagem → queue + ledger. Pulo e nota → ledger + timeline. **Caixa postal NÃO EXISTE** como resultado.

**Nota do executivo:** `relationship_engine_log` + `crm_timeline`, evento `acao_do_dia_observacao`.

**Por que não chega ao Workspace:** três causas comprovadas — (1) a ligação grava em `crm_cadence_tasks` e **não passa por `writeLedger`**, logo não gera linha em `crm_timeline`; (2) a auditoria anterior identificou eventos `acao_do_dia_*` fora da whitelist da visão relacional da jornada; (3) não há registro de "caixa postal" nem snapshot do conteúdo.

**Função central: existe parcialmente** — `writeLedger` já é o ponto único, mas a ligação não a usa. **Fonte de verdade recomendada da execução: `relationship_queue`** (a ação e seu desfecho), com `relationship_engine_log` como projeção de auditoria e `crm_timeline` como projeção humana. Uma execução, um `execution_id`, três leituras.

## BLOCO 6 — Pular

Hoje: `skipDailyAction` exige justificativa (mínimo 3 caracteres, erro explícito se faltar). **Não existe lista de motivos** — é texto livre, logo não existe "Outro". Registra em `relationship_engine_log` (`acao_do_dia_pulada`) e em `crm_timeline`. **Não avança a cadência** — o motor não é chamado. A ação é suprimida apenas na **data operacional corrente** (`listSkippedActionKeys` compara `operationalDate`), portanto **retorna no dia seguinte de calendário, não no próximo dia útil**. Para indicadores: os dados existem no ledger, mas não há tela que os leia.

## BLOCO 7 — Central Administrativa

**Não existe.** Confirmado: nenhuma rota ou componente agrega execução por executivo.

**Recomendação:** menu dentro da área do executivo, visível só para Administração/Gestora, com o nome **Central de Operações** — "Central Administrativa" confunde com a Gestão de Usuários e "Monitoramento" soa passivo.

Deve mostrar por executivo: previstas, executadas, puladas, pendentes, ligações, mensagens, reuniões, demais ações.

**"Previstas" deve significar TODAS as ações devidas do dia**, independentemente de o executivo ter aberto a tela — caso contrário o indicador premia quem não abre. **Isso não é reconstruível hoje**: a fila é recalculada em tempo real e, depois que avança, o passado não é reproduzível.

**Recomendação para criar o registro sem virar segunda fila:** um **snapshot append-only de planejado** — uma linha por ação devida por dia, gravada na primeira leitura do dia e nunca alterada depois. Ele não é lido pela operação (a Ação do Dia continua recalculando), só pelo relatório. É fotografia, não fila.

**Deve abrir o lead/card: sim.** Deve mostrar motivo do pulo, nota, data/hora, resultado, etapa/ciclo e mensagem/conteúdo utilizado: **sim para todos** — sendo que "conteúdo utilizado" depende do snapshot da mensagem, que ainda não existe.

## BLOCO 8 — Período e gestão

Recomendo já nascer com hoje / ontem / últimos 7 dias / mês / período personalizado — a estrutura é a mesma consulta com intervalo, e limitar a "hoje" obrigaria refazer depois. Filtros por executivo, etapa, resultado, pulos e período: todos viáveis sobre a mesma fonte.

## BLOCO 9 — Permissões

Acesso: administrador (tudo) e gestora (todos os executivos sob sua gestão). Executivo: apenas os próprios números — ou nenhum acesso, se preferir manter a Central puramente gerencial.

**Estado atual:** existe `has_role` com os papéis `admin`, `manager`, `user`, `current_executive_id()` e `workspace_module_permissions`. **Falta**: a Gestora (Larissa) depende de regras de aplicação, não de papel formal em `user_roles` — auditoria anterior já apontou isso. Precisará ser formalizada antes da Central.

## BLOCO 10 — Histórico e auditoria

`relationship_engine_log` = **auditoria técnica** (append-only, `details` jsonb, ator, escopo). `crm_timeline` = **histórico humano** exibido na ficha/Workspace. Hoje `writeLedger` já grava nos dois a partir de uma chamada — o modelo está certo, falta a ligação usá-lo.

**Uma execução, duas visões: sim** — desde que exista um `execution_id` compartilhado. **Contagem única na Central:** contar pelo `queue.id`/`execution_id`, nunca por número de linhas de log. **Conteúdo exato preservado:** gravando no momento da execução o `library_message_id` + `version` + o texto renderizado; a Biblioteca pode mudar depois sem afetar o passado.

## BLOCO 11 — Segurança

Confirmado, por leitura do código: a trava global permanece obrigatória e nenhuma proposta acima a toca. `blockRealWhatsappSend` é chamado nas 5 (cinco) saídas para a Graph API, imediatamente antes de cada `fetch`; não existe outro caminho para a Meta no projeto. Nenhuma arquitetura aqui cria caminho alternativo — o relatório e a Biblioteca são leitura e conteúdo, não canal. Continuamos em modo seguro/simulação (`resolveExecutionMode` força simulação fora de produção e em lead de teste). `/s`, `/seg` e `/` permanecem intocados; a única atenção é que `whatsapp.server.ts` é compartilhado e não deve ser alterado.

## BLOCO 12 — REGRA-MÃE

> **O universo de etapas e conteúdos do motor é descoberto dinamicamente a partir da Biblioteca de Mensagens; o código declara apenas como as etapas se comportam, nunca quais existem. Toda execução gera uma única ocorrência, imutável, com snapshot do conteúdo utilizado, da qual derivam a auditoria técnica, o histórico humano e os indicadores administrativos.**

- **Fonte de verdade** — existência/rótulo/texto/link/ordem: `relationship_message_library`. Execução: `relationship_queue` (mais `portal_meetings` para reuniões). Ciclo: `relationship_cadences`.
- **Permanece em código** — máquina de estados, transições, dependências, janelas, idempotência, contato humano real, E0/titularidade e Safety Lock.
- **Passa a ser dado** — quais etapas existem, seus rótulos, textos, links, ordem no fluxo e exigência de material.
- **Histórico preservado** — `step_key` imutável; validade da etapa = ativas na Biblioteca ∪ presentes no histórico; snapshot de conteúdo por execução; versão anterior nunca reescrita.
- **Sem duplicidade** — unicidade `(card, ciclo, etapa, ownership_seq)`; alterar a Biblioteca muda conteúdo, nunca cria fila.
- **Ação do Dia** — continua leitura pura, sem tabela própria.
- **Workspace** — alimentado automaticamente por `writeLedger`, incluindo a ligação (hoje é a exceção).
- **Central de Operações** — agregação do mesmo ledger + snapshot diário de planejado; nenhuma operação paralela.

## NÃO COMPROVADO NO CÓDIGO ATUAL

1. Que os eventos `acao_do_dia_*` aparecem hoje na ficha do investidor — auditoria mínima: ler a whitelist de eventos em `journey.server.ts`.
2. Quantas ações de ligação existem sem correspondência em `crm_timeline` — auditoria mínima: contagem comparativa entre `crm_cadence_tasks` concluídas e eventos de timeline no mesmo período.
3. Se a Gestora tem papel formal em `user_roles` — auditoria mínima: consulta de leitura em `user_roles`.
4. Se `vendedor_id`/`user_id` do GreenSales representa o responsável — bloqueador anterior, depende de confirmação externa.

## Observação de escopo

Este pedido pede registro em `roadmap.md`; em modo de planejamento só posso escrever este arquivo. O roadmap será atualizado no primeiro bloco de construção aprovado.
